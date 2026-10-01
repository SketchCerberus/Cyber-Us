/* Public gallery: reads only the sanitized publication table and public bucket. */
(() => {
  'use strict';
  const gallery=document.querySelector('.fanarts-gallery');
  const empty=gallery?.querySelector('.fanarts-empty');
  if (!gallery || !empty || !window.supabase?.createClient) return;
  const pt=()=>document.documentElement.lang.startsWith('pt');
  const t=(br,en)=>pt()?br:en;
  const db=window.CyberUsGetClient?.() || window.supabase.createClient('https://znenamrszhjsiztllcit.supabase.co',
    'sb_publishable_3VRFxwtDuYq4ETHs4xof8g_Fp3GRl6c',
    {auth:{flowType:'pkce',detectSessionInUrl:false,persistSession:true,autoRefreshToken:true}});
  const status=document.createElement('p');
  status.className='fanarts-hint fanarts-gallery-status';
  status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  empty.before(status);
  const search=document.createElement('div');search.className='fanarts-search';
  const searchLabel=document.createElement('label');searchLabel.htmlFor='fanarts-search-query';
  searchLabel.dataset.pt='Buscar artista, obra ou tag';searchLabel.dataset.en='Search artists, artwork or tags';
  const searchInput=document.createElement('input');searchInput.id='fanarts-search-query';searchInput.type='search';
  searchInput.maxLength=100;searchInput.disabled=true;
  const filterHint=document.createElement('p');filterHint.className='fanarts-search-hint';
  filterHint.dataset.pt='Selecione tags para combinar os filtros. A busca considera as obras carregadas; use Carregar mais para incluir obras anteriores.';
  filterHint.dataset.en='Select tags to combine filters. Search covers loaded artwork; use Load more to include older work.';
  const tagFilters=document.createElement('div');tagFilters.className='fanarts-tag-filters';
  searchLabel.textContent=t(searchLabel.dataset.pt,searchLabel.dataset.en);
  filterHint.textContent=t(filterHint.dataset.pt,filterHint.dataset.en);
  search.append(searchLabel,searchInput,filterHint,tagFilters);status.before(search);
  let works=[],grid=null,offset=0,loading=false;
  const more=document.createElement('button');more.type='button';more.className='fanarts-view-work';more.hidden=true;
  more.textContent=t('Carregar mais obras','Load more artwork');
  gallery.append(more);
  more.addEventListener('click',()=>load(true));
  const selectedTags=new Set();
  const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const tagVocabulary=new Set(['Auará','Kaubi','Óete','Sistema','Trojan','Malware','OC','Ships','Crossover','Grupo','Swap','E se...','Fofo','Sério','Chibi','AU','Humor','Colaboração','WIP','Spoiler']);
  const tagLabel=tag=>({'Óete':'Oeté','Grupo':t('Grupo','Group'),'E se...':t('E se...','What if...'),
    'Fofo':t('Fofo','Cute'),'Sério':t('Sério','Serious'),'Ships':t('Ships / casais','Ships / pairings'),
    'OC':t('Personagem original','Original character'),'AU':t('Universo alternativo (AU)','Alternate universe (AU)'),
    'WIP':t('Em progresso (WIP)','Work in progress (WIP)'), 'Colaboração':t('Colaboração','Collaboration')}[tag]||tag);
  function accent(work) {
    if (work.accent!=='random') return work.accent;
    const colors=['blue','red','green'];
    const sum=[...work.submission_id].reduce((total,char)=>total+char.charCodeAt(0),0);
    return colors[sum%colors.length];
  }
  function applyFilters() {
    if (!grid) return;
    const query=normalize(searchInput.value.trim());
    let shown=0;
    grid.querySelectorAll('.fanarts-gallery-work').forEach(figure=>{
      const work=works.find(item=>item.submission_id===figure.dataset.submissionId);
      if (!work) return;
      const text=normalize([work.title,work.artist_name,...work.tags,...work.tags.map(tagLabel)].join(' '));
      const match=(!query||text.includes(query)) && [...selectedTags].every(tag=>work.tags.includes(tag));
      figure.hidden=!match;if(match)shown++;
    });
    status.textContent=shown===0?t('Nenhuma obra corresponde aos filtros.','No artworks match these filters.'):
      t(`${shown} obra(s) encontrada(s).`,`${shown} artwork(s) found.`);
  }
  searchInput.addEventListener('input',applyFilters);
  function rebuildTags() {
    tagFilters.replaceChildren();
    const tags=[...new Set(works.flatMap(work=>work.tags))].sort((a,b)=>a.localeCompare(b));
    for(const tag of tags){
      const button=document.createElement('button');button.type='button';button.className='fanarts-tag';
      button.textContent=tagLabel(tag);button.dataset.tag=tag;button.setAttribute('aria-pressed',String(selectedTags.has(tag)));
      button.addEventListener('click',()=>{
        if(selectedTags.has(tag))selectedTags.delete(tag);else selectedTags.add(tag);
        button.setAttribute('aria-pressed',String(selectedTags.has(tag)));applyFilters();
      });tagFilters.append(button);
    }
  }
  function copy() {
    more.textContent=t('Carregar mais obras','Load more artwork');
    const title=gallery.querySelector('#gallery-title');
    const intro=gallery.querySelector('.fanarts-section-heading > p');
    if(works.length){
      title.textContent=t('Artes da comunidade.','Art from the community.');
      intro.textContent=t('Obras aprovadas, com crédito e região somente quando autorizada pelo artista.',
        'Approved artwork, with credit and region only when authorized by the artist.');
      if(grid)applyFilters();
    }else{title.textContent=t('Em breve, arte de todo lugar.','Art from everywhere, coming soon.');status.textContent='';}
    grid?.querySelectorAll('.fanarts-gallery-work').forEach(figure=>{
      const work=works.find(item=>item.submission_id===figure.dataset.submissionId);
      if(!work)return;
      const image=figure.querySelector('img'),by=figure.querySelector('.fanarts-gallery-artist');
      if(image)image.alt=t(`Fanart “${work.title}”, de ${work.artist_name}`,`Fanart “${work.title}” by ${work.artist_name}`);
      if(by)by.firstChild.textContent=t('Por ','By ');
    });
    gallery.querySelectorAll('[data-tag]').forEach(button=>{
      const tag=button.dataset.tag;
      button.textContent=tagLabel(tag);
    });
  }
  async function load(append=false) {
    if(loading)return;
    loading=true;more.disabled=true;
    status.textContent=t('Carregando galeria…','Loading gallery…');
    let result;
    try {result=await db.from('fanart_gallery')
      .select('submission_id,title,artist_name,artist_link,region,accent,image_path,published_at,tags')
      .order('published_at',{ascending:false}).order('submission_id',{ascending:false}).range(append?offset:0,(append?offset:0)+99);
    }catch(error){result={error};}
    loading=false;more.disabled=false;
    if(result.error){status.textContent=t('Não foi possível carregar a galeria. Tente novamente.','Could not load the gallery. Please retry.');status.classList.add('error');more.hidden=false;return;}
    offset=(append?offset:0)+(result.data||[]).length;
    more.hidden=(result.data||[]).length<100;
    status.classList.remove('error');
    const incoming=(result.data||[]).filter(work=>
      /^[0-9a-f-]{36}\.(?:jpg|png|webp)$/i.test(work.image_path) &&
      typeof work.title==='string' && typeof work.artist_name==='string'
    ).map(work=>({...work,tags:Array.isArray(work.tags)?work.tags.filter(tag=>tagVocabulary.has(tag)).slice(0,8):[]}));
    works=append?[...new Map([...works,...incoming].map(work=>[work.submission_id,work])).values()]:incoming;
    grid?.remove();grid=null;empty.hidden=Boolean(works.length);searchInput.disabled=!works.length;
    if(!append){searchInput.value='';selectedTags.clear();}rebuildTags();
    if(!works.length){copy();return;}
    grid=document.createElement('div');grid.className='fanarts-approved-gallery';
    for(const work of works){
      const figure=document.createElement('figure');figure.className='fanarts-gallery-work';
      figure.dataset.submissionId=work.submission_id;figure.dataset.accent=accent(work);
      figure.dataset.spoiler=String(work.tags.includes('Spoiler'));
      const image=document.createElement('img');image.loading='lazy';image.decoding='async';
      image.src=db.storage.from('fanart-public').getPublicUrl(work.image_path).data.publicUrl;
      image.addEventListener('error',()=>{
        figure.remove();
        if(!grid.children.length){empty.hidden=false;status.textContent=t('As obras publicadas estão temporariamente indisponíveis.','Published artwork is temporarily unavailable.');}
      });
      const caption=document.createElement('figcaption');
      const title=document.createElement('strong');title.textContent=work.title;
      const artist=document.createElement('span');artist.className='fanarts-gallery-artist';
      artist.append(document.createTextNode(t('Por ','By ')));
      if(work.artist_link){const link=document.createElement('a');link.href=work.artist_link;
        link.target='_blank';link.rel='noopener noreferrer';link.textContent=work.artist_name;artist.append(link);
      }else artist.append(document.createTextNode(work.artist_name));
      caption.append(title,artist);
      if(work.region){const region=document.createElement('span');region.textContent=work.region;caption.append(region);}
      if(work.tags.length){const tags=document.createElement('div');tags.className='fanarts-work-tags';
        for(const tag of work.tags){const badge=document.createElement('span');badge.className='fanarts-tag';
          badge.dataset.tag=tag;badge.textContent=tagLabel(tag);tags.append(badge);}caption.append(tags);
      }
      figure.append(image,caption);grid.append(figure);
    }
    more.before(grid);copy();
  }
  new MutationObserver(()=>{
    searchLabel.textContent=t(searchLabel.dataset.pt,searchLabel.dataset.en);
    filterHint.textContent=t(filterHint.dataset.pt,filterHint.dataset.en);
    document.querySelectorAll('.fanarts-subnav [data-pt][data-en]').forEach(node=>node.textContent=t(node.dataset.pt,node.dataset.en));
    copy();
  }).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
  load();
})();
