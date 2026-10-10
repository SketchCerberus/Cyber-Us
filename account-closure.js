(() => {
 'use strict';
 const host=document.querySelector('#memberAccount');if(!host)return;
 const db=window.CyberUsGetClient?.();if(!db)return;
 const t=(a,b)=>document.documentElement.lang.startsWith('pt')?a:b;
 const make=(tag,a,b)=>{const e=document.createElement(tag);if(a){e.dataset.pt=a;e.dataset.en=b;e.textContent=t(a,b);}return e;};
 const section=make('section'),heading=make('h3','Excluir minha conta','Delete my account');
 const description=make('p','Esta ação é definitiva: remove seus dados de acesso, nome público, @usuário, avatar, links e região. Comentários e fanarts permanecem com crédito “Conta excluída”. Informações dentro dos textos e imagens permanecem. A newsletter tem descadastro separado no e-mail.','This is permanent: removes login data, public name, username, avatar, links and region. Comments and fanarts remain credited to “Deleted account”. Information within text and images remains. Unsubscribe from the newsletter separately using its email link.');
 const form=make('form');form.className='community-form';
 const label=make('label','Digite EXCLUIR para confirmar','Type DELETE to confirm');label.htmlFor='closeAccountPhrase';
 const phrase=make('input');phrase.id='closeAccountPhrase';phrase.autocomplete='off';phrase.required=true;
 const submit=make('button','Excluir conta definitivamente','Permanently delete account');submit.type='submit';submit.className='community-action danger';
 const status=make('p');status.setAttribute('role','status');
 form.append(label,phrase,submit,status);section.append(heading,description,form);host.append(section);
 form.addEventListener('submit',async event=>{
  event.preventDefault();if(submit.disabled)return;
  if(!['EXCLUIR','DELETE'].includes(phrase.value.trim())){status.textContent=t('Digite a palavra de confirmação.','Type the confirmation word.');return;}
  submit.disabled=true;
  try{
   const {data,error}=await db.functions.invoke('close-account',{body:{confirmation:'delete-account'}});
   if(error){let code;try{code=(await error.context.json()).code;}catch{}
    if(code==='reauth')throw new Error(t('Saia e entre novamente antes de excluir a conta.','Sign out and sign in again before deleting the account.'));
    if(code==='staff')throw new Error(t('Transfira suas responsabilidades na equipe antes de excluir a conta.','Transfer your staff responsibilities before deleting the account.'));
    throw new Error(t('A exclusão não foi concluída. Tente novamente ou contate o autor.','Deletion was not completed. Retry or contact the creator.'));
   }
   if(data?.code!=='closed')throw new Error(t('Não foi possível confirmar a exclusão.','Could not confirm deletion.'));
   await db.auth.signOut({scope:'local'});host.hidden=true;
   const accountStatus=document.querySelector('#accountStatus');if(accountStatus)accountStatus.textContent=t('Conta excluída. Seus conteúdos permanecem com crédito anonimizado.','Account deleted. Your content remains with anonymized credit.');
  }catch(error){status.textContent=error.message;}finally{submit.disabled=false;}
 });
 new MutationObserver(()=>section.querySelectorAll('[data-pt][data-en]').forEach(e=>e.textContent=t(e.dataset.pt,e.dataset.en))).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
})();
