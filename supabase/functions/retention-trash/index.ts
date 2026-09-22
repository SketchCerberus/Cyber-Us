// Daily cleanup. The high-entropy token is stored exclusively in Supabase Vault.
import {createClient} from 'npm:@supabase/supabase-js@2.57.4';
const respond=(body:Record<string,unknown>,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});
Deno.serve(async(request:Request)=>{
 if(request.method!=='POST')return respond({error:'Method not allowed'},405);
 const token=request.headers.get('x-trash-token');
 if(!token||token.length<48||token.length>256)return respond({error:'Unauthorized'},401);
 const url=Deno.env.get('SUPABASE_URL');
 const legacyKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 const newKeys=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}');
 const secret=newKeys.default||legacyKey;
 if(!url||!secret)return respond({error:'Server not configured'},503);
 const db=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
 const authorized=await db.rpc('trash_authorize_cron',{p_token:token});
 if(authorized.error||authorized.data!==true)return respond({error:'Unauthorized'},401);
 const failed:string[]=[];let removedPublic=0;let purged=0;
 try{
  // A previous network failure must not leave rejected art in the public bucket.
  const orphans=await db.from('fanart_submissions').select('id,extension').eq('status','rejected').eq('trash_bucket','fanart-trash').limit(100);
  if(orphans.error)throw orphans.error;
  for(const artwork of orphans.data||[]){
   const path=`${artwork.id}.${artwork.extension}`;
   const result=await db.storage.from('fanart-public').remove([path]);
   if(result.error)failed.push(`public:${artwork.id}`);else removedPublic++;
  }
  const due=await db.rpc('trash_due_fanarts');
  if(due.error)throw due.error;
  for(const artwork of due.data||[]){
   const id=artwork.id as string;
   const publicPath=`${id}.${artwork.extension}`;
   const targets=[
    {bucket:'fanart-public',path:publicPath},
    {bucket:'fanart-pending',path:artwork.image_path as string},
    {bucket:'fanart-trash',path:publicPath},
   ];
   let ok=true;
   for(const target of targets){
    const result=await db.storage.from(target.bucket).remove([target.path]);
    if(result.error){ok=false;failed.push(`${target.bucket}:${id}`);break;}
   }
   if(!ok)continue;
   const done=await db.rpc('trash_finalize_fanart',{p_id:id});
   if(done.error){failed.push(`database:${id}`);continue;}
   if(done.data===true)purged++;
  }
 }catch(error){console.error('Trash cleanup failed',error);return respond({error:'Cleanup failed',purged,failed},500);}
 if(failed.length){console.error('Trash cleanup partially failed',failed);return respond({error:'Partial cleanup',purged,removedPublic,failed},500);}
 return respond({ok:true,purged,removedPublic});
});
