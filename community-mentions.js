/* Search public account names and insert only the canonical unique @username. */
(() => {
  'use strict';
  if(!window.supabase?.createClient)return;
  const base=document.currentScript?.src||document.baseURI;
  const css=document.createElement('link');css.rel='stylesheet';css.href=new URL('community-mention-finder.css',base).href;document.head.append(css);
  const db=window.supabase.createClient('https://znenamrszhjsiztllcit.supabase.co',
    'sb_publishable_3VRFxwtDuYq4ETHs4xof8g_Fp3GRl6c',
    {auth:{flowType:'pkce',detectSessionInUrl:false,persistSession:true,autoRefreshToken:true}});
  const pt=()=>document.documentElement.lang.startsWith('pt');
  const t=(a,b)=>pt()?a:b;
  const eligible='#commentBody, .reply-form textarea, #fanart-comment-body';
  const valid=/^[a-z0-9_]{3,24}$/;
  const roots=[];let counter=0;
  async function findPeople(text){
    const term=String(text||'').trim().slice(0,40),requests=[];
    if(/^[a-z0-9_]{2,24}$/i.test(term))requests.push(db.from('profiles')
      .select('username,display_name').like('username',term.toLowerCase()+'%').order('username').limit(5));
    const name=term.replace(/[%_\\]/g,'').trim();
    if(name.length>=2)requests.push(db.from('profiles').select('username,display_name')
      .ilike('display_name','%'+name+'%').not('username','is',null).order('username').limit(5));
    if(!requests.length)return {people:[],error:false};
    const results=await Promise.all(requests),people=new Map();
    for(const result of results)if(!result.error)for(const person of result.data||[])
      if(valid.test(person.username||''))people.set(person.username,person);
    return {people:[...people.values()].slice(0,8),error:results.every(result=>Boolean(result.error))};
  }
  function attach(input){
    if(input.dataset.mentionReady==='true')return;
    input.dataset.mentionReady='true';const number=++counter;
    const make=(tag,cls)=>{const el=document.createElement(tag);el.className=cls;return el;};
    const hint=make('p','community-mention-hint community-hint');hint.id='mention-hint-'+number;
    hint.dataset.pt='Digite @ e algumas letras, ou encontre alguém pelo nome público. O aviso depende das preferências da pessoa.';
    hint.dataset.en='Type @ and a few letters, or find someone by public name. Alerts depend on their preferences.';
    hint.textContent=t(hint.dataset.pt,hint.dataset.en);
    const choices=make('div','community-mention-suggestions');choices.id='mentions-'+number;choices.setAttribute('aria-live','polite');
    input.setAttribute('aria-describedby',[input.getAttribute('aria-describedby'),hint.id].filter(Boolean).join(' '));
    const toggle=make('button','community-mention-finder-toggle');toggle.type='button';
    toggle.dataset.pt='Encontrar alguém para mencionar';toggle.dataset.en='Find someone to mention';
    toggle.textContent=t(toggle.dataset.pt,toggle.dataset.en);toggle.setAttribute('aria-expanded','false');
    const finder=make('div','community-mention-finder');finder.hidden=true;finder.id='mention-finder-'+number;
    toggle.setAttribute('aria-controls',finder.id);
    const label=make('label','');label.htmlFor='mention-search-'+number;
    label.dataset.pt='Buscar pelo nome público ou @usuário';label.dataset.en='Search by public name or @username';
    label.textContent=t(label.dataset.pt,label.dataset.en);
    const search=make('input','');search.id=label.htmlFor;search.type='search';search.maxLength=40;
    search.autocomplete='off';search.spellcheck=false;
    search.dataset.pt='Digite pelo menos 2 caracteres';search.dataset.en='Enter at least 2 characters';
    search.placeholder=t(search.dataset.pt,search.dataset.en);
    search.setAttribute('aria-label',t(label.dataset.pt,label.dataset.en));
    const found=make('div','community-mention-suggestions');found.setAttribute('aria-live','polite');
    const status=make('p','community-hint');status.setAttribute('role','status');
    finder.append(label,search,found,status);
    input.insertAdjacentElement('afterend',choices);choices.insertAdjacentElement('afterend',hint);
    hint.insertAdjacentElement('afterend',toggle);toggle.insertAdjacentElement('afterend',finder);
    roots.push({hint,toggle,label,search,status});
    let inlineTimer=0,inlineSeq=0,searchTimer=0,searchSeq=0,lastCursor=input.value.length;
    const message=(br,en)=>{status.dataset.pt=br;status.dataset.en=en;status.textContent=t(br,en);};
    const close=()=>{finder.hidden=true;toggle.setAttribute('aria-expanded','false');
      ++searchSeq;window.clearTimeout(searchTimer);found.replaceChildren();message('','');};
    const insert=person=>{
      const cursor=Math.min(lastCursor,input.value.length),before=input.value.slice(0,cursor);
      const token=before.match(/(?:^|[^a-z0-9_@])@([a-z0-9_]{1,24})$/i);
      const start=token?cursor-token[1].length-1:cursor;
      const separator=!token&&start>0&&/[a-z0-9_]/i.test(input.value[start-1])?' ':'';
      const mention=separator+'@'+person.username+' ';
      if(input.maxLength>0&&input.value.length-(cursor-start)+mention.length>input.maxLength){
        message('Seu comentário atingiu o limite de caracteres.','Your comment has reached its character limit.');return;}
      input.setRangeText(mention,start,cursor,'end');lastCursor=input.selectionStart;
      input.dispatchEvent(new Event('input',{bubbles:true}));choices.replaceChildren();close();input.focus();
    };
    const show=(host,people,isFinder)=>{
      host.replaceChildren();for(const person of people){
        const button=make('button','community-mention-choice');button.type='button';
        button.textContent='@'+person.username+(person.display_name?' · '+person.display_name:'');
        button.addEventListener('click',()=>insert(person));host.append(button);
      }
      if(isFinder)message(people.length?'Selecione uma conta para inserir a menção.':'Nenhuma conta encontrada com @usuário.',
        people.length?'Select an account to insert the mention.':'No account with a username found.');
    };
    for(const event of ['keyup','click','focus','select'])input.addEventListener(event,()=>{lastCursor=input.selectionStart;});
    input.addEventListener('input',()=>{
      lastCursor=input.selectionStart;window.clearTimeout(inlineTimer);const seq=++inlineSeq;choices.replaceChildren();
      const match=input.value.slice(0,lastCursor).match(/(?:^|[^a-z0-9_@])@([a-z0-9_]{1,24})$/i);
      if(!match||match[1].length<2)return;
      inlineTimer=window.setTimeout(async()=>{
        const result=await findPeople(match[1]);if(seq!==inlineSeq||result.error)return;
        show(choices,result.people,false);
      },250);
    });
    input.addEventListener('blur',()=>{window.clearTimeout(inlineTimer);
      inlineTimer=window.setTimeout(()=>{++inlineSeq;choices.replaceChildren();},200);});
    toggle.addEventListener('click',()=>{
      if(!finder.hidden){close();input.focus();return;}
      finder.hidden=false;toggle.setAttribute('aria-expanded','true');
      message('Busque uma pessoa pelo nome ou identificador.','Search for a person by name or handle.');search.focus();
    });
    finder.addEventListener('keydown',event=>{if(event.key==='Escape'){
      event.preventDefault();close();toggle.focus();}});
    search.addEventListener('input',()=>{
      window.clearTimeout(searchTimer);const seq=++searchSeq;found.replaceChildren();
      const term=search.value.trim();if(term.length<2){message('Digite pelo menos 2 caracteres.','Enter at least 2 characters.');return;}
      message('Procurando…','Searching…');
      searchTimer=window.setTimeout(async()=>{
        const result=await findPeople(term.replace(/^@/,''));if(seq!==searchSeq||finder.hidden)return;
        if(result.error){message('Não foi possível pesquisar agora.','Search is unavailable right now.');return;}
        show(found,result.people,true);
      },300);
    });
  }
  const install=()=>document.querySelectorAll(eligible).forEach(attach);
  new MutationObserver(install).observe(document.body,{childList:true,subtree:true});
  new MutationObserver(()=>roots.forEach(({hint,toggle,label,search,status})=>{
    if(!hint.isConnected)return;
    for(const node of [hint,toggle,label])node.textContent=t(node.dataset.pt,node.dataset.en);
    search.placeholder=t(search.dataset.pt,search.dataset.en);
    search.setAttribute('aria-label',t(label.dataset.pt,label.dataset.en));
    if(status.dataset.pt!==undefined)status.textContent=t(status.dataset.pt,status.dataset.en);
  })).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
  install();
})();
