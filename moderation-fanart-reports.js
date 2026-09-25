/* Unified private report queue. RPCs enforce staff hierarchy and return no account IDs. */
(() => {
  'use strict';
  const workspace=document.getElementById('moderationWorkspace');
  if(!workspace||!window.supabase?.createClient)return;
  const db=window.supabase.createClient('https://znenamrszhjsiztllcit.supabase.co','sb_publishable_3VRFxwtDuYq4ETHs4xof8g_Fp3GRl6c',
    {auth:{flowType:'pkce',detectSessionInUrl:false,persistSession:true,autoRefreshToken:true}});
  const t=(br,en)=>document.documentElement.lang.startsWith('pt')?br:en;
  const el=(tag,br,en)=>{const n=document.createElement(tag);if(br!==undefined){n.dataset.pt=br;n.dataset.en=en;n.textContent=t(br,en);}return n;};
  const panel=el('details');panel.className='content-report-queue';
  const heading=el('summary','Denúncias da comunidade','Community reports');
  const hint=el('p','Comentários, respostas e obras. Denúncias sobre membros da equipe ficam restritas ao criador.','Comments, replies and artwork. Reports about staff are restricted to the creator.');
  const filterLabel=el('label','Situação das denúncias','Report status');
  const filter=el('select');filter.id='report-status-filter';filterLabel.htmlFor=filter.id;
  for(const [value,br,en] of [['open','Em aberto','Open'],['dismissed','Dispensadas','Dismissed'],['resolved','Conteúdo moderado','Content moderated']]){const o=el('option',br,en);o.value=value;filter.append(o);}
  const refresh=el('button','Atualizar denúncias','Refresh reports');refresh.type='button';
  const status=el('p');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  const list=el('ol');
  const more=el('button','Carregar mais','Load more');more.type='button';more.hidden=true;
  panel.append(heading,hint,filterLabel,filter,refresh,status,list,more);workspace.prepend(panel);
  let ticket=0,cursor=null,loading=false;
  const say=(br,en)=>{status.dataset.pt=br;status.dataset.en=en;status.textContent=t(br,en);};
  async function removeArtwork(report){
    const current=await db.from('fanart_gallery').select('image_path').eq('submission_id',report.target_id).maybeSingle();
    if(current.error)throw current.error;
    if(!current.data)return null; // Already removed: the server still audits resolution.
    const path=current.data.image_path;
    const copy=await db.storage.from('fanart-public').copy(path,path,{destinationBucket:'fanart-trash'});
    if(copy.error){
      // A prior attempt may have saved the backup before a network interruption.
      const existing=await db.storage.from('fanart-trash').download(path);
      if(existing.error||!existing.data)throw copy.error;
    }
    return path;
  }
  function render(report){
    const li=el('li');
    const title=el('h3',report.kind==='fanart'?'Obra da galeria':report.kind==='episode_comment'?'Comentário de episódio / resposta':'Comentário de fanart',report.kind==='fanart'?'Gallery artwork':report.kind==='episode_comment'?'Episode comment / reply':'Fanart comment');
    const meta=el('p');meta.textContent=`#${report.id} · ${new Date(report.created_at).toLocaleString(document.documentElement.lang)}`;
    const reason=el('p');reason.textContent=report.reason;
    const evidence=el('blockquote');evidence.textContent=report.evidence;
    const context=el('p');context.textContent=report.context;
    li.append(title,meta,reason,el('p','Conteúdo no momento da denúncia:','Content at the time of the report:'),evidence,context);
    if(report.kind==='fanart'&&/^[0-9a-f-]{36}\.(jpg|png|webp)$/i.test(report.context)){
      const image=el('img');image.alt=t('Obra denunciada','Reported artwork');image.loading='lazy';
      image.src=db.storage.from('fanart-public').getPublicUrl(report.context).data.publicUrl;
      image.addEventListener('error',async()=>{if(image.dataset.retried)return;image.dataset.retried='true';
        const signed=await db.storage.from('fanart-trash').createSignedUrl(report.context,300);
        if(signed.data?.signedUrl)image.src=signed.data.signedUrl;else image.hidden=true;});li.append(image);
    }
    if(report.status!=='open'){
      const decision=el('p');decision.textContent=report.resolution_reason;li.append(decision);return li;
    }
    const form=el('form');
    const label=el('label','Motivo da decisão (3–500 caracteres)','Decision reason (3–500 characters)');
    const input=el('textarea');input.id=`report-decision-${report.id}`;label.htmlFor=input.id;input.required=true;input.minLength=3;input.maxLength=500;
    const actionLabel=el('label','Decisão','Decision');
    const action=el('select');action.id=`report-action-${report.id}`;actionLabel.htmlFor=action.id;
    for(const [value,br,en] of [['dismiss','Dispensar denúncia','Dismiss report'],['remove',report.kind==='fanart'?'Retirar obra e guardar na lixeira':'Remover comentário',report.kind==='fanart'?'Remove artwork and keep in trash':'Remove comment']]){const o=el('option',br,en);o.value=value;action.append(o);}
    const submit=el('button','Confirmar decisão','Confirm decision');submit.type='submit';
    const feedback=el('p');feedback.setAttribute('role','status');
    form.append(label,input,actionLabel,action,submit,feedback);li.append(form);
    form.addEventListener('submit',async event=>{
      event.preventDefault();if(submit.disabled||!form.reportValidity()||input.value.trim().length<3)return;
      const why=input.value.trim(),decision=action.value,identity=ticket;
      submit.disabled=true;input.disabled=true;action.disabled=true;
      let path=null,committed=false;
      try{
        if(decision==='remove'&&report.kind==='fanart')path=await removeArtwork(report);
        if(identity!==ticket||workspace.hidden)return;
        const result=await db.rpc('resolve_content_report',{p_id:report.id,p_action:decision,p_reason:why});
        if(result.error)throw result.error;
        if(result.data!==true){feedback.textContent=t('A denúncia já foi tratada. Atualize a fila.','Report already handled. Refresh the queue.');return;}
        committed=true;
        if(path){const cleanup=await db.storage.from('fanart-public').remove([path]);if(cleanup.error){
          await load(false);say('Decisão registrada. A limpeza do arquivo público falhou; a rotina diária tentará novamente.','Decision recorded. Public file cleanup failed; the daily job will retry.');return;}}
        await load(false);say('Decisão registrada com auditoria.','Decision recorded with an audit trail.');
      }catch(_){feedback.textContent=committed?t('Decisão registrada, mas houve falha na atualização. Atualize a fila.','Decision recorded, but refresh failed. Reload the queue.'):
        t('Não foi possível confirmar a decisão. Atualize a fila antes de tentar novamente.','Could not confirm the decision. Refresh before retrying.');}
      finally{submit.disabled=false;input.disabled=false;action.disabled=false;}
      // Retain any private backup on failure: another moderator may be using it.
    });
    return li;
  }
  async function load(append=false){
    if(loading||!panel.open||workspace.hidden)return;
    loading=true;refresh.disabled=true;more.disabled=true;const current=++ticket;
    if(!append){cursor=null;list.replaceChildren();}more.hidden=true;
    say('Carregando denúncias…','Loading reports…');
    try{
      const result=await db.rpc('list_content_reports',{p_before:cursor,p_status:filter.value});
      if(current!==ticket)return;
      if(result.error)throw result.error;
      const rows=result.data||[];for(const row of rows)list.append(render(row));
      cursor=rows.at(-1)?.id||cursor;more.hidden=rows.length<50;
      say(list.children.length?'Denúncias carregadas.':'Nenhuma denúncia nesta situação.',list.children.length?'Reports loaded.':'No reports with this status.');
    }catch(_){if(current===ticket)say('Não foi possível carregar as denúncias. Verifique seu acesso e tente novamente.','Could not load reports. Check your access and try again.');}
    finally{loading=false;refresh.disabled=false;more.disabled=false;}
  }
  panel.addEventListener('toggle',()=>{if(panel.open)load(false);});refresh.addEventListener('click',()=>load(false));
  filter.addEventListener('change',()=>{++ticket;loading=false;load(false);});more.addEventListener('click',()=>load(true));
  db.auth.onAuthStateChange(()=>{++ticket;list.replaceChildren();panel.open=false;cursor=null;});
  new MutationObserver(()=>{panel.querySelectorAll('[data-pt][data-en]').forEach(n=>n.textContent=t(n.dataset.pt,n.dataset.en));})
    .observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
})();
