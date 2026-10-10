const allowed=new Set(['https://sketchcerberus.github.io','http://localhost:4173','http://127.0.0.1:4173']);
export async function handleClosure(req,{createClient,url,anonKey,serviceKey,now=()=>Date.now()}){
 const origin=req.headers.get('origin');
 const headers={'Content-Type':'application/json','Vary':'Origin','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS'};
 if(origin&&allowed.has(origin))headers['Access-Control-Allow-Origin']=origin;
 const reply=(status,code)=>new Response(JSON.stringify({code}),{status,headers});
 if(origin&&!allowed.has(origin))return reply(403,'origin');
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return reply(405,'method');
 const bearer=req.headers.get('authorization')||'';
 if(!bearer.startsWith('Bearer '))return reply(401,'auth');
 let body;try{body=await req.json();}catch{return reply(400,'confirmation');}
 if(body.confirmation!=='delete-account')return reply(400,'confirmation');
 try{
 const userClient=createClient(url,anonKey,{global:{headers:{Authorization:bearer}},auth:{persistSession:false,autoRefreshToken:false}});
 const result=await userClient.auth.getUser(bearer.slice(7));
 const user=result.data?.user;
 if(result.error||!user?.email_confirmed_at||user.is_anonymous||user.deleted_at)return reply(401,'auth');
 // A fresh sign-in limits destructive actions from an unattended old session.
 const signedIn=Date.parse(user.last_sign_in_at||'');
 if(!Number.isFinite(signedIn)||now()-signedIn>10*60*1000||signedIn>now()+60000)return reply(409,'reauth');
 const staff=await userClient.rpc('my_staff_role');
 if(staff.error)return reply(503,'permissions');
 if(staff.data)return reply(409,'staff');
 const admin=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
 // Identity always comes from the verified token, never a caller-supplied ID.
 const avatar=await admin.storage.from('community-avatars').remove([`${user.id}/avatar.jpg`]);
 if(avatar.error)return reply(503,'avatar');
 const closed=await admin.auth.admin.deleteUser(user.id,true);
 if(closed.error)return reply(503,'closure');
 return reply(200,'closed');
 }catch{return reply(503,'closure');}
}
