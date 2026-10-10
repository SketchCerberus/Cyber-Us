/* Owner controls are advisory: Postgres rechecks identity, bans and version. */
(() => {
  'use strict';
  let sequence=0;
  const prefix='[CYBER-US-SPOILER]\n';
  const t=(a,b)=>document.documentElement.lang.startsWith('pt')?a:b;
  const make=(tag,pt,en)=>{
    const e=document.createElement(tag);
    if(pt){e.dataset.pt=pt;e.dataset.en=en;e.className='comment-editor-label';e.textContent=t(pt,en);}return e;
  };
  window.CyberUsCommentEditor={mount({container,comment,kind,db,eligible,onSaved}){
    if(comment.edited_at)container.append(make('small','Editado','Edited'));
    if(!eligible())return;
    const edit=make('button','Editar meu comentário','Edit my comment');edit.type='button';edit.className+=' community-action fanarts-view-work';
    const form=make('form');form.className='comment-edit-form';form.hidden=true;
    const label=make('label','Editar comentário','Edit comment'),input=make('textarea');
    input.id='comment-edit-'+(++sequence);label.htmlFor=input.id;input.required=true;input.maxLength=kind==='episode'?2000:1000;input.rows=4;
    const spoiler=make('input');spoiler.type='checkbox';
    const spoilerLabel=make('label');spoilerLabel.append(spoiler,make('span','Contém spoilers','Contains spoilers'));spoilerLabel.hidden=kind!=='episode';
    const save=make('button','Salvar','Save');save.type='submit';save.className+=' community-action fanarts-view-work';
    const cancel=make('button','Cancelar','Cancel');cancel.type='button';cancel.className=save.className;
    const status=make('p');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
    form.append(label,input,spoilerLabel,save,cancel,status);container.append(edit,form);
    const close=()=>{form.hidden=true;edit.hidden=false;edit.focus();};
    edit.addEventListener('click',()=>{
      if(!eligible())return;
      spoiler.checked=comment.body.startsWith(prefix);input.value=spoiler.checked?comment.body.slice(prefix.length):comment.body;
      status.textContent='';form.hidden=false;edit.hidden=true;input.focus();
    });
    cancel.addEventListener('click',close);
    form.addEventListener('keydown',e=>{if(e.key==='Escape'&&!save.disabled){e.preventDefault();close();}});
    form.addEventListener('submit',async e=>{
      e.preventDefault();if(save.disabled||!eligible())return;
      const body=(kind==='episode'&&spoiler.checked?prefix:'')+input.value.trim();
      if(!input.value.trim()||body.length>input.maxLength){status.textContent=t('Confira o tamanho do comentário.','Check the comment length.');return;}
      save.disabled=cancel.disabled=true;
      try{
        const result=await db.rpc('edit_own_comment',{p_kind:kind,p_id:String(comment.id),p_body:body,p_expected:comment.updated_at||comment.created_at});
        if(result.error)throw result.error;
        if(!result.data)throw new Error('Unavailable');
        await onSaved();
      }catch(error){status.textContent=error?.code==='40001'?t('O comentário mudou. Copie seu texto e recarregue antes de editar.','The comment changed. Copy your text and reload before editing.'):t('Não foi possível salvar. Seu texto foi preservado; confira sua sessão e tente novamente.','Could not save. Your text was preserved; check your session and try again.');}
      finally{save.disabled=cancel.disabled=false;}
    });
  }};
  new MutationObserver(()=>document.querySelectorAll('.comment-editor-label').forEach(e=>e.textContent=t(e.dataset.pt,e.dataset.en))).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
})();
