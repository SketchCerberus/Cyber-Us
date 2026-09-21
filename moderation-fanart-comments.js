/* Separate fanart-comment review inside the existing staff-only fanart workspace.
   Server-side RPC authorization and private audit log are the security boundary. */
(() => {
  'use strict';
  const view=document.getElementById('moderationFanartsView');
  const tab=document.getElementById('moderationFanartsTab');
  if (!view || !tab || !window.supabase?.createClient) return;
  const db=window.supabase.createClient('https://znenamrszhjsiztllcit.supabase.co',
    'sb_publishable_3VRFxwtDuYq4ETHs4xof8g_Fp3GRl6c',
    {auth:{flowType:'pkce',detectSessionInUrl:false,persistSession:true,autoRefreshToken:true}});
  const pt=()=>document.documentElement.lang.startsWith('pt');
  const tr=(br,en)=>pt()?br:en;
  const loc=(node,br,en)=>{node.dataset.pt=br;node.dataset.en=en;node.textContent=tr(br,en);return node;};
  const section=document.createElement('section');section.className='moderation-fanart-comments';
  section.setAttribute('aria-labelledby','fanart-comments-moderation-heading');
  const header=document.createElement('div');header.className='moderation-selection-heading';
  const title=loc(document.createElement('h3'),'Comentários nas fanarts','Fanart comments');
  title.id='fanart-comments-moderation-heading';
  const refresh=loc(document.createElement('button'),'Atualizar comentários','Refresh comments');
  refresh.type='button';refresh.className='community-action';
  header.append(title,refresh);
  const hint=loc(document.createElement('p'),'Analise os comentários publicados. A remoção exige motivo e registra a ação em histórico privado. Exibindo até 100 comentários recentes.','Review published comments. Removal requires a reason and creates a private audit record. Showing up to 100 recent comments.');
  hint.className='community-hint';
  const status=document.createElement('p');status.className='community-notice';
  status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  const list=document.createElement('ol');list.className='comment-list';
  section.append(header,hint,status,list);view.append(section);
  let ticket=0,allowed=false;
  function say(br,en,error=false){loc(status,br,en);status.classList.toggle('error',error);}
  async function checkStaff(){
    allowed=false;const current=++ticket;
    const auth=await db.auth.getUser();
    if(current!==ticket||auth.error||!auth.data?.user)return;
    const permission=await db.rpc('is_moderator');
    if(current!==ticket)return;
    allowed=!permission.error&&permission.data===true;
  }
  async function load(){
    const current=++ticket;list.replaceChildren();
    if(!allowed||view.hidden)return;
    refresh.disabled=true;say('Carregando comentários…','Loading comments…');
    const [comments,works]=await Promise.all([
      db.from('fanart_comments').select('id,submission_id,display_name,body,created_at').order('created_at',{ascending:false}).limit(100),
      db.from('fanart_gallery').select('submission_id,title').limit(100)
    ]);
    if(current!==ticket||!allowed){refresh.disabled=false;return;}
    refresh.disabled=false;
    if(comments.error||works.error){say('Não foi possível carregar comentários.','Could not load comments.',true);return;}
    const titles=new Map((works.data||[]).map(work=>[work.submission_id,work.title]));
    const rows=comments.data||[];
    if(!rows.length){say('Nenhum comentário de fanart publicado.','No published fanart comments.');return;}
    say(`${rows.length} comentário(s) recente(s).`,`${rows.length} recent comment(s).`);
    for(const item of rows){
      const li=document.createElement('li');li.className='comment-item';
      const art=document.createElement('strong');art.textContent=titles.get(item.submission_id)||tr('Obra indisponível','Artwork unavailable');
      const name=document.createElement('p');name.className='comment-meta';name.textContent=item.display_name;
      const date=document.createElement('time');date.className='comment-meta';date.dateTime=item.created_at;
      date.textContent=new Intl.DateTimeFormat(pt()?'pt-BR':'en',{dateStyle:'medium',timeStyle:'short'}).format(new Date(item.created_at));
      const body=document.createElement('p');body.className='comment-body';body.textContent=item.body;
      const remove=loc(document.createElement('button'),'Remover comentário','Remove comment');
      remove.type='button';remove.className='community-action danger';
      remove.addEventListener('click',async()=>{
        if(!allowed||view.hidden)return;
        const reason=window.prompt(tr('Motivo da remoção (3–500 caracteres):','Reason for removal (3–500 characters):'));
        if(reason===null)return;
        const text=reason.trim();
        if(text.length<3||text.length>500){say('Informe um motivo de 3 a 500 caracteres.','Provide a reason between 3 and 500 characters.',true);return;}
        if(!window.confirm(tr('Confirmar remoção deste comentário?','Confirm removal of this comment?')))return;
        remove.disabled=true;
        const response=await db.rpc('moderate_fanart_comment',{p_comment_id:item.id,p_reason:text});
        if(response.error||response.data!==true){
          say('Não foi possível remover o comentário.','Could not remove the comment.',true);
          remove.disabled=false;return;
        }
        await load();
        say('Comentário removido e ação registrada.','Comment removed and action logged.');
      });
      li.append(art,name,date,body,remove);list.append(li);
    }
  }
  tab.addEventListener('click',async()=>{
    await checkStaff();if(allowed&&!view.hidden)load();
  });
  refresh.addEventListener('click',async()=>{await checkStaff();if(allowed)load();});
  db.auth.onAuthStateChange(()=>{allowed=false;++ticket;list.replaceChildren();});
  new MutationObserver(()=>{
    for(const node of section.querySelectorAll('[data-pt][data-en]')) node.textContent=tr(node.dataset.pt,node.dataset.en);
    if(allowed&&!view.hidden)load();
  }).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
})();
