/* Editorial highlights are selected by moderators, never ranked by voting. */
(() => {
  'use strict';
  const gallery=document.querySelector('.fanarts-gallery');
  if(!gallery||!window.supabase?.createClient)return;
  const db=window.supabase.createClient('https://znenamrszhjsiztllcit.supabase.co',
    'sb_publishable_3VRFxwtDuYq4ETHs4xof8g_Fp3GRl6c',
    {auth:{flowType:'pkce',detectSessionInUrl:false,persistSession:true,autoRefreshToken:true}});
  const pt=()=>document.documentElement.lang.startsWith('pt');
  const t=(br,en)=>pt()?br:en;
  const section=document.createElement('section');section.className='fanarts-featured';section.hidden=true;
  const eyebrow=document.createElement('p');eyebrow.className='eyebrow';
  eyebrow.dataset.pt='SELEÇÃO DA EQUIPE';eyebrow.dataset.en='STAFF PICKS';
  const title=document.createElement('h2');title.id='fanarts-featured-title';
  title.dataset.pt='Fanarts em destaque';title.dataset.en='Featured fanart';
  const description=document.createElement('p');description.className='fanarts-hint';
  description.dataset.pt='Obras escolhidas manualmente pela equipe, sem classificação por votos.';
  description.dataset.en='Artwork handpicked by the team, with no vote-based ranking.';
  const list=document.createElement('div');list.className='fanarts-featured-grid';
  section.setAttribute('aria-labelledby',title.id);section.append(eyebrow,title,description,list);
  gallery.before(section);
  let works=[];
  function labels(){for(const element of [eyebrow,title,description])element.textContent=t(element.dataset.pt,element.dataset.en);}
  function render(){
    labels();list.replaceChildren();
    for(const art of works){
      const link=document.createElement('a');link.className='fanarts-featured-card';
      link.href='fanarts-galeria.html?art='+encodeURIComponent(art.submission_id)+'#artwork';
      const spoiler=art.tags.includes('Spoiler');
      if(spoiler){
        const placeholder=document.createElement('div');placeholder.className='fanarts-featured-hidden';
        placeholder.textContent=t('Spoiler · Toque para abrir a obra na galeria','Spoiler · Open the artwork in the gallery');
        link.append(placeholder);
      }else{
        const image=document.createElement('img');image.loading='lazy';image.decoding='async';
        image.src=db.storage.from('fanart-public').getPublicUrl(art.image_path).data.publicUrl;
        image.alt=t(`Fanart “${art.title}”, de ${art.artist_name}`,`Fanart “${art.title}” by ${art.artist_name}`);
        const name=document.createElement('strong');name.textContent=art.title;
        const artist=document.createElement('span');artist.textContent=t('Por ','By ')+art.artist_name;
        link.append(image,name,artist);
      }
      list.append(link);
    }
    section.hidden=!works.length;
  }
  async function load(){
    const result=await db.from('fanart_gallery')
      .select('submission_id,title,artist_name,image_path,tags,featured,featured_at')
      .eq('featured',true).order('featured_at',{ascending:false}).limit(6);
    if(result.error){section.hidden=true;return;}
    works=(result.data||[]).filter(art=>/^[a-f0-9-]{36}\.(?:jpg|png|webp)$/i.test(art.image_path||'')&&
      /^[a-f0-9-]{36}$/i.test(art.submission_id||'')&&typeof art.title==='string'&&typeof art.artist_name==='string')
      .map(art=>({...art,tags:Array.isArray(art.tags)?art.tags:[]}));
    render();
  }
  new MutationObserver(render).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
  load();
})();
