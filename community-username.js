/* Profile-only availability feedback. Postgres UNIQUE(username) remains authoritative. */
(() => {
  'use strict';
  const input=document.getElementById('profileUsername');
  const form=document.getElementById('profileForm');
  if(!input||!form)return;
  input.required=true;
  input.autocapitalize='off';input.spellcheck=false;
  const pt=()=>document.documentElement.lang.startsWith('pt');
  const t=(br,en)=>pt()?br:en;
  const hint=document.createElement('p');hint.id='username-help';hint.className='community-hint';
  hint.dataset.pt='Seu @usuário é exclusivo e identifica sua conta nas menções. O nome público pode se repetir.';
  hint.dataset.en='Your @username is unique and identifies your account in mentions. Public names may repeat.';
  const status=document.createElement('p');status.id='username-availability';status.className='community-username-status';
  status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  input.after(hint,status);
  input.setAttribute('aria-describedby',[input.getAttribute('aria-describedby'),hint.id,status.id].filter(Boolean).join(' '));
  const say=(br,en,kind='pending')=>{status.dataset.pt=br;status.dataset.en=en;status.dataset.state=kind;status.textContent=t(br,en);};
  hint.textContent=t(hint.dataset.pt,hint.dataset.en);
  const db=window.supabase?.createClient?.('https://znenamrszhjsiztllcit.supabase.co',
    'sb_publishable_3VRFxwtDuYq4ETHs4xof8g_Fp3GRl6c',
    {auth:{flowType:'pkce',detectSessionInUrl:false,persistSession:true,autoRefreshToken:true}});
  let sequence=0,timer=0,allowOnce='';
  const valid=value=>/^[a-z0-9_]{3,24}$/.test(value);
  async function check(value,token){
    try{
      const [auth,match]=await Promise.all([
        db.auth.getUser(),db.from('profiles').select('id').eq('username',value).limit(1)
      ]);
      if(token!==sequence||input.value.trim()!==value)return false;
      if(auth.error||!auth.data?.user||match.error){
        say('Não foi possível verificar o usuário. Tente novamente.','Could not check this username. Please try again.','error');return false;
      }
      const free=!match.data?.length||match.data[0].id===auth.data.user.id;
      say(free?'Este @usuário está disponível.':'Este @usuário já está em uso.',
          free?'This @username is available.':'This @username is already taken.',free?'available':'taken');
      return free;
    }catch(error){
      if(token===sequence)say('Não foi possível verificar o usuário. Tente novamente.','Could not check this username. Please try again.','error');
      return false;
    }
  }
  function inspect(){
    window.clearTimeout(timer);const token=++sequence;allowOnce='';
    const value=input.value.trim();
    if(!value){say('Escolha um @usuário para salvar seu perfil.','Choose a @username to save your profile.','error');return;}
    if(!valid(value)){
      say('Use de 3 a 24 letras minúsculas, números ou _.','Use 3–24 lowercase letters, numbers or _.','error');return;
    }
    if(!db){say('Verificação indisponível. Atualize a página.','Availability check unavailable. Refresh the page.','error');return;}
    say('Verificando disponibilidade…','Checking availability…');
    timer=window.setTimeout(()=>check(value,token),300);
  }
  input.addEventListener('input',inspect);
  input.addEventListener('focus',inspect);
  input.addEventListener('change',inspect);
  // Capture before the existing profile handler, including on a rushed submit.
  form.addEventListener('submit',event=>{
    const value=input.value.trim();
    if(allowOnce===value&&valid(value)){allowOnce='';return;}
    event.preventDefault();event.stopImmediatePropagation();
    if(!valid(value)){inspect();input.reportValidity();return;}
    window.clearTimeout(timer);const token=++sequence;
    if(!db){say('Verificação indisponível. Atualize a página.','Availability check unavailable. Refresh the page.','error');return;}
    say('Confirmando disponibilidade…','Confirming availability…');
    check(value,token).then(free=>{
      if(!free||token!==sequence||input.value.trim()!==value)return;
      allowOnce=value;
      form.requestSubmit();
    });
  },true);
  new MutationObserver(()=>{
    hint.textContent=t(hint.dataset.pt,hint.dataset.en);
    if(status.dataset.pt)status.textContent=t(status.dataset.pt,status.dataset.en);
  }).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
})();