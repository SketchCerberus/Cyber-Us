/* Fanart details: public gallery rows only. Private submissions and account IDs never enter public UI. */
(() => {
  'use strict';
  const gallery=document.querySelector('.fanarts-gallery');
  if (!gallery) return;
  const pt=()=>document.documentElement.lang.startsWith('pt');
  const t=(a,b)=>pt()?a:b;
  const db=window.supabase?.createClient?.('https://znenamrszhjsiztllcit.supabase.co',
    'sb_publishable_3VRFxwtDuYq4ETHs4xof8g_Fp3GRl6c',
    {auth:{flowType:'pkce',detectSessionInUrl:false,persistSession:true,autoRefreshToken:true}});
  const detail=document.createElement('section');
  detail.className='fanarts-detail';detail.id='artwork';detail.hidden=true;
  detail.setAttribute('aria-labelledby','fanarts-detail-title');
  const header=document.createElement('div');header.className='fanarts-detail-header';
  const title=document.createElement('h2');title.id='fanarts-detail-title';
  const close=document.createElement('button');close.className='fanarts-view-work';close.type='button';
  close.dataset.pt='Voltar à galeria';close.dataset.en='Back to gallery';
  const image=document.createElement('img');image.className='fanarts-detail-image';
  const credit=document.createElement('p');credit.className='fanarts-hint';
  const community=document.createElement('section');community.className='fanarts-interactions';
  const communityHeading=document.createElement('h3');
  communityHeading.dataset.pt='Votos e comentários';communityHeading.dataset.en='Votes and comments';
  const interactionStatus=document.createElement('p');interactionStatus.className='fanarts-hint';
  interactionStatus.setAttribute('role','status');interactionStatus.setAttribute('aria-live','polite');
  const votes=document.createElement('div');votes.className='fanarts-votes';
  const up=document.createElement('button');const down=document.createElement('button');
  up.type=down.type='button';up.className=down.className='fanarts-view-work';
  up.dataset.pt='Gostei';up.dataset.en='Upvote';
  down.dataset.pt='Não gostei';down.dataset.en='Downvote';
  votes.append(up,down);
  const commentHeading=document.createElement('h3');
  commentHeading.dataset.pt='Comentários';commentHeading.dataset.en='Comments';
  const comments=document.createElement('div');comments.className='fanarts-comments';
  const form=document.createElement('form');form.className='fanarts-comment-form';
  const nameLabel=document.createElement('label');nameLabel.htmlFor='fanart-comment-name';
  nameLabel.dataset.pt='Nome público';nameLabel.dataset.en='Public display name';
  const name=document.createElement('input');name.id='fanart-comment-name';
  name.required=true;name.maxLength=60;name.autocomplete='nickname';
  const bodyLabel=document.createElement('label');bodyLabel.htmlFor='fanart-comment-body';
  bodyLabel.dataset.pt='Seu comentário';bodyLabel.dataset.en='Your comment';
  const body=document.createElement('textarea');body.id='fanart-comment-body';
  body.required=true;body.maxLength=1000;body.rows=4;
  const consent=document.createElement('label');consent.className='fanarts-check';
  const consentInput=document.createElement('input');consentInput.type='checkbox';consentInput.required=true;
  const consentText=document.createElement('span');
  consentText.dataset.pt='Autorizo a publicação deste nome e comentário. Não incluirei informações pessoais de terceiros.';
  consentText.dataset.en='I agree to publish this name and comment. I will not include other people’s private information.';
  consent.append(consentInput,consentText);
  const submit=document.createElement('button');submit.type='submit';submit.className='fanarts-view-work';
  submit.dataset.pt='Enviar comentário';submit.dataset.en='Post comment';
  const commentNote=document.createElement('p');commentNote.className='fanarts-hint';
  commentNote.dataset.pt='Para votar ou comentar, entre com uma conta de e-mail confirmado. Até 10 comentários por hora; comentários podem ser removidos pela moderação.';
  commentNote.dataset.en='Sign in with a verified email to vote or comment. Up to 10 comments per hour; moderation may remove comments.';
  form.append(nameLabel,name,bodyLabel,body,consent,submit,commentNote);
  community.append(communityHeading,interactionStatus,votes,commentHeading,comments,form);
  header.append(title,close);detail.append(header,image,credit,community);gallery.after(detail);
  let selected=null,request=0,voteCounts={upvotes:0,downvotes:0};
  function setStatus(br,en,error=false) {
    interactionStatus.dataset.pt=br;interactionStatus.dataset.en=en;
    interactionStatus.textContent=t(br,en);
    interactionStatus.classList.toggle('error',error);
  }
  function syncCredit(card) {
    const caption=card?.querySelector('figcaption');
    if(!caption)return;
    credit.textContent=caption.querySelector('.fanarts-gallery-artist')?.textContent||'';
    const region=caption.querySelector(':scope > span:not(.fanarts-gallery-artist)');
    if(region)credit.append(document.createTextNode(` · ${region.textContent}`));
  }
  function syncLanguage() {
    document.querySelectorAll('.fanarts-view-work').forEach(button=>{
      if(button.dataset.pt&&button.dataset.en&&button!==up&&button!==down)button.textContent=t(button.dataset.pt,button.dataset.en);
    });
    up.textContent=t(up.dataset.pt,up.dataset.en)+` (${voteCounts.upvotes})`;
    down.textContent=t(down.dataset.pt,down.dataset.en)+` (${voteCounts.downvotes})`;
    for(const node of [communityHeading,commentHeading,nameLabel,bodyLabel,consentText,submit,commentNote])
      node.textContent=t(node.dataset.pt,node.dataset.en);
    if(interactionStatus.dataset.pt)interactionStatus.textContent=t(interactionStatus.dataset.pt,interactionStatus.dataset.en);
    comments.querySelectorAll('[data-pt][data-en]').forEach(node=>node.textContent=t(node.dataset.pt,node.dataset.en));
    comments.querySelectorAll('time[datetime]').forEach(node=>{
      node.textContent=new Intl.DateTimeFormat(pt()?'pt-BR':'en',{dateStyle:'medium'}).format(new Date(node.dateTime));
    });
    if(selected)syncCredit(selected);
  }
  async function access() {
    if(!db)return null;
    const {data,error}=await db.auth.getUser();
    if(error||!data?.user?.email_confirmed_at)return null;
    const ban=await db.rpc('is_banned');
    if(ban.error||ban.data===true)return null;
    return data.user;
  }
  async function loadVotes(id,token) {
    if(!db)return;
    const {data,error}=await db.from('fanart_vote_totals').select('upvotes,downvotes').eq('submission_id',id).maybeSingle();
    if(token!==request)return;
    if(error){votes.hidden=true;setStatus('Votação indisponível.','Voting is unavailable.',true);return;}
    votes.hidden=false;
    voteCounts={upvotes:Number(data?.upvotes)||0,downvotes:Number(data?.downvotes)||0};
    up.textContent=t(up.dataset.pt,up.dataset.en)+` (${voteCounts.upvotes})`;
    down.textContent=t(down.dataset.pt,down.dataset.en)+` (${voteCounts.downvotes})`;
  }
  async function loadComments(id,token) {
    if(!db)return;
    const {data,error}=await db.from('fanart_comments')
      .select('id,display_name,body,created_at').eq('submission_id',id)
      .order('created_at',{ascending:false}).limit(30);
    if(token!==request)return;
    comments.replaceChildren();
    if(error){form.hidden=true;setStatus('Comentários indisponíveis.','Comments are unavailable.',true);return;}
    form.hidden=false;
    if(!data?.length){
      const empty=document.createElement('p');empty.className='fanarts-hint';
      empty.dataset.pt='Ainda não há comentários. Seja a primeira pessoa a comentar.';
      empty.dataset.en='No comments yet. Be the first to comment.';
      empty.textContent=t(empty.dataset.pt,empty.dataset.en);comments.append(empty);return;
    }
    for(const item of data){
      const article=document.createElement('article');article.className='fanarts-comment';
      // Only the public comment ID is surfaced for reporting; NEVER author_id.
      article.dataset.commentId=String(item.id);
      const author=document.createElement('strong');author.textContent=item.display_name;
      const date=document.createElement('time');date.dateTime=item.created_at;
      date.textContent=new Intl.DateTimeFormat(pt()?'pt-BR':'en',{dateStyle:'medium'}).format(new Date(item.created_at));
      const text=document.createElement('p');text.textContent=item.body;
      article.append(author,date,text);comments.append(article);
    }
  }
  async function loadInteractions() {
    if(!selected)return;
    const token=++request,id=selected.dataset.submissionId;
    setStatus('Carregando interações…','Loading interactions…');
    if(!db){votes.hidden=form.hidden=true;setStatus('Interações indisponíveis.','Interactions unavailable.',true);return;}
    votes.hidden=form.hidden=false;
    await Promise.all([loadVotes(id,token),loadComments(id,token)]);
    if(token===request&&!interactionStatus.classList.contains('error'))setStatus('Uma conta verificada é necessária para interagir.','A verified account is required to participate.');
  }
  async function vote(value) {
    if(!selected||!db||votes.hidden)return;
    const id=selected.dataset.submissionId,token=request;
    const user=await access();
    if(token!==request||selected?.dataset.submissionId!==id)return;
    if(!user){setStatus('Entre com uma conta verificada e não suspensa para votar.','Sign in with a verified, unsuspended account to vote.',true);return;}
    up.disabled=down.disabled=true;
    const {error}=await db.from('fanart_votes').upsert({submission_id:id,user_id:user.id,value},{onConflict:'submission_id,user_id'});
    up.disabled=down.disabled=false;
    if(token!==request)return;
    if(error){setStatus('Não foi possível registrar seu voto.','Could not save your vote.',true);return;}
    setStatus('Voto registrado! Você pode trocar sua escolha.','Vote saved! You can change your choice.');
    await loadVotes(id,token);
  }
  up.addEventListener('click',()=>vote(1));down.addEventListener('click',()=>vote(-1));
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    if(!selected||!db||!form.reportValidity())return;
    const id=selected.dataset.submissionId,token=request;
    const user=await access();
    if(token!==request||selected?.dataset.submissionId!==id)return;
    if(!user){setStatus('Entre com uma conta verificada e não suspensa para comentar.','Sign in with a verified, unsuspended account to comment.',true);return;}
    const display_name=name.value.trim(),message=body.value.trim();
    if(!display_name||display_name.length>60||!message||message.length>1000||!consentInput.checked)return;
    submit.disabled=true;
    const {error}=await db.from('fanart_comments').insert({submission_id:id,author_id:user.id,display_name,body:message});
    submit.disabled=false;
    if(token!==request)return;
    if(error){setStatus('Não foi possível enviar. Verifique o limite de comentários e tente novamente.','Could not post. Check the comment limit and try again.',true);return;}
    form.reset();
    setStatus('Comentário publicado. Obrigado por participar!','Comment published. Thanks for participating!');
    await loadComments(id,token);
  });
  function openCard(card) {
    const original=card.querySelector('img'),caption=card.querySelector('figcaption');
    if(!original||!caption||!original.complete||!original.naturalWidth)return;
    const id=card.dataset.submissionId;
    if(!/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(id||''))return;
    selected=card;
    title.textContent=caption.querySelector('strong')?.textContent||'';
    syncCredit(card);
    image.src=original.src;image.alt=original.alt;
    detail.hidden=false;
    const url=new URL(location.href);url.searchParams.set('art',id);
    history.replaceState(history.state,'',url.pathname+url.search+url.hash);
    detail.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
    close.focus({preventScroll:true});
    loadInteractions();
  }
  function closeCard() {
    ++request;detail.hidden=true;selected=null;image.removeAttribute('src');
    const url=new URL(location.href);url.searchParams.delete('art');
    history.replaceState(history.state,'',url.pathname+url.search+url.hash);
    gallery.scrollIntoView({behavior:'auto'});
  }
  close.addEventListener('click',closeCard);
  gallery.addEventListener('click',event=>{
    const button=event.target.closest('.fanarts-view-work');
    if(button){const card=button.closest('.fanarts-gallery-work');if(card)openCard(card);}
  });
  const observer=new MutationObserver(()=>{
    gallery.querySelectorAll('.fanarts-gallery-work').forEach(card=>{
      if(card.querySelector('.fanarts-view-work'))return;
      const button=document.createElement('button');button.type='button';
      button.className='fanarts-view-work';button.dataset.pt='Ver arte';button.dataset.en='View artwork';
      button.textContent=t(button.dataset.pt,button.dataset.en);
      card.querySelector('figcaption')?.append(button);
    });
    if(selected&&!selected.isConnected)closeCard();
    const requested=new URLSearchParams(location.search).get('art');
    if(requested&&!selected){
      const card=[...gallery.querySelectorAll('.fanarts-gallery-work')].find(item=>item.dataset.submissionId===requested);
      if(card?.querySelector('img')?.naturalWidth)openCard(card);
    }
  });
  observer.observe(gallery,{childList:true,subtree:true});
  gallery.addEventListener('load',event=>{
    if(event.target.tagName==='IMG'){
      const requested=new URLSearchParams(location.search).get('art');
      const card=event.target.closest('.fanarts-gallery-work');
      if(requested&&!selected&&card?.dataset.submissionId===requested)openCard(card);
    }
  },true);
  new MutationObserver(syncLanguage).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
  syncLanguage();
})();
