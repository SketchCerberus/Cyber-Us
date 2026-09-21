/* Open only already-published gallery cards. Never query private submissions. */
(() => {
  'use strict';
  const gallery=document.querySelector('.fanarts-gallery');
  if (!gallery) return;
  const pt=()=>document.documentElement.lang.startsWith('pt');
  const t=(a,b)=>pt()?a:b;
  const detail=document.createElement('section');
  detail.className='fanarts-detail'; detail.id='artwork'; detail.hidden=true;
  detail.setAttribute('aria-labelledby','fanarts-detail-title');
  const header=document.createElement('div'); header.className='fanarts-detail-header';
  const title=document.createElement('h2'); title.id='fanarts-detail-title';
  const close=document.createElement('button'); close.className='fanarts-view-work'; close.type='button';
  close.dataset.pt='Voltar à galeria'; close.dataset.en='Back to gallery';
  close.textContent=t(close.dataset.pt,close.dataset.en);
  const image=document.createElement('img'); image.className='fanarts-detail-image';
  const credit=document.createElement('p'); credit.className='fanarts-hint';
  header.append(title,close); detail.append(header,image,credit); gallery.after(detail);
  let selected=null;
  function openCard(card) {
    const original=card.querySelector('img');
    const caption=card.querySelector('figcaption');
    if (!original || !caption || !original.complete || !original.naturalWidth) return;
    const id=card.dataset.submissionId;
    if (!/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(id||'')) return;
    selected=card;
    title.textContent=caption.querySelector('strong')?.textContent||'';
    credit.textContent=caption.querySelector('.fanarts-gallery-artist')?.textContent||'';
    const region=caption.querySelector('span:not(.fanarts-gallery-artist)');
    if (region) credit.append(document.createTextNode(` · ${region.textContent}`));
    image.src=original.src; image.alt=original.alt;
    detail.hidden=false;
    const url=new URL(location.href); url.searchParams.set('art',id);
    history.replaceState(history.state,'',url.pathname+url.search+url.hash);
    detail.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
    close.focus({preventScroll:true});
  }
  function closeCard() {
    detail.hidden=true; selected=null; image.removeAttribute('src');
    const url=new URL(location.href); url.searchParams.delete('art');
    history.replaceState(history.state,'',url.pathname+url.search+url.hash);
    gallery.scrollIntoView({behavior:'auto'});
  }
  close.addEventListener('click',closeCard);
  gallery.addEventListener('click',event=>{
    const button=event.target.closest('.fanarts-view-work');
    if (button) {const card=button.closest('.fanarts-gallery-work'); if(card)openCard(card);}
  });
  const observer=new MutationObserver(()=>{
    gallery.querySelectorAll('.fanarts-gallery-work').forEach(card=>{
      if (card.querySelector('.fanarts-view-work')) return;
      const button=document.createElement('button'); button.type='button';
      button.className='fanarts-view-work'; button.dataset.pt='Ver arte'; button.dataset.en='View artwork';
      button.textContent=t(button.dataset.pt,button.dataset.en);
      card.querySelector('figcaption')?.append(button);
    });
    if (selected && !selected.isConnected) closeCard();
    const requested=new URLSearchParams(location.search).get('art');
    if (requested && !selected) {
      const card=[...gallery.querySelectorAll('.fanarts-gallery-work')].find(item=>item.dataset.submissionId===requested);
      if (card?.querySelector('img')?.complete) openCard(card);
    }
  });
  observer.observe(gallery,{childList:true,subtree:true});
  new MutationObserver(()=>{close.textContent=t(close.dataset.pt,close.dataset.en);
    gallery.querySelectorAll('.fanarts-view-work').forEach(button=>button.textContent=t(button.dataset.pt,button.dataset.en));
  }).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
})();
