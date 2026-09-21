/* Authenticated fanart submissions; private preview before moderator approval. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const preview = document.querySelector('.fanarts-form-preview');
  if (!preview || !window.supabase?.createClient) return;
  const db = window.supabase.createClient('https://znenamrszhjsiztllcit.supabase.co',
    'sb_publishable_3VRFxwtDuYq4ETHs4xof8g_Fp3GRl6c',
    {auth:{flowType:'pkce',detectSessionInUrl:false,persistSession:true,autoRefreshToken:true}});
  const pt = () => document.documentElement.lang.startsWith('pt');
  const t = (br,en) => pt()?br:en;
  const el = (tag,cls,text) => {const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
  const fieldset=preview.querySelector('fieldset');
  const form=el('form','fanarts-live-form');
  preview.append(form);form.append(fieldset);
  const submit=fieldset.querySelector('button');
  submit.type='submit';
  const name=$('fanarts-name'),title=$('fanarts-art-title'),image=$('fanarts-image'),country=$('fanarts-country');
  const region=el('input');region.id=country.id;region.type='text';region.maxLength=80;
  country.replaceWith(region);
  const artistLink=$('fanarts-artist-link'),consent=$('fanarts-original'),showRegion=$('fanarts-publish-country');
  name.required=true;name.minLength=2;title.required=true;title.minLength=2;image.required=true;
  const accentLabel=el('label');accentLabel.htmlFor='fanarts-live-accent';
  const accent=el('select');accent.id='fanarts-live-accent';
  for (const [value,br,en] of [['random','Aleatória','Random'],['blue','Azul','Blue'],['red','Vermelha','Red'],['green','Verde','Green']]) {
    const option=el('option','',t(br,en));option.value=value;option.dataset.pt=br;option.dataset.en=en;accent.append(option);
  }
  const tagsLabel=el('label');tagsLabel.htmlFor='fanarts-live-tags';
  const tags=el('input');tags.id='fanarts-live-tags';tags.type='text';tags.maxLength=260;
  image.after(accentLabel,accent,tagsLabel,tags);
  const guide=el('p','fanarts-hint');form.append(guide);
  const authStatus=el('p','fanarts-live-notice');authStatus.setAttribute('role','status');authStatus.setAttribute('aria-live','polite');
  preview.before(authStatus);
  const mine=el('section','fanarts-mine');mine.id='fanarts-my-work';
  const mineHeading=el('h3');const mineList=el('ol','comment-list');mine.append(mineHeading,mineList);preview.after(mine);
  const gallery=document.querySelector('.fanarts-gallery');
  const galleryStatus=el('p','fanarts-live-notice');galleryStatus.setAttribute('role','status');
  const grid=el('div','fanarts-approved-gallery');gallery.append(galleryStatus,grid);
  let person=null, allowed=false, authTicket=0;
  const status=(text,error=false)=>{authStatus.textContent=text;authStatus.classList.toggle('error',error);};
  const localDate=value=>new Intl.DateTimeFormat(pt()?'pt-BR':'en',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value));
  const statuses={pending:['Aguardando revisão','Awaiting review'],approved:['Publicada','Published'],
    rejected:['Rejeitada','Rejected'],removed:['Removida','Removed'],withdrawn:['Retirada','Withdrawn']};
  const statusLabel=value=>(statuses[value]||[value,value])[pt()?0:1];
  function copy() {
    const set=(node,br,en)=>{node.dataset.pt=br;node.dataset.en=en;node.textContent=t(br,en);};
    set(document.querySelector('.fanarts-kicker'),'Envie sua fanart para análise · publicação somente após aprovação','Submit your fanart for review · publication only after approval');
    set(document.querySelector('.fanarts-submission .eyebrow'),'ENVIOS COM REVISÃO','MODERATED SUBMISSIONS');
    set($('fanarts-submit-title'),'Envie sua fanart.','Submit your fanart.');
    set($('fanarts-disabled-note'),'Entre na sua conta para enviar. Nenhuma arte aparece ao público antes da aprovação.','Sign in to submit. No artwork appears publicly until approved.');
    set(document.querySelector('.fanarts-form-preview legend'),'Envio para revisão','Submit for review');
    set(submit,'Enviar para revisão','Submit for review');
    set(document.querySelector('label[for="fanarts-country"]'),'País ou região autodeclarado (opcional)','Self-reported country or region (optional)');
    set(document.querySelector('label[for="fanarts-original"] span'),
      'Confirmo que tenho direitos ou autorização para esta arte e autorizo sua exibição no Cyber-Us, mantendo minha autoria. Posso retirar a obra depois.',
      'I own this artwork or have permission to share it and authorize display on Cyber-Us while retaining my rights. I can withdraw it later.');
    set(document.querySelector('.fanarts-guidelines h2'),'Regras e privacidade','Rules and privacy');
    set(document.querySelector('.fanarts-guidelines p'),
      'Somente PNG, JPG ou WebP. A imagem é convertida em WebP sem metadados, limitada a 1,5 MB e 1600 px. Arquivos e dados ficam privados durante a revisão; após aprovação, imagem, título, nome artístico, tags e link informado ficam públicos. País/região só é exibido com autorização separada. É possível retirar uma obra; o arquivo permanece privado até o pedido de exclusão definitiva à equipe. Não envie dados pessoais na imagem.',
      'PNG, JPG or WebP only. Images are converted to metadata-free WebP, limited to 1.5 MB and 1600 px. Files and details stay private during review; after approval, the image, title, artist name, tags and supplied link become public. Region is displayed only with separate consent. You can withdraw a work; its private file is retained until a permanent deletion request to staff. Avoid personal data in artwork.');
    accentLabel.textContent=t('Cor de destaque','Accent color');tagsLabel.textContent=t('Tags separadas por vírgula (até 8)','Comma-separated tags (up to 8)');
    guide.textContent=t('Até 3 obras aguardando revisão e 5 envios por dia. Obras retiradas deixam de aparecer imediatamente; URLs temporárias de imagens já emitidas podem durar até 1 minuto.',
      'Up to 3 works awaiting review and 5 submissions per day. Withdrawn works disappear immediately; existing temporary image URLs may last up to one minute.');
    mineHeading.textContent=t('Seus envios','Your submissions');
    for(const option of accent.options)option.textContent=pt()?option.dataset.pt:option.dataset.en;
  }
  async function signed(path,seconds=60) {
    const response=await db.storage.from('cyber-fanarts').createSignedUrl(path,seconds);
    return response.error?null:response.data?.signedUrl||null;
  }
  async function loadGallery() {
    galleryStatus.textContent=t('Carregando obras aprovadas…','Loading approved artwork…');
    const response=await db.from('fanarts').select('id,title,artist,region,show_region,artist_url,accent,tags,image_path')
      .eq('status','approved').order('reviewed_at',{ascending:false}).limit(48);
    grid.replaceChildren();
    if(response.error){galleryStatus.textContent=t('Não foi possível carregar a galeria.','Could not load the gallery.');return;}
    const rows=response.data||[];
    gallery.querySelector('.fanarts-empty').hidden=!!rows.length;
    const heading=$('gallery-title');
    if(rows.length){heading.dataset.pt='Fanarts da comunidade';heading.dataset.en='Community fanart';heading.textContent=t(heading.dataset.pt,heading.dataset.en);}
    else {heading.dataset.pt='Em breve, arte de todo lugar.';heading.dataset.en='Art from everywhere, coming soon.';heading.textContent=t(heading.dataset.pt,heading.dataset.en);}
    galleryStatus.textContent=rows.length?t(`${rows.length} obra(s) aprovada(s).`,`${rows.length} approved work(s).`):'';
    for(const art of rows) {
      const url=await signed(art.image_path);
      if(!url)continue;
      const card=el('figure','fanarts-gallery-work');
      card.dataset.accent=['blue','red','green'].includes(art.accent)?art.accent:'blue';
      const photo=el('img');photo.src=url;photo.loading='lazy';photo.alt=`${art.title} — ${art.artist}`;photo.referrerPolicy='no-referrer';
      const caption=el('figcaption');caption.append(el('strong','',art.title),el('span','',art.artist));
      if(art.show_region&&art.region)caption.append(el('span','',art.region));
      if(Array.isArray(art.tags)&&art.tags.length)caption.append(el('span','fanarts-tags-line',art.tags.map(tag=>'#'+tag).join(' ')));
      if(art.artist_url) {
        try {const urlObject=new URL(art.artist_url);if(urlObject.protocol==='https:'&&urlObject.hostname) {
          const link=el('a','',t('Página do artista ↗','Artist page ↗'));link.href=urlObject.href;
          link.target='_blank';link.rel='noopener noreferrer';caption.append(link);
        }}catch{}
      }
      photo.addEventListener('error',()=>card.remove());
      card.append(photo,caption);grid.append(card);
    }
  }
  async function loadMine(ticket=authTicket) {
    mineList.replaceChildren();
    if(!person){mine.hidden=true;return;}
    mine.hidden=false;
    const response=await db.rpc('my_fanarts');
    if(ticket!==authTicket)return;
    if(response.error){mineList.append(el('li','fanarts-live-notice',t('Não foi possível carregar seus envios.','Could not load your submissions.')));return;}
    if(!response.data?.length){mineList.append(el('li','fanarts-live-notice',t('Você ainda não enviou obras.','You have not submitted artwork yet.')));return;}
    for(const art of response.data){
      const item=el('li','fanarts-mine-item');
      item.append(el('strong','',art.title),el('p','',`${statusLabel(art.status)} · ${localDate(art.created_at)}`));
      if(art.review_note)item.append(el('p','',`${t('Nota da moderação','Moderator note')}: ${art.review_note}`));
      if(['pending','approved'].includes(art.status)){
        const withdraw=el('button','community-action',t('Retirar obra','Withdraw artwork'));withdraw.type='button';
        withdraw.addEventListener('click',async()=>{
          if(!window.confirm(t('Retirar esta obra da galeria/fila?','Withdraw this artwork from gallery/queue?')))return;
          withdraw.disabled=true;
          const result=await db.rpc('withdraw_fanart',{p_id:art.id});
          if(result.error){status(t('Não foi possível retirar. Atualize a página.','Could not withdraw. Refresh the page.'),true);withdraw.disabled=false;return;}
          await Promise.all([loadMine(),loadGallery()]);
        });item.append(withdraw);
      }
      mineList.append(item);
    }
  }
  async function refreshAuth() {
    const ticket=++authTicket;
    fieldset.disabled=true;allowed=false;person=null;mine.hidden=true;
    const identity=await db.auth.getUser();
    if(ticket!==authTicket)return;
    if(identity.error||!identity.data?.user){status(t('Entre na sua conta para enviar fanarts.','Sign in to submit fanart.'));
      const link=el('a','',t('Entrar ou cadastrar-se','Sign in or create an account'));link.href='comunidade.html';authStatus.append(' ',link);return;}
    person=identity.data.user;
    const guard=await db.rpc('fanart_submission_allowed');
    if(ticket!==authTicket)return;
    allowed=!guard.error&&guard.data===true;
    fieldset.disabled=!allowed;
    status(allowed?t('Sua conta pode enviar obras para revisão.','Your account can submit for review.'):
      t('Envios indisponíveis: confira se há banimento ou limite de envios atingido.','Submissions unavailable: check for a ban or submission limit.'));
    await loadMine(ticket);
  }
  async function encodeImage(file) {
    if(!file||!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>5242880)throw Error('file');
    const bitmap=await createImageBitmap(file);
    try {
      const scale=Math.min(1,1600/bitmap.width,1600/bitmap.height);
      const canvas=document.createElement('canvas');
      canvas.width=Math.max(1,Math.round(bitmap.width*scale));
      canvas.height=Math.max(1,Math.round(bitmap.height*scale));
      const ctx=canvas.getContext('2d');if(!ctx)throw Error('canvas');
      ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',0.82));
      if(!blob||blob.type!=='image/webp'||blob.size>1572864)throw Error('size');
      return new File([blob],'fanart.webp',{type:'image/webp'});
    }finally{bitmap.close();}
  }
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(!allowed||!person)return;
    const entries=tags.value.split(',').map(tag=>tag.trim().replace(/^#+/,'')).filter(Boolean);
    if(entries.length>8||entries.some(tag=>tag.length>32)||new Set(entries.map(tag=>tag.toLowerCase())).size!==entries.length){
      status(t('Use até oito tags distintas com até 32 caracteres.','Use up to eight distinct tags, each at most 32 characters.'),true);return;}
    const link=artistLink.value.trim();
    if(link){try{const uri=new URL(link);if(uri.protocol!=='https:'||!uri.hostname||uri.username||uri.password)throw Error('url');}
      catch{status(t('O link do artista precisa começar com HTTPS.','Artist link must use HTTPS.'),true);return;}}
    if(!consent.checked){status(t('Confirme a autorização da obra.','Confirm permission for the artwork.'),true);return;}
    submit.disabled=true;status(t('Preparando imagem e enviando…','Preparing image and submitting…'));
    try{
      const safe=await encodeImage(image.files[0]);
      const payload=new FormData();payload.append('image',safe);
      payload.append('metadata',JSON.stringify({title:title.value.trim(),artist:name.value.trim(),region:region.value.trim(),
        showRegion:showRegion.checked,artistUrl:link,accent:accent.value,tags:entries,consent:true}));
      const response=await db.functions.invoke('fanart-submit',{body:payload});
      if(response.error||response.data?.error)throw response.error||Error(response.data.error);
      form.reset();accent.value='random';
      status(t('Fanart recebida! Ela ficará privada até a moderação aprovar.','Fanart received! It stays private until moderator approval.'));
      await loadMine();await refreshAuth();
    }catch(error){status(t('Não foi possível enviar. Verifique a imagem (WebP até 1,5 MB após conversão) e tente novamente.','Could not submit. Check image (WebP up to 1.5 MB after conversion) and try again.'),true);}
    finally{submit.disabled=false;}
  });
  new MutationObserver(()=>{copy();if(person)loadMine();loadGallery();})
    .observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
  db.auth.onAuthStateChange(()=>setTimeout(refreshAuth,0));
  copy();refreshAuth();loadGallery();
})();
