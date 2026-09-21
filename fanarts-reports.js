/* Comment reports: never read private account IDs or expose pending reports to visitors. */
(() => {
  'use strict';
  const comments=document.querySelector('.fanarts-comments');
  if(!comments||!window.supabase?.createClient)return;
  const db=window.supabase.createClient('https://znenamrszhjsiztllcit.supabase.co',
    'sb_publishable_3VRFxwtDuYq4ETHs4xof8g_Fp3GRl6c',
    {auth:{flowType:'pkce',detectSessionInUrl:false,persistSession:true,autoRefreshToken:true}});
  const pt=()=>document.documentElement.lang.startsWith('pt');
  const t=(br,en)=>pt()?br:en;
  const translatable=[];
  function local(node,br,en){node.dataset.pt=br;node.dataset.en=en;node.textContent=t(br,en);translatable.push(node);return node;}
  function decorate(){
    comments.querySelectorAll('.fanarts-comment[data-comment-id]').forEach(article=>{
      if(article.dataset.reportReady==='true')return;
      const id=Number(article.dataset.commentId);
      if(!Number.isSafeInteger(id)||id<=0)return;
      article.dataset.reportReady='true';
      const trigger=local(document.createElement('button'),'Denunciar comentário','Report comment');
      trigger.type='button';trigger.className='fanarts-report-comment';
      const form=document.createElement('form');form.className='fanarts-comment-form fanarts-report-form';form.hidden=true;
      const reasonLabel=local(document.createElement('label'),'Motivo da denúncia','Reason for reporting');
      const reason=document.createElement('select');reason.required=true;
      const choices=[['','Selecione um motivo','Choose a reason'],['spam','Spam','Spam'],
        ['harassment','Ofensa ou assédio','Abuse or harassment'],['spoiler','Spoiler não sinalizado','Unmarked spoiler'],
        ['other','Outro','Other']];
      for(const [value,br,en] of choices){const option=local(document.createElement('option'),br,en);option.value=value;reason.append(option);}
      const detailsLabel=local(document.createElement('label'),'Detalhes (opcional; até 300 caracteres)','Details (optional; up to 300 characters)');
      const details=document.createElement('textarea');details.maxLength=300;details.rows=3;
      const submit=local(document.createElement('button'),'Enviar denúncia','Submit report');
      submit.type='submit';submit.className='fanarts-view-work';
      const cancel=local(document.createElement('button'),'Cancelar','Cancel');
      cancel.type='button';cancel.className='fanarts-report-comment';
      const status=document.createElement('p');status.className='fanarts-hint';status.setAttribute('role','status');
      const say=(br,en,error=false)=>{status.dataset.pt=br;status.dataset.en=en;
        status.textContent=t(br,en);status.classList.toggle('error',error);};
      reasonLabel.append(reason);detailsLabel.append(details);
      form.append(reasonLabel,detailsLabel,submit,cancel);
      trigger.addEventListener('click',()=>{form.hidden=!form.hidden;if(!form.hidden)reason.focus();});
      cancel.addEventListener('click',()=>{form.hidden=true;trigger.focus();});
      form.addEventListener('submit',async event=>{
        event.preventDefault();if(!form.reportValidity())return;
        const selected=reason.value,description=details.value.trim();
        if(!['spam','harassment','spoiler','other'].includes(selected)||description.length>300)return;
        submit.disabled=true;say('Verificando conta…','Checking account…');
        try{
          const auth=await db.auth.getUser();
          if(auth.error||!auth.data?.user?.email_confirmed_at){
            say('Entre em uma conta verificada para denunciar.','Sign in with a verified account to report.',true);return;
          }
          const ban=await db.rpc('is_banned');
          if(ban.error||ban.data===true){say('Esta conta não pode enviar denúncias.','This account cannot submit reports.',true);return;}
          const result=await db.from('fanart_comment_reports').insert({comment_id:id,reason:description?`${selected}: ${description}`:selected});
          if(result.error){say('Não foi possível denunciar. Confira se já denunciou este comentário ou atingiu o limite diário.',
            'Could not report. You may have already reported this comment or reached the daily limit.',true);return;}
          form.hidden=true;trigger.disabled=true;
          say('Denúncia enviada à moderação. Obrigado por avisar.','Report sent privately to moderators. Thank you.');
        }catch(_){say('Serviço indisponível. Tente mais tarde.','Service unavailable. Try later.',true);}
        finally{submit.disabled=false;}
      });
      article.append(trigger,form,status);
    });
  }
  new MutationObserver(decorate).observe(comments,{childList:true,subtree:true});
  new MutationObserver(()=>{
    for(const node of translatable){if(node.isConnected)node.textContent=t(node.dataset.pt,node.dataset.en);}
    comments.querySelectorAll('.fanarts-report-form + .fanarts-hint').forEach(node=>{
      if(node.dataset.pt)node.textContent=t(node.dataset.pt,node.dataset.en);
    });
  }).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
  decorate();
})();
