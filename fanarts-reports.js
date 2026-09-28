/* Shared private reporting UI; target IDs are public content IDs only. */
(() => {
  'use strict';
  if(!window.supabase?.createClient)return;
  const db=window.supabase.createClient('https://znenamrszhjsiztllcit.supabase.co','sb_publishable_3VRFxwtDuYq4ETHs4xof8g_Fp3GRl6c',
    {auth:{flowType:'pkce',detectSessionInUrl:false,persistSession:true,autoRefreshToken:true}});
  const t=(br,en)=>document.documentElement.lang.startsWith('pt')?br:en;
  const local=(tag,br,en)=>{const n=document.createElement(tag);n.dataset.pt=br;n.dataset.en=en;n.textContent=t(br,en);return n;};
  let sequence=0;
  function mount(host,kind,id){
    if(host.querySelector(':scope > .content-report'))return;
    const box=document.createElement('div');box.className='content-report';
    const trigger=local('button',kind==='fanart'?'Denunciar obra':'Denunciar comentário',kind==='fanart'?'Report artwork':'Report comment');
    trigger.type='button';trigger.className='content-report-trigger';trigger.setAttribute('aria-expanded','false');
    const form=document.createElement('form');form.hidden=true;form.id=`content-report-${++sequence}`;trigger.setAttribute('aria-controls',form.id);
    const hint=local('p','Sua denúncia será enviada em privado à equipe. Sua identidade não será mostrada ao autor.','Your report is sent privately to staff. Your identity will not be shown to the author.');
    const reasonLabel=local('label','Motivo','Reason');
    const reason=document.createElement('select');reason.id=`${form.id}-reason`;reason.required=true;reasonLabel.htmlFor=reason.id;
    for(const [value,br,en] of [['','Selecione um motivo','Choose a reason'],['spam','Spam','Spam'],['harassment','Ofensa ou assédio','Abuse or harassment'],['spoiler','Spoiler não sinalizado','Unmarked spoiler'],['copyright','Direitos autorais','Copyright'],['inappropriate','Conteúdo impróprio','Inappropriate content'],['other','Outro','Other']]){
      const option=local('option',br,en);option.value=value;reason.append(option);
    }
    const detailsLabel=local('label','Detalhes (opcional; até 300 caracteres)','Details (optional; up to 300 characters)');
    const details=document.createElement('textarea');details.id=`${form.id}-details`;details.rows=3;details.maxLength=300;detailsLabel.htmlFor=details.id;
    const send=local('button','Enviar denúncia','Submit report');send.type='submit';
    const cancel=local('button','Cancelar','Cancel');cancel.type='button';
    const status=document.createElement('p');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
    const say=(br,en)=>{status.dataset.pt=br;status.dataset.en=en;status.textContent=t(br,en);};
    const close=()=>{form.hidden=true;trigger.setAttribute('aria-expanded','false');trigger.focus();};
    trigger.addEventListener('click',()=>{form.hidden=!form.hidden;trigger.setAttribute('aria-expanded',String(!form.hidden));if(!form.hidden)reason.focus();});
    cancel.addEventListener('click',close);
    form.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();close();}});
    let pending=false;
    form.addEventListener('submit',async event=>{
      event.preventDefault();if(pending||!form.reportValidity())return;
      pending=true;send.disabled=true;cancel.disabled=true;
      // Capture the target and input before any account/network operation.
      const selected=reason.value,description=details.value.trim();
      try{
        const auth=await db.auth.getUser();
        if(auth.error||!auth.data?.user?.email_confirmed_at){say('Entre em uma conta verificada para denunciar.','Sign in with a verified account to report.');return;}
        const result=await db.rpc('submit_content_report',{p_kind:kind,p_target_id:id,p_reason:selected,p_details:description});
        if(result.error){
          if(result.error.code==='23505')say('Você já denunciou este conteúdo.','You have already reported this content.');
          else if(result.error.code==='P0001')say('Limite de 20 denúncias em 24 horas atingido. Tente mais tarde.','You reached the limit of 20 reports in 24 hours. Try later.');
          else say('Não foi possível denunciar. Verifique sua conta; o conteúdo pode ser seu ou não estar mais disponível.','Could not report. Check your account; the content may be yours or no longer available.');
          return;
        }
        if(result.data!==true)throw new Error('Report not confirmed');
        close();reason.value='';details.value='';
        say('Denúncia enviada em privado à moderação.','Report sent privately to moderators.');
      }catch(_){say('Serviço indisponível. Tente novamente.','Service unavailable. Please try again.');}
      finally{pending=false;send.disabled=false;cancel.disabled=false;}
    });
    form.append(hint,reasonLabel,reason,detailsLabel,details,send,cancel);box.append(trigger,form,status);host.append(box);
  }
  function decorate(){
    document.querySelectorAll('.comment-item[data-report-id]').forEach(n=>mount(n,'episode_comment',n.dataset.reportId));
    document.querySelectorAll('.fanarts-comment[data-comment-id]').forEach(n=>mount(n,'fanart_comment',n.dataset.commentId));
    document.querySelectorAll('.fanarts-gallery-work[data-submission-id]').forEach(n=>mount(n,'fanart',n.dataset.submissionId));
    document.querySelectorAll('.fanarts-detail[data-submission-id]').forEach(n=>{
      const old=n.querySelector(':scope > .content-report');
      if(n.dataset.reportTarget!==n.dataset.submissionId){old?.remove();n.dataset.reportTarget=n.dataset.submissionId;}
      mount(n,'fanart',n.dataset.submissionId);
    });
  }
  new MutationObserver(decorate).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['data-submission-id']});
  new MutationObserver(()=>document.querySelectorAll('.content-report [data-pt][data-en]').forEach(n=>n.textContent=t(n.dataset.pt,n.dataset.en)))
    .observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
  decorate();
})();
