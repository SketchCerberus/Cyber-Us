/* Account-owned fanart status. Withdrawal is a REQUEST, not instant deletion. */
(() => {
  'use strict';
  const anchor=document.querySelector('.fanarts-submission');
  const db=window.CyberUsFanartsDb;
  if (!anchor || !db) return;
  const pt=()=>document.documentElement.lang.startsWith('pt');
  const t=(a,b)=>pt()?a:b;
  // Keep the artwork-file label adjacent to its input after adding the optional tags.
  const tags=anchor.querySelector('.fanarts-tag-choices');
  const fileLabel=anchor.querySelector('label[for="fanarts-image"]');
  if(tags&&fileLabel)fileLabel.before(tags);
  const section=document.createElement('section');
  section.className='fanarts-guidelines'; section.id='my-fanarts';
  const heading=document.createElement('h2'); heading.id='my-fanarts-heading';
  section.setAttribute('aria-labelledby',heading.id);
  const info=document.createElement('p'); info.className='fanarts-hint';
  const status=document.createElement('p'); status.className='fanarts-hint';
  status.setAttribute('role','status'); status.setAttribute('aria-live','polite');
  const list=document.createElement('div'); list.className='fanarts-my-list';
  section.append(heading,info,status,list); anchor.after(section);
  const copy=(node,br,en)=>{
    node.dataset.pt=br; node.dataset.en=en; node.textContent=t(br,en);
  };
  copy(heading,'Meus envios','My submissions');
  copy(info,'Acompanhe apenas as suas obras. “Solicitar retirada” avisa a moderação; a exclusão do arquivo e de possíveis cópias publicadas é feita manualmente.','Only you can see your submissions. “Request withdrawal” alerts moderation; the file and any published copies must be removed manually.');
  let sequence=0;
  const states={
    pending:['Aguardando análise','Awaiting review'],
    approved:['Aprovada','Approved'],
    rejected:['Não aprovada','Not approved'],
    withdrawal_requested:['Retirada solicitada','Withdrawal requested']
  };
  async function load() {
    const token=++sequence;
    list.replaceChildren();
    copy(status,'Carregando seus envios…','Loading your submissions…');
    const {data:auth,error:authError}=await db.auth.getUser();
    if (token!==sequence) return;
    if (authError || !auth?.user) {
      copy(status,'Entre na sua conta para acompanhar seus envios.','Sign in to track your submissions.'); return;
    }
    const uid=auth.user.id;
    const {data, error}=await db.from('fanart_submissions')
      .select('id,title,created_at,status').eq('user_id',uid).order('created_at',{ascending:false}).limit(30);
    if (token!==sequence) return;
    if (error) {
      copy(status,'Não foi possível consultar os envios.','Could not load submissions.'); return;
    }
    if (!data?.length) {
      copy(status,'Você ainda não enviou nenhuma fanart.','You have not submitted fanart yet.'); return;
    }
    copy(status,`${data.length} envio(s) encontrado(s).`,`${data.length} submission(s) found.`);
    for (const work of data) {
      const card=document.createElement('article'); card.className='fanarts-my-card';
      const title=document.createElement('strong'); title.textContent=work.title;
      const state=document.createElement('p');
      const pair=states[work.status]||['Status indisponível','Status unavailable'];
      copy(state,pair[0],pair[1]);
      const date=document.createElement('small');
      date.textContent=new Intl.DateTimeFormat(pt()?'pt-BR':'en',{dateStyle:'medium'}).format(new Date(work.created_at));
      card.append(title,state,date);
      if (work.status==='pending' || work.status==='approved') {
        const button=document.createElement('button'); button.type='button';
        copy(button,'Solicitar retirada','Request withdrawal');
        button.addEventListener('click',async()=>{
          button.disabled=true;
          copy(status,'Registrando pedido de retirada…','Recording withdrawal request…');
          const {data:changed,error:withdrawError}=await db.from('fanart_submissions')
            .update({status:'withdrawal_requested'})
            .eq('id',work.id).eq('user_id',uid).select('id');
          if (withdrawError || !changed?.length) {
            copy(status,'Não foi possível registrar a retirada. Atualize e tente novamente.','Could not record withdrawal. Refresh and try again.');
            button.disabled=false;
          } else {
            await load();
          }
        });
        card.appendChild(button);
      }
      list.appendChild(card);
    }
  }
  // This event fires only after the private image upload succeeds.
  const thankYou=document.createElement('div');
  thankYou.className='fanarts-thank-you';thankYou.hidden=true;
  thankYou.setAttribute('role','status');thankYou.setAttribute('aria-live','polite');
  const thankTitle=document.createElement('h2');
  const thankMessage=document.createElement('p');
  copy(thankTitle,'Obrigado por compartilhar sua arte!','Thank you for sharing your artwork!');
  copy(thankMessage,'Sua fanart foi recebida e aguarda a aprovação da moderação. Ela ainda não está pública. Você pode acompanhar o andamento em Meus envios.','Your fanart was received and awaits moderator approval. It is not public yet. Track its status under My submissions.');
  thankYou.append(thankTitle,thankMessage); anchor.after(thankYou);
  window.addEventListener('cyberus:fanart-uploaded',()=>{
    thankYou.hidden=false;
    thankYou.scrollIntoView({behavior:'auto',block:'nearest'});
    load();
  });
  db.auth.onAuthStateChange(()=>setTimeout(load,0));
  new MutationObserver(()=>{
    for (const node of [heading,info,status,thankTitle,thankMessage]) {
      node.textContent=t(node.dataset.pt||'',node.dataset.en||'');
    }
    list.querySelectorAll('[data-pt][data-en]').forEach(node=>{node.textContent=t(node.dataset.pt,node.dataset.en);});
  }).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
  load();
})();
