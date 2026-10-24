/* Public profile images only. Storage and profile RLS enforce ownership and bans. */
(() => {
  'use strict';
  const presets = {robot:'🤖',fox:'🦊',cat:'🐱',rocket:'🚀',star:'⭐',moon:'🌙'};
  const assetBase = document.currentScript?.src || document.baseURI;
  const characters = {
    kaubi:{name:'Kaubi',src:'assets/avatars/kaubi.png'},
    'kaubi-2':{name:'Kaubi',expression:2,src:'assets/avatars/kaubi-2.png'},'kaubi-3':{name:'Kaubi',expression:3,src:'assets/avatars/kaubi-3.png'},
    auara:{name:'Auará',src:'assets/avatars/auara.png'},
    'auara-2':{name:'Auará',expression:2,src:'assets/avatars/auara-2.png'},'auara-3':{name:'Auará',expression:3,src:'assets/avatars/auara-3.png'},
    oete:{name:'Óete',src:'assets/avatars/oete.png'},
    'oete-2':{name:'Óete',expression:2,src:'assets/avatars/oete-2.png'},'oete-3':{name:'Óete',expression:3,src:'assets/avatars/oete-3.png'}
  };
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
  function photoURL(projectUrl, profile) {
    const version = profile?.avatar?.startsWith('upload:') ? profile.avatar.slice(7) : '';
    return uuid.test(profile?.id || '') && uuid.test(version)
      ? `${projectUrl}/storage/v1/object/public/community-avatars/${profile.id}/avatar.jpg?v=${version}` : null;
  }
  async function preparePhoto(file) {
    if (!file || !['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 5*1024*1024) throw new Error('PHOTO_FORMAT');
    const bitmap = await createImageBitmap(file);
    try {
      if (!bitmap.width || !bitmap.height || bitmap.width*bitmap.height > 40000000) throw new Error('PHOTO_FORMAT');
      const canvas = document.createElement('canvas');
      canvas.width=canvas.height=256;
      const ctx=canvas.getContext('2d');
      ctx.fillStyle='#11151d';ctx.fillRect(0,0,256,256);
      const side=Math.min(bitmap.width,bitmap.height);
      ctx.drawImage(bitmap,(bitmap.width-side)/2,(bitmap.height-side)/2,side,side,0,0,256,256);
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.85));
      if (!blob || blob.size>262144) throw new Error('PHOTO_FORMAT');
      return blob;
    } finally { bitmap.close(); }
  }
  window.CyberUsAvatars = {photoURL,preparePhoto,create({db,projectUrl,state,t}) {
    const make=(tag,cls,text)=>{const el=document.createElement(tag);el.className=cls||'';if(text!==undefined)el.textContent=text;return el;};
    function image(profile) {
      const wrapper=make('span','profile-avatar',presets[profile?.avatar] || '👤');
      wrapper.setAttribute('aria-hidden','true');
      const character=Object.hasOwn(characters,profile?.avatar) ? characters[profile.avatar] : null;
      const url=character ? new URL(character.src,assetBase).href : photoURL(projectUrl,profile);
      if(url){const img=make('img');img.alt='';img.width=img.height=48;img.loading='lazy';img.src=url;img.addEventListener('error',()=>img.remove(),{once:true});wrapper.append(img);}
      return wrapper;
    }
    const host=document.getElementById('memberAccount');
    if(!host)return {image,render(){}};
    const form=make('form','avatar-editor');
    const heading=make('h3'),preview=make('div','avatar-preview'),choices=make('div','avatar-choices');
    const hint=make('p','community-hint'),label=make('label'),file=make('input'),save=make('button','action'),remove=make('button','community-link'),status=make('p','community-notice');
    file.type='file';file.id='avatarFile';file.accept='image/jpeg,image/png,image/webp';label.htmlFor=file.id;
    save.type='submit';remove.type='button';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
    let chosen=null,current=null,locked=false,previewURL=null;
    const buttons=[];
    const choiceLabel=character=>character.expression?t('Expressão ','Expression ')+character.expression:t('Original','Original');
    function clearPreviewURL(){if(previewURL){URL.revokeObjectURL(previewURL);previewURL=null;}}
    function showSelection(){clearPreviewURL();preview.replaceChildren(image({id:state.user?.id,avatar:chosen}));buttons.forEach(([key,button])=>button.setAttribute('aria-pressed',String(key===chosen)));}
    for(const [key,character] of Object.entries(characters)){
      const button=make('button','avatar-choice');button.type='button';button.setAttribute('data-avatar',key);
      button.append(image({avatar:key}),make('span','avatar-choice-label',`${character.name} · ${choiceLabel(character)}`));
      button.addEventListener('click',()=>{chosen=key;file.value='';showSelection();});choices.append(button);buttons.push([key,button]);
    }
    const text=()=>{buttons.forEach(([key,button])=>{const character=characters[key],name=`${character.name} · ${choiceLabel(character)}`;button.setAttribute('aria-label',t('Escolher avatar: ','Choose avatar: ')+name);button.title=name;button.querySelector?.('.avatar-choice-label')&&(button.querySelector('.avatar-choice-label').textContent=name);});heading.textContent=t('Escolha seu avatar','Choose your avatar');label.textContent=t('Ou envie uma foto','Or upload a photo');save.textContent=t('Confirmar avatar','Confirm avatar');remove.textContent=t('Remover imagem','Remove picture');hint.textContent=t('Prévia do avatar selecionado. Sua imagem será pública nos comentários.','Preview your selected avatar. Your image will be public in comments.');};
    text();document.getElementById('languageChoices')?.addEventListener('click',text);
    form.append(heading,preview,choices,label,file,hint,save,remove,status);host.insertBefore(form,document.getElementById('profileForm'));
    function controls(){form.querySelectorAll('input,button').forEach(el=>{el.disabled=locked||state.banned||!state.user;});}
    const message=(text,error=false)=>{status.textContent=text;status.classList.toggle('error',error);};
    file.addEventListener('change',()=>{
      const selected=file.files[0];if(!selected)return;
      if(!['image/jpeg','image/png','image/webp'].includes(selected.type)||selected.size>5*1024*1024){file.value='';message(t('Escolha JPG, PNG ou WebP de até 5 MB.','Choose JPG, PNG or WebP up to 5 MB.'),true);return;}
      clearPreviewURL();previewURL=URL.createObjectURL(selected);const img=make('img','avatar-local-preview');img.src=previewURL;img.alt=t('Prévia do recorte','Crop preview');preview.replaceChildren(img);
      buttons.forEach(([,button])=>button.setAttribute('aria-pressed','false'));message('');
    });
    async function persist(removeImage=false){
      if(locked||!state.user||state.banned)return;
      const userId=state.user.id;locked=true;controls();message(t('Salvando…','Saving…'));
      try{
        let next=removeImage?null:chosen;
        const selected=!removeImage&&file.files[0];
        if(selected){
          const blob=await preparePhoto(selected);
          if(state.user?.id!==userId)throw new Error('SESSION_CHANGED');
          const {error}=await db.storage.from('community-avatars').upload(`${userId}/avatar.jpg`,blob,{upsert:true,contentType:'image/jpeg',cacheControl:'60'});
          if(error)throw error;next='upload:'+crypto.randomUUID();
        }
        if(state.user?.id!==userId)throw new Error('SESSION_CHANGED');
        const {data,error}=await db.from('profiles').update({avatar:next}).eq('id',userId).select('avatar').single();
        if(error)throw error;
        current=chosen=data.avatar;file.value='';showSelection();
        // Also removes orphaned uploads after a failed profile save.
        if(!next?.startsWith('upload:')){
          const {error:cleanup}=await db.storage.from('community-avatars').remove([`${userId}/avatar.jpg`]);
          if(cleanup){message(t('Avatar salvo. Não foi possível apagar a foto antiga; tente Remover imagem novamente.','Avatar saved. Could not delete the old photo; try Remove picture again.'),true);return;}
        }
        message(t('Avatar atualizado.','Avatar updated.'));
      }catch(error){message(error.message==='PHOTO_FORMAT'?t('Use uma imagem válida JPG, PNG ou WebP de até 5 MB e 40 megapixels.','Use a valid JPG, PNG or WebP image up to 5 MB and 40 megapixels.'):t('Não foi possível salvar a imagem. Tente novamente.','Could not save the picture. Please try again.'),true);}
      finally{locked=false;controls();}
    }
    form.addEventListener('submit',event=>{event.preventDefault();persist();});
    remove.addEventListener('click',()=>persist(true));
    return {image,render(profile){controls();if(!locked){current=chosen=profile?.avatar||null;file.value='';showSelection();}}};
  }};
})();
