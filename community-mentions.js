/* Mention discovery: public usernames and public profile names only; never account IDs or emails. */
(() => {
  'use strict';
  if(!window.supabase?.createClient)return;
  const scriptBase=document.currentScript?.src||document.baseURI;
  const style=document.createElement('link');style.rel='stylesheet';
  style.href=new URL('community-mention-finder.css',scriptBase).href;document.head.append(style);
  const db=window.supabase.createClient('https://znenamrszhjsiztllcit.supabase.co',
    'sb_publishable_3VRFxwtDuYq4ETHs4xof8g_Fp3GRl6c',
    {auth:{flowType:'pkce',detectSessionInUrl:false,persistSession:true,autoRefreshToken:true}});
  const pt=()=>document.documentElement.lang.startsWith('pt');
  const t=(br,en)=>pt()?br:en;
  const eligible='#commentBody, .reply-form textarea, #fanart-comment-body';
  const validHandle=/^[a-z0-9_]{3,24}$/;
  let counter=0;
  const roots=[];
  // Bound both searches. Display names need not be unique; the result always shows the unique handle.
  async function findPeople(text,byName){
    const term=String(text||'').trim().slice(0,40);
    const searches=[];
    if(/^[a-z0-9_]{2,24}$/i.test(term))
      searches.push(db.from('profiles').select('username,display_name').like('username',term.toLowerCase()+'%')
        .order('username',{ascending:true}).limit(5));
    const nameTerm=term.replace(/[%_\\]/g,'').trim();
    if(byName&&nameTerm.length>=2)
      searches.push(db.from('profiles').select('username,display_name').ilike('display_name','%'+nameTerm+'%')
        .not('username','is',null).order('username',{ascending:true}).limit(5));
    if(!searches.length)return {people:[],error:false};
    const responses=await Promise.all(searches);
    const people=new Map();
    for(const result of responses){
      if(result.error)continue;
      for(const person of result.data||[]){
        if(validHandle.test(person.username||''))people.set(person.username,person);
      }
    }
    return {people:[...people.values()].slice(0,8),error:responses.every(result=>Boolean(result.error))};
  }
  function attach(input){
    if(input.dataset.mentionReady==='true')return;
    input.dataset.mentionReady='true';
    const index=++counter;
    const hint=document.createElement('p');hint.className='community-mention-hint community-hint';
    hint.dataset.pt='Digite @ e as primeiras letras ou encontre alguém pelo nome público. Só contas com @usuário recebem menções; o aviso depende das preferências da pessoa.';
    hint.dataset.en='Type @ and the first letters, or find someone by public name. Only accounts with a username can be mentioned; alerts depend on their preferences.';
    hint.textContent=t(hint.dataset.pt,hint.dataset.en);hint.id='mention-hint-'+index;
    const choices=document.createElement('div');choices.className='community-mention-suggestions';
    choices.id='mentions-'+index;choices.setAttribute('aria-live','polite');
    input.setAttribute('aria-describedby',[input.getAttribute('aria-describedby'),hint.id].filter(Boolean).join(' '));
    const toggle=document.createElement('button');toggle.type='button';toggle.className='community-mention-finder-toggle';
    toggle.dataset.pt='Encontrar alguém para mencionar';toggle.dataset.en='Find someone to mention';
    toggle.textContent=t(toggle.dataset.pt,toggle.dataset.en);toggle.setAttribute('aria-expanded','false');
    const finder=document.createElement('div');finder.className='community-mention-finder';finder.hidden=true;
    finder.id='mention-finder-'+index;toggle.setAttribute('aria-controls',finder.id);
    const label=document.createElement('label');label.htmlFor='mention-search-'+index;
    label.dataset.pt='Buscar pelo nome público ou @usuário';label.dataset.en='Search by public name or @username';
    const search=document.createElement('input');search.id=label.htmlFor;search.type='search';search.maxLength=40;
    search.autocomplete='off';search.spellcheck=false;
    search.dataset.pt='Digite pelo menos 2 caracteres';search.dataset.en='Enter at least 2 characters';
    search.setAttribute('aria-label',t(label.dataset.pt,label.dataset.en));
    const found=document.createElement('div');found.className='community-mention-suggestions';
    found.setAttribute('aria-live','polite');
    const status=document.createElement('p');status.className='community-hint';status.setAttribute('role','status');
    finder.append(label,search,found,status);
    input.insertAdjacentElement('afterend',choices);
    choices.insertAdjacentElement('afterend',hint);hint.insertAdjacentElement('afterend',toggle);
    toggle.insertAdjacentElement('afterend',finder);
    roots.push({hint,toggle,label,search,status,found});
    let inlineTimer=0,inlineSeq=0,searchTimer=0,searchSeq=0,lastCursor=input.value.length;
    const setStatus=(br,en)=>{status.dataset.pt=br;status.dataset.en=en;status.textContent=t(br,en);};
    const close=()=>{
      finder.hidden=true;toggle.setAttribute('aria-expanded','false');
      ++searchSeq;window.clearTimeout(searchTimer);found.replaceChildren();setStatus('','');
    };
    const insert=person=>{
      const cursor=Math.min(lastCursor,input.value.length);
      const preceding=input.value.slice(0,cursor);
      const token=preceding.match(/(?:^|[^a-z0-9_@])@([a-z0-9_]{1,24})$/i);
      const start=token?cursor-token[1].length-1:cursor;
      const mention='@'+person.username+' ';
      if(input.maxLength>0&&input.value.length-(cursor-start)+mention.length>input.maxLength){
        setStatus('Seu comentário atingiu o limite de caracteres.','Your comment has reached its character limit.');return;
      }
      input.setRangeText(mention,start,cursor,'end');lastCursor=input.selectionStart;
      input.dispatchEvent(new Event('input',{bubbles:true}));
      choices.replaceChildren();close();input.focus();
    };
    const renderResults=(target,people,fromFinder)=>{
      target.replaceChildren();
      for(const person of people){
        const button=document.createElement('button');button.type='button';button.className='community-mention-choice';
        button.textContent='@'+person.username+(person.display_name?' · '+person.display_name:'');
        button.addEventListener('click',()=>insert(person));target.append(button);
      }
      if(fromFinder)setStatus(people.length?'Selecione uma conta para inserir a menção.':'Nenhuma conta encontrada com @usuário.',
        people.length?'Choose an account to insert the mention.':'No account with a username found.');
    };
    for(const event of ['keyup','click','focus','select'])input.addEventListener(event,()=>{lastCursor=input.selectionStart;});
    input.addEventListener('input',()=>{
      lastCursor=input.selectionStart;
      window.clearTimeout(inlineTimer);const current=++inlineSeq;choices.replaceChildren();
      const preceding=input.value.slice(0,lastCursor);
      const match=preceding.match(/(?:^|[^a-z0-9_@])@([a-z0-9_]{1,24})$/i);
      if(!match||match[1].length<2)return;
      inlineTimer=window.setTimeout(async()=>{
        const result=await findPeople(match[1],true);
        if(current!==inlineSeq||result.error)return;
        renderResults(choices,result.people,false);
      },250);
    });
    input.addEventListener('blur',()=>{
      window.clearTimeout(inlineTimer);
      inlineTimer=window.setTimeout(()=>{++inlineSeq;choices.replaceChildren();},200);
    });
    toggle.addEventListener('click',()=>{
      if(!finder.hidden){close();input.focus();return;}
      finder.hidden=false;toggle.setAttribute('aria-expanded','true');
      setStatus('Busque uma pessoa pelo nome ou identificador.','Search for a person by name or handle.');
      search.focus();
    });
    finder.addEventListener('keydown',event=>{
      if(event.key==='Escape'){event.preventDefault();close();toggle.focus();}
    });
    search.addEventListener('input',()=>{
      window.clearTimeout(searchTimer);const current=++searchSeq;found.replaceChildren();
      const term=search.value.trim();
      if(term.length<2){setStatus('Digite pelo menos 2 caracteres.','Enter at least 2 characters.');return;}
      setStatus('Procurando…','Searching…');
      searchTimer=window.setTimeout(async()=>{
        const result=await findPeople(term.replace(/^@/,''),true);
        if(current!==searchSeq||finder.hidden)return;
        if(result.error){setStatus('Não foi possível pesquisar agora.','Search is unavailable right now.');return;}
        renderResults(found,result.people,true);
      },300);
    });
  }
  function install(){document.querySelectorAll(eligible).forEach(attach);}
  new MutationObserver(install).observe(document.body,{childList:true,subtree:true});
  new MutationObserver(()=>roots.forEach(({hint,toggle,label,search,status})=>{
    if(!hint.isConnected)return;
    for(const node of [hint,toggle,label])node.textContent=t(node.dataset.pt,node.dataset.en);
    search.placeholder=t(search.dataset.pt,search.dataset.en);
    search.setAttribute('aria-label',t(label.dataset.pt,label.dataset.en));
    if(status.dataset.pt!==undefined)status.textContent=t(status.dataset.pt,status.dataset.en);
  })).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
  install();
  roots.forEach(({search})=>{search.placeholder=t(search.dataset.pt,search.dataset.en);});
})();
