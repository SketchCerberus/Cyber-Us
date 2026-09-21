/* The moderator explicitly chooses featured works; the database guards every update. */
(() => {
  'use strict';
  const view=document.getElementById('moderationFanartsView');
  const tab=document.getElementById('moderationFanartsTab');
  if(!view||!tab||!window.supabase?.createClient)return;
  const db=window.supabase.createClient('https://znenamrszhjsiztllcit.supabase.co',
    'sb_publishable_3VRFxwtDuYq4ETHs4xof8g_Fp3GRl6c',
    {auth:{flowType:'pkce',detectSessionInUrl:false,persistSession:true,autoRefreshToken:true}});
  const pt=()=>document.documentElement.lang.startsWith('pt');
  const t=(br,en)=>pt()?br:en;
  const loc=(item,br,en)=>{item.dataset.pt=br;item.dataset.en=en;item.textContent=t(br,en);return item;};
  const el=(tag,cls)=>{const item=document.createElement(tag);if(cls)item.className=cls;return item;};
  const section=el('section','moderation-featured');
  const heading=el('div','moderation-selection-heading');
  const title=loc(el('h3'),'Escolher fanarts em destaque','Select featured fanart');
  title.id='fanarts-featured-moderation-heading';section.setAttribute('aria-labelledby',title.id);
  const refresh=loc(el('button','community-action'),'Atualizar obras','Refresh artwork');
  refresh.type='button';heading.append(title,refresh);
  const hint=loc(el('p','community-hint'),
    'Escolha manualmente até seis obras já aprovadas. Votos não influenciam esta seção; remover o destaque não apaga a obra.',
    'Manually select up to six approved works. Votes do not affect this section; removing a feature does not delete the art.');
  const status=el('p','community-notice');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  const list=el('ol','comment-list moderation-featured-list');
  section.append(heading,hint,status,list);view.append(section);
  let allowed=false,permission=0,ticket=0;
  function say(br,en,error=false){status.dataset.pt=br;status.dataset.en=en;status.textContent=t(br,en);status.classList.toggle('error',error);}
  async function check(){
    const current=++permission;allowed=false;++ticket;list.replaceChildren();
    const auth=await db.auth.getUser();
    if(current!==permission||auth.error||!auth.data?.user)return false;
    const staff=await db.rpc('is_moderator');
    if(current!==permission)return false;
    allowed=!staff.error&&staff.data===true;return allowed;
  }
  async function load(){
    const current=++ticket;if(!allowed||view.hidden)return;
    refresh.disabled=true;say('Carregando fanarts aprovadas…','Loading approved fanart…');list.replaceChildren();
    const result=await db.from('fanart_gallery')
      .select('submission_id,title,artist_name,featured,featured_at,published_at')
      .order('published_at',{ascending:false}).limit(100);
    if(current!==ticket||!allowed)return;
    refresh.disabled=false;
    if(result.error){say('Não foi possível consultar as obras.','Could not load artwork.',true);return;}
    const works=result.data||[];
    const count=works.filter(item=>item.featured).length;
    if(!works.length){say('Ainda não há fanarts aprovadas.','No approved fanart yet.');return;}
    say(`${count} obra(s) em destaque (limite: 6).`,`${count} featured artwork(s) (limit: 6).`);
    for(const art of works){
      const li=el('li','comment-item');const name=el('strong');name.textContent=art.title;
      const by=el('p','comment-meta');by.textContent=art.artist_name;
      const button=loc(el('button','community-action'),
        art.featured?'Retirar do destaque':'Colocar em destaque',
        art.featured?'Remove from featured':'Feature artwork');
      button.type='button';button.disabled=!art.featured&&count>=6;
      button.addEventListener('click',async()=>{
        if(!allowed||view.hidden||!window.confirm(t(art.featured?'Retirar esta obra do destaque?':'Destacar esta obra?',
          art.featured?'Remove this artwork from featured?':'Feature this artwork?')))return;
        button.disabled=true;
        const outcome=await db.from('fanart_gallery').update({featured:!art.featured})
          .eq('submission_id',art.submission_id);
        if(outcome.error){say('Não foi possível atualizar o destaque.','Could not update featured artwork.',true);button.disabled=false;return;}
        await load();
      });li.append(name,by,button);list.append(li);
    }
  }
  tab.addEventListener('click',async()=>{if(await check()&&!view.hidden)load();});
  refresh.addEventListener('click',async()=>{if(await check()&&!view.hidden)load();});
  db.auth.onAuthStateChange(()=>{allowed=false;++permission;++ticket;list.replaceChildren();});
  new MutationObserver(()=>{
    section.querySelectorAll('[data-pt][data-en]').forEach(item=>item.textContent=t(item.dataset.pt,item.dataset.en));
    if(allowed&&!view.hidden)load();
  }).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
})();
