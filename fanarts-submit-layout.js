/* Presentation-only enhancement. Move existing controls, never clone/replace inputs or submit handlers. */
(() => {
  'use strict';
  const root=document.querySelector('.fanarts-submission');
  const preview=root?.querySelector('.fanarts-form-preview');
  const form=preview?.querySelector('#fanart-upload-form');
  const fieldset=form?.querySelector('fieldset');
  const tags=fieldset?.querySelector('.fanarts-tag-choices');
  const image=document.getElementById('fanarts-image');
  const previewCard=document.getElementById('fanarts-upload-preview');
  const button=fieldset?.querySelector('button[type="submit"]');
  if(!root||!fieldset||!tags||!image||!previewCard||!button)return;
  root.classList.add('fanarts-submit-refined');
  root.firstElementChild?.classList.add('fanarts-submit-intro');
  preview.classList.add('fanarts-submit-workspace');
  const pt=()=>document.documentElement.lang.startsWith('pt');
  const translate=(br,en)=>pt()?br:en;
  const localized=[];
  const text=(element,br,en)=>{
    element.dataset.pt=br;element.dataset.en=en;
    element.textContent=translate(br,en);
    localized.push(element);
    return element;
  };
  const make=(tag,className)=>{
    const element=document.createElement(tag);
    if(className)element.className=className;
    return element;
  };
  const section=(id,br,en)=>{
    const panel=make('section','fanarts-form-section');
    const heading=text(make('h2'),br,en);
    heading.id=id;panel.setAttribute('aria-labelledby',id);
    panel.append(heading);
    return panel;
  };
  const moveField=(panel,id)=>{
    const input=document.getElementById(id);
    const label=fieldset.querySelector(`label[for="${id}"]`);
    if(!input||!label)return;
    const item=make('div','fanarts-form-field');
    item.append(label,input);panel.append(item);
    return item;
  };
  const layout=make('div','fanarts-form-layout');
  const primary=make('div','fanarts-form-column');
  const secondary=make('div','fanarts-form-column');
  const info=section('fanarts-info-heading','01 / Informações da obra','01 / Artwork details');
  moveField(info,'fanarts-name');
  moveField(info,'fanarts-art-title');
  moveField(info,'fanarts-country');
  const showRegion=document.getElementById('fanarts-publish-country')?.closest('label');
  if(showRegion){showRegion.classList.add('fanarts-inline-check');info.append(showRegion);}
  moveField(info,'fanarts-artist-link');
  primary.append(info);
  const upload=section('fanarts-file-heading','02 / Arquivo da arte','02 / Artwork file');
  const fileField=moveField(upload,'fanarts-image');
  if(fileField)fileField.append(text(make('p','fanarts-form-helper'),'PNG, JPG ou WebP · Até 5 MB · Máximo de 4096 × 4096 pixels.','PNG, JPG or WebP · Up to 5 MB · Maximum 4096 × 4096 pixels.'));
  primary.append(upload);
  const classification=section('fanarts-classification-heading','03 / Classificação e aparência','03 / Tags and appearance');
  classification.append(tags);
  const categories=[
    ['Personagens','Characters',['Auará','Kaubi','Óete','Sistema','Trojan','Malware','OC']],
    ['Temas','Themes',['Ships','Crossover','Grupo','Swap','E se...','AU','Colaboração']],
    ['Estilos e avisos','Styles and notices',['Fofo','Sério','Chibi','Humor','WIP','Spoiler']]
  ];
  for(const [br,en,values] of categories){
    const group=make('div','fanarts-tag-category');
    group.append(text(make('h3'),br,en));
    const choices=make('div','fanarts-tag-chip-list');
    for(const value of values){
      const tag=[...tags.querySelectorAll('label.fanarts-check')].find(label=>label.querySelector('input')?.value===value);
      if(tag)choices.append(tag);
    }
    group.append(choices);tags.append(group);
  }
  moveField(classification,'fanarts-accent');
  secondary.append(classification);
  const review=section('fanarts-preview-heading','04 / Prévia e resumo','04 / Preview and summary');
  const placeholder=make('div','fanarts-preview-placeholder');
  placeholder.append(text(make('strong'),'Sua arte aparece aqui','Your artwork appears here'));
  placeholder.append(text(make('p'),'Selecione um arquivo para ver como a fanart ficará antes de enviar.','Choose a file to see how the artwork will look before uploading.'));
  review.append(placeholder,previewCard);
  const summary=make('div','fanarts-submission-summary');
  summary.append(text(make('h3'),'Resumo do envio','Submission summary'));
  const details=make('dl');
  const entries=[
    ['artist','Autor','Artist'],['title','Título','Title'],['tags','Tags','Tags'],
    ['region','Região visível','Visible region'],['spoiler','Spoiler','Spoiler']
  ];
  const values={};
  for(const [key,br,en] of entries){
    const dt=text(make('dt'),br,en);
    const dd=make('dd');dd.id=`fanarts-summary-${key}`;
    details.append(dt,dd);values[key]=dd;
  }
  summary.append(details);review.append(summary);secondary.append(review);
  layout.append(primary,secondary);
  // Consent and the original submit button remain INSIDE the original disabled fieldset.
  const footer=make('div','fanarts-form-footer');
  const rights=document.getElementById('fanarts-original')?.closest('label');
  if(rights)footer.append(rights);
  const conversion=[...fieldset.querySelectorAll('label.fanarts-check')].find(label=>label.querySelector('input[type="checkbox"]:required:not([id])'));
  if(conversion)footer.append(conversion);
  const terms=[...fieldset.querySelectorAll('p.fanarts-hint')].find(p=>p.dataset.pt?.includes('Até 5 MB'));
  if(terms)footer.append(terms);
  footer.append(button);
  fieldset.append(layout,footer);
  const title=document.getElementById('fanarts-art-title');
  const artist=document.getElementById('fanarts-name');
  const region=document.getElementById('fanarts-country');
  const showRegionInput=document.getElementById('fanarts-publish-country');
  const spoiler=tags.querySelector('input[value="Spoiler"]');
  const tagInputs=[...tags.querySelectorAll('input[name="fanart-tag"]')];
  const update=()=>{
    const blank=translate('Ainda não informado','Not provided yet');
    values.artist.textContent=artist?.value.trim()||blank;
    values.title.textContent=title?.value.trim()||blank;
    values.tags.textContent=`${tagInputs.filter(input=>input.checked).length}/8`;
    values.region.textContent=showRegionInput?.checked&&region?.value.trim()?translate('Sim','Yes'):translate('Não','No');
    values.spoiler.textContent=spoiler?.checked?translate('Sim','Yes'):translate('Não','No');
    placeholder.hidden=!previewCard.hidden;
  };
  for(const input of [title,artist,region,showRegionInput,image,...tagInputs]){
    input?.addEventListener('input',update);
    input?.addEventListener('change',update);
  }
  form.addEventListener('reset',()=>queueMicrotask(update));
  window.addEventListener('cyberus:fanart-uploaded',()=>queueMicrotask(update));
  new MutationObserver(()=>{
    localized.forEach(node=>{node.textContent=translate(node.dataset.pt,node.dataset.en);});
    update();
  }).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
  update();
})();
