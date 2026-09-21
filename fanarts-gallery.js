/* Public gallery: reads only the sanitized publication table and public bucket. */
(() => {
  'use strict';
  const gallery=document.querySelector('.fanarts-gallery');
  const empty=gallery?.querySelector('.fanarts-empty');
  if (!gallery || !empty || !window.supabase?.createClient) return;
  const pt=()=>document.documentElement.lang.startsWith('pt');
  const t=(br,en)=>pt()?br:en;
  // The original Fanarts landing page remains operational during migration.
  // Offer discoverable links without modifying the existing upload or moderation logic.
  if (location.pathname.split('/').pop()==='fanarts.html') {
    const nav=document.createElement('nav'); nav.className='fanarts-subnav';
    nav.setAttribute('aria-label','Fanarts');
    for (const [path,br,en] of [
      ['fanarts.html','Visão geral','Overview'],
      ['fanarts-galeria.html','Galeria','Gallery'],
      ['fanarts-publicar.html','Publicar','Submit']
    ]) {
      const link=document.createElement('a'); link.href=path;
      link.dataset.pt=br;link.dataset.en=en;link.textContent=t(br,en);
      if (path==='fanarts.html') link.setAttribute('aria-current','page');
      nav.append(link);
    }
    gallery.closest('main')?.prepend(nav);
    const sheet=document.createElement('link');sheet.rel='stylesheet';sheet.href='fanarts-subpages.css';
    document.head.append(sheet);
  }
  const db=window.supabase.createClient('https://znenamrszhjsiztllcit.supabase.co',
    'sb_publishable_3VRFxwtDuYq4ETHs4xof8g_Fp3GRl6c',
    {auth:{flowType:'pkce',detectSessionInUrl:false,persistSession:true,autoRefreshToken:true}});
  const status=document.createElement('p');
  status.className='fanarts-hint fanarts-gallery-status';
  status.setAttribute('role','status');
  status.setAttribute('aria-live','polite');
  empty.before(status);
  let works=[];
  let grid=null;

  function accent(work) {
    if (work.accent!=='random') return work.accent;
    const colors=['blue','red','green'];
    const sum=[...work.submission_id].reduce((total,char)=>total+char.charCodeAt(0),0);
    return colors[sum%colors.length];
  }
  function copy() {
    const title=gallery.querySelector('#gallery-title');
    const intro=gallery.querySelector('.fanarts-section-heading > p');
    if (works.length) {
      title.textContent=t('Artes da comunidade.','Art from the community.');
      intro.textContent=t(
        'Obras aprovadas, com crédito e região somente quando autorizada pelo artista.',
        'Approved artwork, with credit and region only when authorized by the artist.');
      status.textContent=t(`${works.length} obra(s) publicada(s).`,`${works.length} published work(s).`);
    } else {
      title.textContent=t('Em breve, arte de todo lugar.','Art from everywhere, coming soon.');
      status.textContent='';
    }
    grid?.querySelectorAll('.fanarts-gallery-work').forEach(figure=>{
      const work=works.find(item=>item.submission_id===figure.dataset.submissionId);
      if (!work) return;
      const image=figure.querySelector('img');
      const by=figure.querySelector('.fanarts-gallery-artist');
      if (image) image.alt=t(`Fanart “${work.title}”, de ${work.artist_name}`,`Fanart “${work.title}” by ${work.artist_name}`);
      if (by) by.firstChild.textContent=t('Por ','By ');
    });
  }

  async function load() {
    status.textContent=t('Carregando galeria…','Loading gallery…');
    const result=await db.from('fanart_gallery')
      .select('submission_id,title,artist_name,artist_link,region,accent,image_path,published_at')
      .order('published_at',{ascending:false}).limit(100);
    if (result.error) {
      status.textContent=t('Não foi possível carregar a galeria.','Could not load the gallery.');
      status.classList.add('error');
      return;
    }
    status.classList.remove('error');
    works=(result.data||[]).filter(work=>
      /^[0-9a-f-]{36}\.(?:jpg|png|webp)$/i.test(work.image_path) &&
      typeof work.title==='string' && typeof work.artist_name==='string'
    );
    grid?.remove();
    grid=null;
    empty.hidden=Boolean(works.length);
    if (!works.length) { copy(); return; }
    grid=document.createElement('div');
    grid.className='fanarts-approved-gallery';
    for (const work of works) {
      const figure=document.createElement('figure');
      figure.className='fanarts-gallery-work';
      figure.dataset.submissionId=work.submission_id;
      figure.dataset.accent=accent(work);
      const image=document.createElement('img');
      image.loading='lazy';
      image.decoding='async';
      image.src=db.storage.from('fanart-public').getPublicUrl(work.image_path).data.publicUrl;
      image.addEventListener('error',()=>{
        figure.remove();
        if (!grid.children.length) {
          empty.hidden=false;
          status.textContent=t('As obras publicadas estão temporariamente indisponíveis.','Published artwork is temporarily unavailable.');
        }
      });
      const caption=document.createElement('figcaption');
      const title=document.createElement('strong');
      title.textContent=work.title;
      const artist=document.createElement('span');
      artist.className='fanarts-gallery-artist';
      artist.append(document.createTextNode(t('Por ','By ')));
      if (work.artist_link) {
        const link=document.createElement('a');
        link.href=work.artist_link;
        link.target='_blank';
        link.rel='noopener noreferrer';
        link.textContent=work.artist_name;
        artist.append(link);
      } else artist.append(document.createTextNode(work.artist_name));
      caption.append(title,artist);
      if (work.region) {
        const region=document.createElement('span');
        region.textContent=work.region;
        caption.append(region);
      }
      figure.append(image,caption);
      grid.append(figure);
    }
    gallery.append(grid);
    copy();
  }
  new MutationObserver(()=>{
    copy();
    document.querySelectorAll('.fanarts-subnav [data-pt][data-en]').forEach(node=>{
      node.textContent=t(node.dataset.pt,node.dataset.en);
    });
  }).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
  load();
})();
