/* Cyber-Us: authenticated fanart submissions. Files stay PRIVATE until manual review. */
(() => {
  'use strict';
  const preview = document.querySelector('.fanarts-form-preview');
  const disabledNote = document.getElementById('fanarts-disabled-note');
  if (!preview || !disabledNote) return;
  const pt = () => document.documentElement.lang.startsWith('pt');
  const t = (br,en) => pt() ? br : en;
  const $ = id => document.getElementById(id);
  const status = document.createElement('p');
  status.id = 'fanart-upload-status'; status.className = 'fanarts-hint';
  status.setAttribute('role','status'); status.setAttribute('aria-live','polite');
  preview.after(status);
  const say = (br,en,error=false) => {
    status.dataset.pt=br; status.dataset.en=en; status.textContent=t(br,en);
    status.classList.toggle('error',error);
  };
  const fieldset=preview.querySelector('fieldset');
  if (!fieldset) return;
  const form=document.createElement('form'); form.id='fanart-upload-form';
  fieldset.replaceWith(form); form.appendChild(fieldset);
  const button=fieldset.querySelector('button');
  const artist=$('fanarts-name'),title=$('fanarts-art-title'),image=$('fanarts-image');
  const link=$('fanarts-artist-link'),regionSelect=$('fanarts-country');
  const showRegion=$('fanarts-publish-country'),rights=$('fanarts-original');
  const region=document.createElement('input');
  region.id=regionSelect.id; region.type='text'; region.maxLength=80;
  region.placeholder=t('Prefiro não informar','Prefer not to say');
  regionSelect.replaceWith(region);
  artist.required=title.required=image.required=rights.required=true;
  image.accept='image/jpeg,image/png,image/webp';
  link.maxLength=500; link.placeholder='https://';
  const accentLabel=document.createElement('label'); accentLabel.htmlFor='fanarts-accent';
  accentLabel.dataset.pt='Cor da moldura'; accentLabel.dataset.en='Frame color';
  accentLabel.textContent=t(accentLabel.dataset.pt,accentLabel.dataset.en);
  const accent=document.createElement('select'); accent.id='fanarts-accent';
  for (const [value,br,en] of [['random','Aleatória','Random'],['blue','Azul','Blue'],['red','Vermelho','Red'],['green','Verde','Green']]) {
    const option=document.createElement('option'); option.value=value;
    option.dataset.pt=br; option.dataset.en=en; option.textContent=t(br,en);
    accent.appendChild(option);
  }
  image.before(accentLabel,accent);
  // Shared, explicit vocabulary: artist-controlled classification, never inferred.
  const tagGroup=document.createElement('fieldset');
  tagGroup.className='fanarts-tag-choices';
  const tagLegend=document.createElement('legend');
  tagLegend.dataset.pt='Tags da obra (opcional; até 8)';
  tagLegend.dataset.en='Artwork tags (optional; up to 8)';
  tagLegend.textContent=t(tagLegend.dataset.pt,tagLegend.dataset.en);
  tagGroup.append(tagLegend);
  const tagInputs=[];
  for (const [value,br,en] of [
    ['Auará','Auará','Auará'],['Kaubi','Kaubi','Kaubi'],['Óete','Óete','Óete'],
    ['Sistema','Sistema','Sistema'],['Trojan','Trojan','Trojan'],['Malware','Malware','Malware'],
    ['OC','OC (personagem original)','OC (original character)'],
    ['Ships','Ships / casais','Ships / pairings'],
    ['Crossover','Crossover','Crossover'],['Grupo','Grupo','Group'],
    ['Swap','Swap','Swap'],['E se...','E se...','What if...'],
    ['Fofo','Fofo','Cute'],['Sério','Sério','Serious'],['Chibi','Chibi','Chibi']
  ]) {
    const label=document.createElement('label');label.className='fanarts-check';
    const input=document.createElement('input');input.type='checkbox';input.value=value;
    input.name='fanart-tag';
    const caption=document.createElement('span');
    caption.dataset.pt=br;caption.dataset.en=en;caption.textContent=t(br,en);
    label.append(input,caption);tagGroup.append(label);tagInputs.push(input);
  }
  tagGroup.addEventListener('change',event=>{
    if (tagInputs.filter(input=>input.checked).length>8) {
      event.target.checked=false;
      say('Escolha no máximo 8 tags por obra.','Choose up to 8 tags per artwork.',true);
    }
  });
  image.before(tagGroup);
  const conversion=document.createElement('label'); conversion.className='fanarts-check';
  const conversionCheck=document.createElement('input'); conversionCheck.type='checkbox'; conversionCheck.required=true;
  const conversionText=document.createElement('span');
  conversionText.dataset.pt='Autorizo reprocessar a imagem para retirar metadados, preservando as dimensões (a compactação pode mudar).';
  conversionText.dataset.en='I allow re-encoding to remove image metadata while retaining dimensions (compression may change).';
  conversionText.textContent=t(conversionText.dataset.pt,conversionText.dataset.en);
  conversion.append(conversionCheck,conversionText); button.before(conversion);
  const terms=document.createElement('p'); terms.className='fanarts-hint';
  terms.dataset.pt='Sua arte fica privada até a revisão; seus direitos permanecem seus. Se aprovada, concederá somente permissão para exibição com crédito neste site. Você pode solicitar retirada em “Meus envios”. Até 5 MB, 4096 × 4096 pixels e 3 envios por 24 horas.';
  terms.dataset.en='Your art stays private until review; you retain your copyright. Approval grants only permission to display it here with credit. Request withdrawal via “My submissions”. Up to 5 MB, 4096 × 4096 pixels and 3 submissions per 24 hours.';
  terms.textContent=t(terms.dataset.pt,terms.dataset.en); button.before(terms);
  button.type='submit';
  const setButton=(br,en)=>{button.dataset.pt=br;button.dataset.en=en;button.textContent=t(br,en);};
  const kicker=document.querySelector('.fanarts-kicker');
  const gating=ready=>{
    fieldset.disabled=!ready;
    if (ready) {
      setButton('Enviar para análise','Submit for review');
      disabledNote.dataset.pt='Envios abertos para contas autenticadas e verificadas. A publicação só acontece após aprovação.';
      disabledNote.dataset.en='Submissions are open to signed-in, verified accounts. Publication only happens after approval.';
      if (kicker) {kicker.dataset.pt='Envios abertos · Moderação antes da publicação'; kicker.dataset.en='Submissions open · Reviewed before publication'; kicker.textContent=t(kicker.dataset.pt,kicker.dataset.en);}
    }
    disabledNote.textContent=t(disabledNote.dataset.pt,disabledNote.dataset.en);
  };
  gating(false);
  if (!window.supabase?.createClient || !window.crypto?.randomUUID) {
    say('O serviço de envio não está disponível.','Submission service is unavailable.',true); return;
  }
  const db=window.supabase.createClient('https://znenamrszhjsiztllcit.supabase.co',
    'sb_publishable_3VRFxwtDuYq4ETHs4xof8g_Fp3GRl6c',
    {auth:{flowType:'pkce',detectSessionInUrl:false,persistSession:true,autoRefreshToken:true}});
  window.CyberUsFanartsDb=db;
  let userId=null,busy=false;
  async function checkAccess() {
    if (busy) return;
    gating(false);
    const {data:auth,error:authError}=await db.auth.getUser();
    if (authError || !auth?.user || !auth.user.email_confirmed_at) {
      userId=null;
      say('Entre com uma conta de e-mail confirmado na comunidade para enviar sua arte.',
          'Sign in with a verified email account in the community to submit art.');
      return;
    }
    const [ban,schema]=await Promise.all([
      db.rpc('is_banned'),db.from('fanart_submissions').select('id').limit(0)
    ]);
    if (ban.error || schema.error || ban.data===true) {
      userId=null;
      say(ban.data===true?'Sua conta não pode enviar fanarts.':'Não foi possível verificar as permissões de envio.',
          ban.data===true?'Your account cannot submit fanart.':'Submission permissions could not be verified.',true);
      return;
    }
    userId=auth.user.id; gating(true);
    say('Envie uma imagem sua ou que você tenha autorização para compartilhar.',
        'Upload your own artwork or work you have permission to share.');
  }
  async function prepareImage(file) {
    if (!file || !['image/jpeg','image/png','image/webp'].includes(file.type) || file.size>5*1024*1024)
      throw new Error('Unsupported file size or MIME type');
    const bytes=new Uint8Array(await file.slice(0,12).arrayBuffer());
    const png=bytes.slice(0,8).join(',')==='137,80,78,71,13,10,26,10';
    const jpg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
    const webp=String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP';
    if (!(file.type==='image/png'&&png || file.type==='image/jpeg'&&jpg || file.type==='image/webp'&&webp))
      throw new Error('Image type mismatch');
    const bitmap=await createImageBitmap(file);
    try {
      if (!bitmap.width || !bitmap.height || bitmap.width>4096 || bitmap.height>4096)
        throw new Error('Invalid image dimensions');
      const canvas=document.createElement('canvas'); canvas.width=bitmap.width; canvas.height=bitmap.height;
      const context=canvas.getContext('2d',{alpha:true});
      if (!context) throw new Error('Image processing unavailable');
      context.drawImage(bitmap,0,0);
      const mime=file.type==='image/png'?'image/png':'image/webp';
      const encoded=await new Promise(resolve=>canvas.toBlob(resolve,mime,0.96));
      if (!encoded || encoded.type!==mime || encoded.size>5*1024*1024)
        throw new Error('Image re-encoding unavailable or larger than 5 MB');
      return {file:encoded,extension:mime==='image/png'?'png':'webp',mime};
    } finally {bitmap.close();}
  }
  form.addEventListener('submit',async event=>{
    event.preventDefault(); if (busy || !userId || !form.reportValidity()) return;
    busy=true; fieldset.disabled=true;
    say('Preparando imagem e reservando envio…','Preparing image and reserving submission…');
    let reserved=false;
    try {
      const name=artist.value.trim(),workTitle=title.value.trim(),place=region.value.trim();
      const url=link.value.trim();
      const tags=tagInputs.filter(input=>input.checked).map(input=>input.value);
      if (!name || name.length>60 || !workTitle || workTitle.length>100 || (showRegion.checked&&!place) || tags.length>8)
        throw new Error('Invalid title, name, location consent or tags');
      if (url && new URL(url).protocol!=='https:') throw new Error('HTTPS required');
      const prepared=await prepareImage(image.files[0]);
      const id=crypto.randomUUID(),path=`${userId}/${id}.${prepared.extension}`;
      const {error:recordError}=await db.from('fanart_submissions').insert({
        id,user_id:userId,artist_name:name,title:workTitle,region:place||null,
        show_region:!!place&&showRegion.checked,artist_link:url||null,
        accent:accent.value,tags,extension:prepared.extension,image_path:path,rights_confirmed:rights.checked
      });
      if (recordError) throw recordError;
      reserved=true;
      say('Enviando imagem para armazenamento privado…','Uploading image to private storage…');
      const {error:uploadError}=await db.storage.from('fanart-pending').upload(path,prepared.file,
        {contentType:prepared.mime,upsert:false,cacheControl:'0'});
      if (uploadError) throw uploadError;
      say('Fanart recebida! Ela aguarda análise e ainda não é pública.',
          'Fanart received! It awaits review and is not public yet.');
      form.reset();
      window.dispatchEvent(new Event('cyberus:fanart-uploaded'));
    } catch (error) {
      console.error('Fanart submission error:',error);
      say(reserved?'O upload falhou depois da reserva. Não tente repetidamente: o envio reservado conta no limite diário. Solicite ajuda à moderação.':'Não foi possível enviar. Confira formato, limite e campos e tente novamente.',
          reserved?'Upload failed after reservation. Do not retry repeatedly: the reservation counts toward the daily limit. Contact moderation.':'Submission failed. Check the file format, limits and fields, then try again.',true);
    } finally {busy=false; fieldset.disabled=!userId;}
  });
  db.auth.onAuthStateChange(()=>{if (!busy) setTimeout(checkAccess,0);});
  checkAccess();
})();
