/* Reader-controlled spoiler cover. Approved images are public URLs: this is a visual warning, not access control. */
(() => {
  'use strict';
  const gallery=document.querySelector('.fanarts-gallery');
  if(!gallery)return;
  const pt=()=>document.documentElement.lang.startsWith('pt');
  const text=(br,en)=>pt()?br:en;
  // MutationObserver observes childList; only write text when it has really changed.
  const label=(button,br,en)=>{
    button.dataset.pt=br;button.dataset.en=en;
    const value=text(br,en);
    if(button.textContent!==value)button.textContent=value;
  };
  function lockCard(card){
    if(card.dataset.spoiler!=='true'||card.dataset.spoilerEnhanced==='true')return;
    const image=card.querySelector('img'),caption=card.querySelector('figcaption');
    if(!image||!caption)return;
    card.dataset.spoilerEnhanced='true';card.classList.add('fanarts-spoiler-locked');
    image.dataset.artworkAlt=image.alt;
    image.alt=text('Fanart com spoiler oculto','Spoiler artwork hidden');
    const reveal=document.createElement('button');reveal.type='button';
    reveal.className='fanarts-spoiler-reveal';
    label(reveal,'Spoiler · Revelar imagem','Spoiler · Reveal artwork');
    reveal.addEventListener('click',event=>{
      event.stopPropagation();card.classList.remove('fanarts-spoiler-locked');
      card.classList.add('fanarts-spoiler-revealed');reveal.remove();
      image.alt=image.dataset.artworkAlt||text('Fanart revelada','Revealed fanart');
      caption.querySelector('.fanarts-view-work')?.focus({preventScroll:true});
    });
    card.insertBefore(reveal,caption);
  }
  function syncCards(){
    gallery.querySelectorAll('.fanarts-gallery-work').forEach(card=>{
      if(card.dataset.spoiler!=='true')return;
      lockCard(card);
      const image=card.querySelector('img');
      if(card.classList.contains('fanarts-spoiler-locked')&&image){
        const hiddenAlt=text('Fanart com spoiler oculto','Spoiler artwork hidden');
        if(image.alt!==hiddenAlt){
          // The gallery's language switch can refresh alt; retain that translation
          // without exposing the title while the spoiler is still covered.
          if(image.alt!=='Fanart com spoiler oculto'&&image.alt!=='Spoiler artwork hidden')
            image.dataset.artworkAlt=image.alt;
          image.alt=hiddenAlt;
        }
      }
      const button=card.querySelector('.fanarts-spoiler-reveal');
      if(button)label(button,'Spoiler · Revelar imagem','Spoiler · Reveal artwork');
    });
  }
  const detail=document.querySelector('.fanarts-detail');
  let detailReveal=null;
  if(detail){
    const image=detail.querySelector('.fanarts-detail-image');
    detailReveal=document.createElement('button');detailReveal.type='button';
    detailReveal.className='fanarts-spoiler-detail-reveal fanarts-view-work';
    label(detailReveal,'Spoiler · Revelar imagem','Spoiler · Reveal artwork');
    detailReveal.hidden=true;image?.before(detailReveal);
    detailReveal.addEventListener('click',()=>{
      const id=new URLSearchParams(location.search).get('art');
      const selected=[...gallery.querySelectorAll('.fanarts-gallery-work')].find(card=>card.dataset.submissionId===id);
      detail.classList.remove('fanarts-detail-spoiler-locked');detailReveal.hidden=true;
      if(image)image.alt=selected?.querySelector('img')?.dataset.artworkAlt||selected?.querySelector('img')?.alt||text('Fanart revelada','Revealed artwork');
      detail.querySelector('.fanarts-detail-header .fanarts-view-work')?.focus({preventScroll:true});
    });
    function syncDetail(){
      if(detail.hidden){detail.classList.remove('fanarts-detail-spoiler-locked');detailReveal.hidden=true;return;}
      const id=new URLSearchParams(location.search).get('art');
      const card=[...gallery.querySelectorAll('.fanarts-gallery-work')].find(node=>node.dataset.submissionId===id);
      if(card?.dataset.spoiler==='true'){
        detail.classList.add('fanarts-detail-spoiler-locked');detailReveal.hidden=false;
        if(image)image.alt=text('Fanart com spoiler oculto','Spoiler artwork hidden');
      }else{detail.classList.remove('fanarts-detail-spoiler-locked');detailReveal.hidden=true;}
      label(detailReveal,'Spoiler · Revelar imagem','Spoiler · Reveal artwork');
    }
    new MutationObserver(syncDetail).observe(detail,{attributes:true,attributeFilter:['hidden']});
  }
  new MutationObserver(syncCards).observe(gallery,{childList:true,subtree:true});
  new MutationObserver(()=>{
    syncCards();
    if(detailReveal&&!detailReveal.hidden)label(detailReveal,'Spoiler · Revelar imagem','Spoiler · Reveal artwork');
  }).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
  syncCards();
})();
