/* Staff report queue; public access is blocked by fanart_comment_reports RLS. */
(() => {
  'use strict';
  const view=document.getElementById('moderationFanartsView');
  const tab=document.getElementById('moderationFanartsTab');
  if(!view||!tab||!window.supabase?.createClient)return;
  const db=window.supabase.createClient('https://znenamrszhjsiztllcit.supabase.co',
    'sb_publishable_3VRFxwtDuYq4ETHs4xof8g_Fp3GRl6c',
    {auth:{flowType:'pkce',detectSessionInUrl:false,persistSession:true,autoRefreshToken:true}});
  const pt=()=>document.documentElement.lang.startsWith('pt');
  const t=(br,en)=>pt()?br:en;
  const local=(node,br,en)=>{node.dataset.pt=br;node.dataset.en=en;node.textContent=t(br,en);return node;};
  const section=document.createElement('section');section.className='moderation-fanart-reports';
  const heading=document.createElement('div');heading.className='moderation-selection-heading';
  const title=local(document.createElement('h3'),'Denúncias de comentários','Comment reports');
  title.id='fanart-reports-heading';section.setAttribute('aria-labelledby',title.id);
  const refresh=local(document.createElement('button'),'Atualizar denúncias','Refresh reports');
  refresh.type='button';refresh.className='community-action';heading.append(title,refresh);
  const hint=local(document.createElement('p'),'Denúncias são privadas. Dispense denúncias sem infração ou remova comentários com motivo registrado. Até 100 denúncias abertas recentes.',
    'Reports are private. Dismiss unfounded reports or remove comments with an audited reason. Showing up to 100 recent open reports.');
  hint.className='community-hint';
  const status=document.createElement('p');status.className='community-notice';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  const list=document.createElement('ol');list.className='moderation-fanart-report-list';
  section.append(heading,hint,status,list);view.append(section);
  let allowed=false,ticket=0;
  const say=(br,en,error=false)=>{status.dataset.pt=br;status.dataset.en=en;status.textContent=t(br,en);status.classList.toggle('error',error);};
  async function checkStaff(){
    const current=++ticket;allowed=false;
    const auth=await db.auth.getUser();
    if(current!==ticket||auth.error||!auth.data?.user)return false;
    const permission=await db.rpc('is_moderator');
    if(current!==ticket)return false;
    allowed=!permission.error&&permission.data===true;
    return allowed;
  }
  async function load(){
    const current=++ticket;list.replaceChildren();
    if(!allowed||view.hidden)return;
    refresh.disabled=true;say('Carregando denúncias…','Loading reports…');
    const reports=await db.from('fanart_comment_reports')
      .select('id,comment_id,reason,status,created_at').eq('status','open')
      .order('created_at',{ascending:false}).limit(100);
    if(current!==ticket||!allowed){refresh.disabled=false;return;}
    if(reports.error){refresh.disabled=false;say('Não foi possível carregar denúncias.','Could not load reports.',true);return;}
    const ids=[...new Set((reports.data||[]).map(row=>row.comment_id))];
    const comments=ids.length?await db.from('fanart_comments')
      .select('id,submission_id,display_name,body').in('id',ids):{data:[],error:null};
    if(current!==ticket||!allowed){refresh.disabled=false;return;}
    refresh.disabled=false;
    if(comments.error){say('Não foi possível carregar comentários denunciados.','Could not load reported comments.',true);return;}
    const byId=new Map((comments.data||[]).map(item=>[item.id,item]));
    const rows=reports.data||[];
    if(!rows.length){say('Nenhuma denúncia em aberto.','No open reports.');return;}
    say(`${rows.length} denúncia(s) em aberto.`,`${rows.length} open report(s).`);
    for(const report of rows){
      const item=byId.get(report.comment_id);
      const li=document.createElement('li');
      const meta=document.createElement('p');meta.className='comment-meta';
      meta.textContent=`#${report.id} · ${new Intl.DateTimeFormat(pt()?'pt-BR':'en',{dateStyle:'medium',timeStyle:'short'}).format(new Date(report.created_at))}`;
      const reason=document.createElement('p');reason.className='comment-body';reason.textContent=`${t('Motivo','Reason')}: ${report.reason}`;
      const author=document.createElement('strong');author.textContent=item?.display_name||t('Comentário removido','Removed comment');
      const body=document.createElement('p');body.className='comment-body';body.textContent=item?.body||t('Este comentário não está mais disponível.','This comment is no longer available.');
      const dismiss=local(document.createElement('button'),'Dispensar denúncia','Dismiss report');
      dismiss.type='button';dismiss.className='community-action';
      dismiss.addEventListener('click',async()=>{
        if(!allowed||view.hidden||!window.confirm(t('Dispensar esta denúncia?','Dismiss this report?')))return;
        dismiss.disabled=true;
        const result=await db.from('fanart_comment_reports')
          .update({status:'dismissed',handled_at:new Date().toISOString()}).eq('id',report.id).eq('status','open');
        if(result.error){say('Não foi possível dispensar a denúncia.','Could not dismiss report.',true);dismiss.disabled=false;return;}
        await load();say('Denúncia dispensada.','Report dismissed.');
      });
      li.append(meta,reason,author,body,dismiss);
      if(item){
        const remove=local(document.createElement('button'),'Remover comentário','Remove comment');
        remove.type='button';remove.className='community-action danger';
        remove.addEventListener('click',async()=>{
          if(!allowed||view.hidden)return;
          const explanation=window.prompt(t('Motivo da remoção (3–500 caracteres):','Reason for removal (3–500 characters):'));
          if(explanation===null)return;
          const why=explanation.trim();
          if(why.length<3||why.length>500){say('Informe um motivo de 3 a 500 caracteres.','Enter a reason between 3 and 500 characters.',true);return;}
          if(!window.confirm(t('Remover este comentário e registrar a ação?','Remove this comment and audit the action?')))return;
          remove.disabled=true;
          const result=await db.rpc('moderate_fanart_comment',{p_comment_id:item.id,p_reason:why});
          if(result.error||result.data!==true){say('Não foi possível remover o comentário.','Could not remove comment.',true);remove.disabled=false;return;}
          await load();say('Comentário removido e ação registrada.','Comment removed and action logged.');
        });li.append(remove);
      }
      list.append(li);
    }
  }
  tab.addEventListener('click',async()=>{if(await checkStaff()&&!view.hidden)load();});
  refresh.addEventListener('click',async()=>{if(await checkStaff()&&!view.hidden)load();});
  db.auth.onAuthStateChange(()=>{allowed=false;++ticket;list.replaceChildren();});
  new MutationObserver(()=>{
    section.querySelectorAll('[data-pt][data-en]').forEach(node=>node.textContent=t(node.dataset.pt,node.dataset.en));
    if(allowed&&!view.hidden)load();
  }).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
})();
