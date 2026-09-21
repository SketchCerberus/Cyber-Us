/* Fanart submissions: no public upload unless the private schema has been deployed.
   Images are re-encoded with the artist's consent to strip embedded metadata.
   Pending originals are never shown in the gallery. */
(() => {
  'use strict';
  const preview = document.querySelector('.fanarts-form-preview');
  const disabledNote = document.getElementById('fanarts-disabled-note');
  if (!preview || !disabledNote) return;
  const pt = () => document.documentElement.lang.startsWith('pt');
  const t = (br,en) => pt() ? br : en;
  const $ = id => document.getElementById(id);
  const say = (br,en,error=false) => {
    status.dataset.pt = br; status.dataset.en = en;
    status.textContent = t(br,en); status.classList.toggle('error',error);
  };
  const status = document.createElement('p');
  status.id = 'fanart-upload-status';
  status.className = 'fanarts-hint';
  status.setAttribute('role','status');
  status.setAttribute('aria-live','polite');
  preview.after(status);
  const form = document.createElement('form');
  form.id = 'fanart-upload-form';
  const fieldset = preview.querySelector('fieldset');
  if (!fieldset) return;
  fieldset.replaceWith(form);
  form.appendChild(fieldset);
  const button = fieldset.querySelector('button');
  const artist = $('fanarts-name'), title = $('fanarts-art-title');
  const image = $('fanarts-image'), link = $('fanarts-artist-link');
  const regionSelect = $('fanarts-country'), showRegion = $('fanarts-publish-country');
  const rights = $('fanarts-original');
  const region = document.createElement('input');
  region.id = regionSelect.id; region.type = 'text'; region.maxLength = 80;
  region.placeholder = t('Prefiro não informar','Prefer not to say');
  regionSelect.replaceWith(region);
  artist.required = title.required = image.required = rights.required = true;
  image.accept = 'image/jpeg,image/png,image/webp';
  link.maxLength = 500;
  link.placeholder = 'https://';
  const accentLabel = document.createElement('label');
  accentLabel.htmlFor = 'fanarts-accent';
  accentLabel.dataset.pt = 'Cor da moldura'; accentLabel.dataset.en = 'Frame color';
  accentLabel.textContent = t(accentLabel.dataset.pt,accentLabel.dataset.en);
  const accent = document.createElement('select'); accent.id = 'fanarts-accent';
  for (const [value,br,en] of [['random','Aleatória','Random'],['blue','Azul','Blue'],['red','Vermelho','Red'],['green','Verde','Green']]) {
    const option = document.createElement('option'); option.value = value;
    option.dataset.pt = br; option.dataset.en = en; option.textContent = t(br,en);
    accent.appendChild(option);
  }
  image.before(accentLabel,accent);
  const conversion = document.createElement('label');
  conversion.className = 'fanarts-check';
  const conversionCheck = document.createElement('input'); conversionCheck.type = 'checkbox'; conversionCheck.required = true;
  const conversionText = document.createElement('span');
  conversionText.dataset.pt = 'Autorizo reprocessar a imagem para retirar metadados, preservando as dimensões (pode alterar a compactação).';
  conversionText.dataset.en = 'I allow image re-encoding to remove metadata while retaining its dimensions (compression may change).';
  conversionText.textContent = t(conversionText.dataset.pt,conversionText.dataset.en);
  conversion.append(conversionCheck,conversionText);
  button.before(conversion);
  const terms = document.createElement('p');
  terms.className = 'fanarts-hint';
  terms.dataset.pt = 'Sua fanart ficará privada até a revisão. Você mantém os direitos autorais e concede apenas permissão para exibi-la com crédito no site, se aprovada. Para solicitar remoção, use o canal da comunidade. Máximo: 5 MB e 4096 × 4096 pixels; até 3 envios em 24 horas.';
  terms.dataset.en = 'Your art stays private until review. You keep copyright and grant only permission to display it with credit on this site if approved. Request removal through the community contact channel. Limit: 5 MB and 4096 × 4096 pixels; up to 3 submissions per 24 hours.';
  terms.textContent = t(terms.dataset.pt,terms.dataset.en);
  button.before(terms);
  button.type = 'submit';
  const setButton = (br,en) => { button.dataset.pt=br; button.dataset.en=en; button.textContent=t(br,en); };
  const gating = (ready) => {
    fieldset.disabled = !ready;
    if (ready) {
      setButton('Enviar para análise','Submit for review');
      disabledNote.dataset.pt='Envios abertos para contas autenticadas. Sua obra só será publicada depois de aprovada.';
      disabledNote.dataset.en='Submissions are open to signed-in accounts. Art is published only after approval.';
      document.querySelector('.fanarts-kicker')?.setAttribute('data-pt','Envios sujeitos a revisão');
      document.querySelector('.fanarts-kicker')?.setAttribute('data-en','Submissions are reviewed');
    }
    disabledNote.textContent=t(disabledNote.dataset.pt,disabledNote.dataset.en);
  };
  gating(false);
  if (!window.supabase?.createClient || !window.crypto?.randomUUID) {
    say('O serviço de envio não está disponível.','Submission service is unavailable.',true);
    return;
  }
  const db = window.supabase.createClient('https://znenamrszhjsiztllcit.supabase.co',
    'sb_publishable_3VRFxwtDuYq4ETHs4xof8g_Fp3GRl6c',
    {auth:{flowType:'pkce',detectSessionInUrl:false,persistSession:true,autoRefreshToken:true}});
  let userId = null;
  let busy = false;
  async function checkAccess() {
    gating(false);
    const {data:auth,error:authError} = await db.auth.getUser();
    if (authError || !auth?.user || !auth.user.email_confirmed_at) {
      userId = null;
      say('Entre com uma conta de e-mail confirmado na comunidade para enviar sua arte.',
          'Sign in with a verified email account in the community to submit art.');
      return;
    }
    const [ban, schema] = await Promise.all([
      db.rpc('is_banned'),
      db.from('fanart_submissions').select('id').limit(0)
    ]);
    if (ban.error || schema.error || ban.data === true) {
      userId = null;
      say(ban.data === true ? 'Sua conta não pode enviar fanarts.' : 'Os envios ainda não foram ativados com segurança.',
          ban.data === true ? 'Your account cannot submit fanart.' : 'Submissions have not been safely enabled yet.',true);
      return;
    }
    userId = auth.user.id;
    gating(true);
    say('Envie uma imagem original sua ou que você tenha autorização para compartilhar.',
        'Upload your original artwork or work you have permission to share.');
  }
  async function prepareImage(file) {
    if (!file || !['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 5*1024*1024)
      throw new Error(t('Use PNG, JPG ou WebP com até 5 MB.','Use PNG, JPG or WebP up to 5 MB.'));
    const bytes = new Uint8Array(await file.slice(0,12).arrayBuffer());
    const png = bytes.slice(0,8).join(',') === '137,80,78,71,13,10,26,10';
    const jpg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
    const webp = String.fromCharCode(...bytes.slice(0,4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8,12)) === 'WEBP';
    if (!(file.type === 'image/png' && png || file.type === 'image/jpeg' && jpg || file.type === 'image/webp' && webp))
      throw new Error(t('O formato real do arquivo não corresponde à extensão.','Actual file format does not match the selected type.'));
    const bitmap = await createImageBitmap(file);
    try {
      if (bitmap.width < 1 || bitmap.height < 1 || bitmap.width > 4096 || bitmap.height > 4096)
        throw new Error(t('Dimensões inválidas: máximo de 4096 × 4096 pixels.','Invalid dimensions: maximum 4096 × 4096 pixels.'));
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width; canvas.height = bitmap.height;
      canvas.getContext('2d',{alpha:true}).drawImage(bitmap,0,0);
      const mime = file.type === 'image/png' ? 'image/png' : 'image/webp';
      const encoded = await new Promise(resolve => canvas.toBlob(resolve,mime,0.96));
      if (!encoded || encoded.size > 5*1024*1024)
        throw new Error(t('A imagem processada excede 5 MB. Experimente exportá-la com outro tamanho antes de enviar.',
                          'Processed image exceeds 5 MB. Export it at another size before submitting.'));
      return {file:encoded,extension:mime === 'image/png' ? 'png' : 'webp',mime};
    } finally {bitmap.close();}
  }
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy || !userId || !form.reportValidity()) return;
    busy=true; fieldset.disabled=true;
    say('Preparando a imagem e reservando seu envio…','Preparing image and reserving your submission…');
    let id=null;
    try {
      const name=artist.value.trim(), workTitle=title.value.trim(), place=region.value.trim();
      const url=link.value.trim();
      if (!name || name.length>60 || !workTitle || workTitle.length>100 || (showRegion.checked && !place))
        throw new Error(t('Confira nome, título e consentimento da região.','Check name, title and region consent.'));
      if (url && new URL(url).protocol !== 'https:') throw new Error(t('O link do artista precisa usar HTTPS.','Artist link must use HTTPS.'));
      const prepared=await prepareImage(image.files[0]);
      id=crypto.randomUUID();
      const path=`${userId}/${id}.${prepared.extension}`;
      const {error:recordError}=await db.from('fanart_submissions').insert({
        id,user_id:userId,artist_name:name,title:workTitle,region:place || null,
        show_region:!!place && showRegion.checked,artist_link:url || null,
        accent:accent.value,extension:prepared.extension,image_path:path,rights_confirmed:rights.checked
      });
      if (recordError) throw recordError;
      say('Enviando imagem privada…','Uploading private image…');
      const {error:uploadError}=await db.storage.from('fanart-pending').upload(path,prepared.file,
        {contentType:prepared.mime,upsert:false,cacheControl:'0'});
      if (uploadError) {
        await db.from('fanart_submissions').delete().eq('id',id).eq('user_id',userId);
        throw uploadError;
      }
      say('Fanart recebida! Ela está aguardando análise e ainda não é pública.',
          'Fanart received! It is awaiting review and is not public yet.');
      form.reset();
    } catch (error) {
      console.error('Fanart submission error:',error);
      say('Não foi possível enviar. Confira o arquivo e tente novamente. Se o erro persistir, avise a moderação.',
          'Upload failed. Check the file and try again. If it persists, contact moderation.',true);
    } finally {busy=false; fieldset.disabled=!userId;}
  });
  db.auth.onAuthStateChange(() => { if (!busy) setTimeout(checkAccess,0); });
  checkAccess();
})();
