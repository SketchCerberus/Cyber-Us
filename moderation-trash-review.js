/* Replace legacy immediate-file-deletion controls with safe two-month retention. */
(() => {
  'use strict';
  const queue=document.getElementById('moderationFanartQueue');
  const view=document.getElementById('moderationFanartsView');
  if(!queue||!view||!window.supabase?.createClient)return;
  const db=window.supabase.createClient('https://znenamrszhjsiztllcit.supabase.co','sb_publishable_3VRFxwtDuYq4ETHs4xof8g_Fp3GRl6c',{auth:{flowType:'pkce',detectSessionInUrl:false,persistSession:true,autoRefreshToken:true}});
  const t=(br,en)=>document.documentElement.lang.startsWith('pt')?br:en;
  const status=document.getElementById('moderationFanartQueueStatus');
  const notify=(br,en,error=false)=>{if(status){status.textContent=t(br,en);status.classList.toggle('error',error);}};
  async function trash(id,button){
    const response=await db.from('fanart_submissions').select('id,image_path,extension,status').eq('id',id).maybeSingle();
    if(response.error||!response.data)throw response.error||new Error('Submission unavailable');
    const work=response.data;
    if(!['pending','withdrawal_requested'].includes(work.status))throw new Error('Not eligible');
    const reason=work.status==='withdrawal_requested'?t('Retirada solicitada pelo artista','Withdrawal requested by artist'):
      window.prompt(t('Motivo da rejeição (3–500 caracteres):','Reason for rejection (3–500 characters):'));
    if(!reason||reason.trim().length<3||reason.trim().length>500)return;
    if(!window.confirm(t('Enviar a fanart à lixeira por dois meses?','Send artwork to trash for two months?')))return;
    button.disabled=true;
    const path=`${work.id}.${work.extension}`;
    let copied=false;
    let rejected=false;
    try{
      const published=await db.from('fanart_gallery').select('submission_id').eq('submission_id',id).maybeSingle();
      if(published.error)throw published.error;
      if(published.data){
        notify('Guardando cópia privada…','Saving private copy…');
        const backup=await db.storage.from('fanart-public').copy(path,path,{destinationBucket:'fanart-trash'});
        if(backup.error)throw backup.error;
        copied=true;
      }
      const decision=await db.rpc('moderate_fanart_submission',{p_submission_id:id,p_decision:'rejected',p_reason:reason.trim()});
      if(decision.error||decision.data!==true)throw decision.error||new Error('Rejection failed');
      rejected=true;
      let cleanupError=null;
      if(copied){
        const result=await db.storage.from('fanart-public').remove([path]);
        cleanupError=result.error;
      }
      document.getElementById('moderationFanartsTab')?.click();
      if(cleanupError)notify('A obra saiu da galeria, mas a cópia pública precisa de limpeza. A rotina diária tentará novamente.','Removed from gallery; public file cleanup failed and will be retried daily.',true);
      else notify('Fanart na lixeira por dois meses.','Artwork kept in trash for two months.');
    }catch(error){
      if(copied&&!rejected)await db.storage.from('fanart-trash').remove([path]);
      notify('Falha ao enviar para a lixeira. O arquivo original não foi excluído.','Could not move to trash. The original file was not deleted.',true);
      button.disabled=false;
    }
  }
  function decorate(){
    for(const oldButton of queue.querySelectorAll('button[id^="fanartReject-"]')){
      if(oldButton.dataset.trashReplaced==='true')continue;
      oldButton.dataset.trashReplaced='true';
      oldButton.disabled=true;oldButton.hidden=true;oldButton.style.display='none';
      const button=document.createElement('button');button.type='button';button.className=oldButton.className;
      button.dataset.trashAction='true';button.textContent=t('Enviar à lixeira','Move to trash');
      button.addEventListener('click',()=>trash(oldButton.id.slice('fanartReject-'.length),button).catch(()=>{
        notify('Erro inesperado.','Unexpected error.',true);button.disabled=false;
      }));
      oldButton.after(button);
    }
  }
  new MutationObserver(decorate).observe(queue,{childList:true,subtree:true});
  new MutationObserver(()=>queue.querySelectorAll('button[data-trash-action]').forEach(button=>button.textContent=t('Enviar à lixeira','Move to trash')))
    .observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
  decorate();
})();
