/* Optional @username suggestions; only server-resolved usernames generate notifications. */
(() => {
  'use strict';
  if(!window.supabase?.createClient)return;
  const db=window.supabase.createClient('https://znenamrszhjsiztllcit.supabase.co',
    'sb_publishable_3VRFxwtDuYq4ETHs4xof8g_Fp3GRl6c',
    {auth:{flowType:'pkce',detectSessionInUrl:false,persistSession:true,autoRefreshToken:true}});
  const pt=()=>document.documentElement.lang.startsWith('pt');
  const t=(br,en)=>pt()?br:en;
  const eligible='#commentBody, .reply-form textarea, #fanart-comment-body';
  let counter=0;
  const roots=[];
  function attach(input){
    if(input.dataset.mentionReady==='true')return;
    input.dataset.mentionReady='true';
    const hint=document.createElement('p');hint.className='community-mention-hint community-hint';
    hint.dataset.pt='Digite @usuário para mencionar alguém. Só contas existentes recebem aviso, se ativarem notificações.';
    hint.dataset.en='Type @username to mention someone. Only existing accounts get a notice if they opt in.';
    hint.textContent=t(hint.dataset.pt,hint.dataset.en);
    const choices=document.createElement('div');choices.className='community-mention-suggestions';
    choices.id='mentions-'+(++counter);choices.setAttribute('aria-live','polite');
    input.setAttribute('aria-describedby',[input.getAttribute('aria-describedby'),hint.id='mention-hint-'+counter]
      .filter(Boolean).join(' '));
    input.insertAdjacentElement('afterend',choices);
    choices.insertAdjacentElement('afterend',hint);
    roots.push({hint,choices});
    let timer=0,sequence=0;
    input.addEventListener('input',()=>{
      window.clearTimeout(timer);const current=++sequence;choices.replaceChildren();
      const before=input.value.slice(0,input.selectionStart);
      const match=before.match(/(?:^|[^a-z0-9_@])@([a-z0-9_]{1,24})$/i);
      if(!match||match[1].length<2)return;
      timer=window.setTimeout(async()=>{
        const prefix=match[1].toLowerCase();
        const result=await db.from('profiles').select('username,display_name')
          .like('username',prefix+'%').order('username',{ascending:true}).limit(5);
        if(current!==sequence||result.error)return;
        choices.replaceChildren();
        for(const person of result.data||[]){
          if(!/^[a-z0-9_]{3,24}$/.test(person.username||''))continue;
          const button=document.createElement('button');button.type='button';button.className='community-mention-choice';
          button.textContent='@'+person.username+(person.display_name?' · '+person.display_name:'');
          button.addEventListener('click',()=>{
            const start=input.selectionStart;
            const now=input.value.slice(0,start).match(/(?:^|[^a-z0-9_@])@([a-z0-9_]{1,24})$/i);
            if(!now)return;
            const replacement='@'+person.username+' ';
            input.setRangeText(replacement,start-now[1].length-1,start,'end');
            input.dispatchEvent(new Event('input',{bubbles:true}));input.focus();
          });choices.append(button);
        }
      },250);
    });
    input.addEventListener('blur',()=>{window.clearTimeout(timer);timer=window.setTimeout(()=>choices.replaceChildren(),200);});
  }
  function install(){document.querySelectorAll(eligible).forEach(attach);}
  new MutationObserver(install).observe(document.body,{childList:true,subtree:true});
  new MutationObserver(()=>roots.forEach(({hint})=>{
    if(hint.isConnected)hint.textContent=t(hint.dataset.pt,hint.dataset.en);
  })).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
  install();
})();
