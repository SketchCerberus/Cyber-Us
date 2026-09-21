// Only this server-side function can write fanart files. Never expose the service key.
import {createClient} from 'npm:@supabase/supabase-js@2.57.4';

const site = 'https://sketchcerberus.github.io';
const cors = (origin: string | null) => ({
  'Access-Control-Allow-Origin': site,
  'Access-Control-Allow-Headers': 'authorization, apikey, x-client-info, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Vary': 'Origin',
});
const reply = (status: number, error: string, origin: string | null) =>
  Response.json({error}, {status,headers:cors(origin)});
const ascii = (data: Uint8Array, at: number, length: number) =>
  String.fromCharCode(...data.subarray(at, at + length));

// A small WebP validator: no animation, ICC, EXIF, XMP or unexpected chunks.
// Browser canvas produces a fresh static WebP; the server enforces that contract.
export function validWebp(data: Uint8Array): boolean {
  if (data.length < 30 || data.length > 1572864 || ascii(data,0,4)!=='RIFF' || ascii(data,8,4)!=='WEBP') return false;
  const view = new DataView(data.buffer,data.byteOffset,data.byteLength);
  if (view.getUint32(4,true) + 8 !== data.length) return false;
  let pos=12, image=0, extended=false, alpha=false, width=0, height=0, chunks=0;
  while (pos + 8 <= data.length && chunks++ < 4) {
    const tag=ascii(data,pos,4),size=view.getUint32(pos+4,true),start=pos+8;
    const end=start+size+(size%2);
    if (size < 1 || end > data.length) return false;
    if (tag==='VP8X' && pos===12 && size===10) {
      if (data[start] & ~0x10 || data[start+1] || data[start+2] || data[start+3]) return false;
      extended=true;
      width=1+data[start+4]+(data[start+5]<<8)+(data[start+6]<<16);
      height=1+data[start+7]+(data[start+8]<<8)+(data[start+9]<<16);
    } else if (tag==='ALPH' && extended && !alpha && !image) {
      alpha=true;
    } else if (tag==='VP8 ' && !image && size>=10) {
      if (ascii(data,start+3,3)!=='\x9d\x01\x2a') return false;
      const w=view.getUint16(start+6,true)&0x3fff,h=view.getUint16(start+8,true)&0x3fff;
      if (extended && (w!==width || h!==height)) return false;
      width=w;height=h;image++;
    } else if (tag==='VP8L' && !image && !alpha && size>=5) {
      if (data[start]!==0x2f) return false;
      const w=1+(((data[start+2]&0x3f)<<8)|data[start+1]);
      const h=1+(((data[start+4]&0x0f)<<10)|(data[start+3]<<2)|(data[start+2]>>6));
      if (extended && (w!==width || h!==height)) return false;
      width=w;height=h;image++;
    } else return false;
    pos=end;
  }
  return pos===data.length && image===1 && width>0 && height>0 && width<=1600 && height<=1600;
}

const envKey = (legacy: string, modern: string) => {
  const old=Deno.env.get(legacy);
  if(old)return old;
  try {return JSON.parse(Deno.env.get(modern)||'{}').default||'';} catch {return '';}
};
Deno.serve(async (req: Request) => {
  const origin=req.headers.get('origin');
  if (req.method==='OPTIONS') return new Response(null,{status:204,headers:cors(origin)});
  if (req.method!=='POST') return reply(405,'Method not allowed',origin);
  if (origin && origin!==site) return reply(403,'Origin not allowed',origin);
  const length=Number(req.headers.get('content-length')||0);
  if (length>1750000) return reply(413,'File too large',origin);
  const token=req.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
  if(!token) return reply(401,'Sign in required',origin);
  const url=Deno.env.get('SUPABASE_URL')||'';
  const anon=envKey('SUPABASE_ANON_KEY','SUPABASE_PUBLISHABLE_KEYS');
  const secret=envKey('SUPABASE_SERVICE_ROLE_KEY','SUPABASE_SECRET_KEYS');
  if(!url||!anon||!secret)return reply(503,'Submission service unavailable',origin);
  const userDb=createClient(url,anon,{global:{headers:{Authorization:`Bearer ${token}`}},auth:{persistSession:false,autoRefreshToken:false}});
  const identity=await userDb.auth.getUser(token);
  if(identity.error||!identity.data.user)return reply(401,'Sign in required',origin);
  let data: FormData;
  try {data=await req.formData();}catch{return reply(400,'Invalid form',origin);}
  const image=data.get('image'),raw=data.get('metadata');
  if(!(image instanceof File)||typeof raw!=='string'||raw.length>4000||image.size>1572864)
    return reply(400,'Invalid image or metadata',origin);
  let meta: Record<string,unknown>;
  try {meta=JSON.parse(raw);}catch{return reply(400,'Invalid metadata',origin);}
  const title=typeof meta.title==='string'?meta.title.trim():'';
  const artist=typeof meta.artist==='string'?meta.artist.trim():'';
  const region=typeof meta.region==='string'?meta.region.trim():'';
  const link=typeof meta.artistUrl==='string'?meta.artistUrl.trim():'';
  const accent=meta.accent;
  const tags=meta.tags;
  if(title.length<2||title.length>100||artist.length<2||artist.length>60||region.length>80
    ||(region.length>0&&region.length<2)||typeof meta.showRegion!=='boolean'
    ||(meta.showRegion&&!region)||meta.consent!==true
    ||!['random','blue','red','green'].includes(String(accent))
    ||!Array.isArray(tags)||tags.length>8||tags.some(tag=>typeof tag!=='string'||tag.trim().length<1||tag.trim().length>32))
    return reply(400,'Invalid metadata',origin);
  if(link) {
    try {const parsed=new URL(link);if(parsed.protocol!=='https:'||!parsed.hostname||link.length>240||parsed.username||parsed.password)
      return reply(400,'Invalid artist link',origin);}
    catch{return reply(400,'Invalid artist link',origin);}
  }
  const bytes=new Uint8Array(await image.arrayBuffer());
  if(!validWebp(bytes))return reply(400,'Only static WebP images up to 1600px and 1.5 MB are accepted',origin);
  const admin=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
  // Query authorization before touching storage; RPC will independently recheck at insert.
  const guard=await userDb.rpc('fanart_submission_allowed');
  if(guard.error||guard.data!==true)return reply(403,'Submissions not allowed for this account or limit reached',origin);
  const path=`${identity.data.user.id}/${crypto.randomUUID()}.webp`;
  const uploaded=await admin.storage.from('cyber-fanarts').upload(path,
    new Blob([bytes],{type:'image/webp'}),{contentType:'image/webp',cacheControl:'60',upsert:false});
  if(uploaded.error)return reply(503,'Could not store artwork',origin);
  const record=await userDb.rpc('submit_fanart',{
    p_image_path:path,p_title:title,p_artist:artist,p_region:region||null,
    p_show_region:meta.showRegion,p_artist_url:link||null,p_accent:accent,p_tags:tags,p_consent:true
  });
  if(record.error) {
    await admin.storage.from('cyber-fanarts').remove([path]);
    return reply(400,'Could not register artwork; check limits and try again',origin);
  }
  return Response.json({id:record.data,status:'pending'},{status:201,headers:cors(origin)});
});
