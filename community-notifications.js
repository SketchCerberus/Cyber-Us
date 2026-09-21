/* In-site notifications. The database allows each reader to see only their own inbox. */
(() => {
  'use strict';
  const member=document.getElementById('memberAccount');
  if(!member||!window.supabase?.createClient)return;
  const db=window.supabase.createClient('https://znenamrszhjsiztllcit.supabase.co',
    'sb_publishable_3VRFxwtDuYq4ETHs4xof8g_Fp3GRl6c',
    {auth:{flowType:'pkce',detectSessionInUrl:false,persistSession:true,autoRefreshToken:true}});
  const pt=()=>document.documentElement.lang.startsWith('pt');
  const t=(br,en)=>pt()?br:en;
  const loc=(element,br,en)=>{element.dataset.pt=br;element.dataset.en=en;element.textContent=t(br,en);return element;};
  const node=(tag,cls)=>{const element=document.createElement(tag);if(cls)element.className=cls;return element;};
  const section=node('section','community-notification-section community-box');section.id='myNotifications';
  const title=loc(node('h2'),'Notificações','Notifications');
  const intro=loc(node('p','community-hint'),
    'Notificações dentro do site, desativadas por padrão. Escolha quais deseja receber; não enviamos e-mails.',
    'In-site notifications are off by default. Choose what to receive; no emails are sent.');
  const settings=node('form','community-form');
  const replyLabel=node('label','community-notification-choice');const reply=node('input');
  reply.type='checkbox';replyLabel.append(reply,loc(node('span'),'Avisar quando responderem aos meus comentários','Notify me when someone replies to my comments'));
  const mentionLabel=node('label','community-notification-choice');const mention=node('input');
  mention.type='checkbox';mentionLabel.append(mention,loc(node('span'),'Avisar quando mencionarem meu @usuário','Notify me when someone mentions my @username'));
  const save=loc(node('button','action'),'Salvar preferências','Save preferences');save.type='submit';
  const settingsStatus=node('p','community-notice');settingsStatus.setAttribute('role','status');
  settingsStatus.setAttribute('aria-live','polite');
  settings.append(replyLabel,mentionLabel,save,settingsStatus);
  const heading=node('div','community-notification-heading');
  const inboxTitle=loc(node('h3'),'Minha caixa de entrada','My inbox');
  const refresh=loc(node('button','community-link'),'Atualizar','Refresh');refresh.type='button';
  heading.append(inboxTitle,refresh);
  const status=node('p','community-hint');status.setAttribute('role','status');
  status.setAttribute('aria-live','polite');
  const list=node('ol','comment-list community-notification-list');
  section.append(title,intro,settings,heading,status,list);member.append(section);
  let user=null,identity=0,version=0;
  function say(el,br,en,error=false){el.dataset.pt=br;el.dataset.en=en;el.textContent=t(br,en);el.classList.toggle('error',error);}
  function target(item){
    if(item.episode_slug&&/^(episodio-0[1-5]|marco-zero)$/.test(item.episode_slug)){
      return 'episodios/'+item.episode_slug+'.html#communityHeading';
    }
    if(item.fanart_submission_id&&/^[a-f0-9-]{36}$/i.test(item.fanart_submission_id)){
      return 'fanarts-galeria.html?art='+encodeURIComponent(item.fanart_submission_id)+'#artwork';
    }
    return null;
  }
  async function loadInbox(){
    const ticket=++version;
    if(!user)return;
    refresh.disabled=true;say(status,'Carregando notificações…','Loading notifications…');
    const result=await db.from('community_notifications')
      .select('id,kind,episode_slug,fanart_submission_id,created_at,read_at')
      .order('created_at',{ascending:false}).limit(30);
    if(ticket!==version||!user)return;
    refresh.disabled=false;list.replaceChildren();
    if(result.error){say(status,'Não foi possível carregar as notificações.','Could not load notifications.',true);return;}
    const entries=result.data||[];
    if(!entries.length){say(status,'Nenhuma notificação ainda.','No notifications yet.');return;}
    const unread=entries.filter(item=>!item.read_at).length;
    say(status,t(`${unread} não lida(s) nas últimas ${entries.length}.`,`${unread} unread among the latest ${entries.length}.`),
      t(`${unread} não lida(s) nas últimas ${entries.length}.`,`${unread} unread among the latest ${entries.length}.`));
    for(const entry of entries){
      const li=node('li','comment-item');if(!entry.read_at)li.classList.add('community-notification-unread');
      const message=entry.kind==='reply'
        ? t('Alguém respondeu ao seu comentário.','Someone replied to your comment.')
        : t('Seu @usuário foi mencionado em um comentário.','Your @username was mentioned in a comment.');
      const href=target(entry);
      const link=href?node('a','community-notification-link'):node('span','community-notification-link');
      link.textContent=message;
      if(href){link.href=href;link.addEventListener('click',async event=>{
        if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||!user)return;
        event.preventDefault();link.setAttribute('aria-disabled','true');
        try{await db.from('community_notifications').update({read_at:new Date().toISOString()}).eq('id',entry.id);}
        finally{window.location.assign(link.href);}
      });}
      const time=node('time','comment-meta');time.dateTime=entry.created_at;
      time.textContent=new Intl.DateTimeFormat(pt()?'pt-BR':'en',{dateStyle:'medium',timeStyle:'short'}).format(new Date(entry.created_at));
      li.append(link,time);list.append(li);
    }
  }
  async function verify(){
    const ticket=++identity;user=null;++version;section.hidden=true;list.replaceChildren();
    const auth=await db.auth.getUser();
    if(ticket!==identity||auth.error||!auth.data?.user)return;
    user=auth.data.user;section.hidden=false;
    const prefs=await db.from('community_notification_preferences').select('user_id,replies,mentions').maybeSingle();
    if(ticket!==identity||!user)return;
    if(prefs.error){say(settingsStatus,'Falha ao carregar as preferências.','Could not load preferences.',true);save.disabled=true;}
    else{reply.checked=prefs.data?.replies===true;mention.checked=prefs.data?.mentions===true;
      save.disabled=false;say(settingsStatus,'Escolha e salve suas preferências.','Choose and save your preferences.');}
    await loadInbox();
  }
  settings.addEventListener('submit',async event=>{
    event.preventDefault();if(!user||save.disabled)return;
    save.disabled=true;
    const data={replies:reply.checked,mentions:mention.checked};
    const lookup=await db.from('community_notification_preferences').select('user_id').maybeSingle();
    let outcome={error:lookup.error};
    if(!lookup.error){outcome=lookup.data
      ? await db.from('community_notification_preferences').update(data).eq('user_id',user.id)
      : await db.from('community_notification_preferences').insert({...data,user_id:user.id});}
    say(settingsStatus,outcome.error?'Não foi possível salvar. Tente novamente.':'Preferências salvas.',
      outcome.error?'Could not save. Try again.':'Preferences saved.',!!outcome.error);
    save.disabled=false;
  });
  refresh.addEventListener('click',loadInbox);
  db.auth.onAuthStateChange(()=>setTimeout(verify,0));
  new MutationObserver(()=>{
    section.querySelectorAll('[data-pt][data-en]').forEach(el=>el.textContent=t(el.dataset.pt,el.dataset.en));
    list.querySelectorAll('time').forEach(el=>el.textContent=new Intl.DateTimeFormat(pt()?'pt-BR':'en',
      {dateStyle:'medium',timeStyle:'short'}).format(new Date(el.dateTime)));
    if(user)loadInbox();
  }).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
  verify();
})();
