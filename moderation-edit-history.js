/* Previous comment bodies are fetched only through moderator-authorized RPCs. */
(() => {
  'use strict';
  const workspace=document.getElementById('moderationWorkspace');
  if(!workspace||!window.supabase?.createClient)return;
  const db=window.supabase.createClient('https://znenamrszhjsiztllcit.supabase.co',
    'sb_publishable_3VRFxwtDuYq4ETHs4xof8g_Fp3GRl6c',
    {auth:{flowType:'pkce',detectSessionInUrl:false,persistSession:true,autoRefreshToken:true}});
  const pt=()=>document.documentElement.lang.startsWith('pt');
  const t=(br,en)=>pt()?br:en;
  const loc=(element,br,en)=>{element.dataset.pt=br;element.dataset.en=en;element.textContent=t(br,en);return element;};
  const el=(tag,cls)=>{const node=document.createElement(tag);if(cls)node.className=cls;return node;};
  const section=el('section','moderation-edit-history');section.hidden=true;
  const heading=el('div','moderation-selection-heading');
  const title=loc(el('h2'),'Histórico privado de edições','Private edit history');
  title.id='moderationEditHistoryHeading';section.setAttribute('aria-labelledby',title.id);
  const refresh=loc(el('button','community-action'),'Atualizar histórico','Refresh history');refresh.type='button';
  heading.append(title,refresh);
  const hint=loc(el('p','community-hint'),
    'Somente moderadores podem consultar versões anteriores de comentários dos episódios, respostas e fanarts. Até 30 edições recentes.',
    'Only moderators can review previous versions of episode, reply and fanart comments. Showing up to 30 recent edits.');
  const status=el('p','community-notice');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  const list=el('ol','comment-list');section.append(heading,hint,status,list);workspace.append(section);
  let allowed=false,identity=0,request=0;
  const say=(br,en,error=false)=>{status.dataset.pt=br;status.dataset.en=en;status.textContent=t(br,en);status.classList.toggle('error',error);};
  const date=value=>new Intl.DateTimeFormat(pt()?'pt-BR':'en',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value));
  async function load(){
    const token=++request;if(!allowed||workspace.hidden)return;
    refresh.disabled=true;say('Carregando histórico…','Loading edit history…');list.replaceChildren();
    const result=await db.rpc('moderation_recent_comment_edits',{p_limit:30});
    if(token!==request||!allowed)return;
    refresh.disabled=false;
    if(result.error){say('Não foi possível consultar o histórico.','Could not load edit history.',true);return;}
    if(!result.data?.length){say('Nenhuma edição registrada.','No edits recorded yet.');return;}
    say(`${result.data.length} edição(ões) recente(s).`,`${result.data.length} recent edit(s).`);
    for(const entry of result.data){
      const row=el('li','comment-item');
      const header=el('p','comment-meta');
      header.textContent=`${entry.kind==='fanart'?t('Fanart','Fanart'):t('Episódio / resposta','Episode / reply')} · ${date(entry.edited_at)} · ${entry.comment_id}`;
      const old=el('p','comment-body');old.textContent=entry.prior_text;
      const versions=loc(el('button','community-action'),'Ver versões anteriores','See earlier versions');versions.type='button';
      const details=el('ol','comment-list moderation-edit-versions');details.hidden=true;
      versions.addEventListener('click',async()=>{
        if(!allowed||workspace.hidden)return;
        if(!details.hidden){details.hidden=true;versions.setAttribute('aria-expanded','false');return;}
        versions.disabled=true;
        const outcome=await db.rpc('moderation_comment_edit_history',{
          p_kind:entry.kind,p_id:entry.comment_id});
        versions.disabled=false;
        if(outcome.error){say('Não foi possível carregar as versões.','Could not load earlier versions.',true);return;}
        details.replaceChildren();
        for(const item of outcome.data||[]){
          const li=el('li','comment-item');const stamp=el('time','comment-meta');
          stamp.dateTime=item.edited_at;stamp.textContent=date(item.edited_at);
          const content=el('p','comment-body');content.textContent=item.prior_text;
          li.append(stamp,content);details.append(li);
        }
        details.hidden=false;versions.setAttribute('aria-expanded','true');
      });
      versions.setAttribute('aria-expanded','false');row.append(header,old,versions,details);list.append(row);
    }
  }
  async function verify(){
    const token=++identity;allowed=false;++request;section.hidden=true;list.replaceChildren();
    const auth=await db.auth.getUser();
    if(token!==identity||auth.error||!auth.data?.user)return;
    const result=await db.rpc('is_moderator');
    if(token!==identity||result.error||result.data!==true)return;
    allowed=true;section.hidden=false;load();
  }
  refresh.addEventListener('click',load);
  db.auth.onAuthStateChange(()=>setTimeout(verify,0));
  new MutationObserver(()=>{
    section.querySelectorAll('[data-pt][data-en]').forEach(item=>item.textContent=t(item.dataset.pt,item.dataset.en));
    section.querySelectorAll('time').forEach(item=>item.textContent=date(item.dateTime));
    if(allowed&&!section.hidden)load();
  }).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
  verify();
})();
