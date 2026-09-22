/* A removed moderator may appeal their latest removal, even without staff access. */
(() => {
  'use strict';
  const host=document.getElementById('memberAccount');
  if(!host||!window.supabase?.createClient)return;
  const db=window.supabase.createClient('https://znenamrszhjsiztllcit.supabase.co',
    'sb_publishable_3VRFxwtDuYq4ETHs4xof8g_Fp3GRl6c',
    {auth:{flowType:'pkce',detectSessionInUrl:false,persistSession:true,autoRefreshToken:true}});
  const pt=()=>document.documentElement.lang.startsWith('pt');
  const t=(br,en)=>pt()?br:en;
  const node=(tag,cls,text)=>{const x=document.createElement(tag);if(cls)x.className=cls;
    if(text!==undefined)x.textContent=text;return x;};
  const section=node('section','community-box staff-appeal-section');section.hidden=true;
  const title=node('h2'),intro=node('p','community-hint'),status=node('p','community-notice');
  status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  const form=node('form','community-form');
  const label=node('label');const body=node('textarea');body.required=true;body.minLength=20;
  body.maxLength=2000;body.rows=5;label.append(body);
  const send=node('button','action');send.type='submit';form.append(label,send);
  section.append(title,intro,form,status);host.append(section);
  let action=null,identity=0;
  function language(){
    title.textContent=t('Recurso da moderação','Moderator role appeal');
    intro.textContent=action?.reason?t(`Motivo da remoção: ${action.reason}`,`Removal reason: ${action.reason}`):'';
    label.firstChild?.nodeType;
    Array.from(label.childNodes).filter(n=>n.nodeType===3).forEach(n=>n.remove());
    label.prepend(document.createTextNode(t('Explique seu recurso (20–2.000 caracteres): ',
      'Explain your appeal (20–2,000 characters): ')));
    send.textContent=t('Enviar recurso ao Criador','Submit appeal to Creator');
    if(action?.appeal_status){
      form.hidden=true;
      status.textContent=action.appeal_status==='pending'?t('Seu recurso está aguardando a decisão do Criador.',
        'Your appeal awaits the Creator’s decision.'):
        t(`Recurso ${action.appeal_status==='approved'?'aceito':'negado'}. ${action.decision_note||''}`,
          `Appeal ${action.appeal_status==='approved'?'approved':'rejected'}. ${action.decision_note||''}`);
    }
  }
  async function verify(){
    const ticket=++identity;action=null;section.hidden=true;form.hidden=false;
    const auth=await db.auth.getUser();if(ticket!==identity||auth.error||!auth.data?.user)return;
    const result=await db.rpc('my_staff_removal');
    if(ticket!==identity||result.error||!result.data?.length)return;
    action=result.data[0];section.hidden=false;language();
  }
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(!action||send.disabled)return;
    const text=body.value.trim();if(text.length<20||text.length>2000)return;
    send.disabled=true;
    const result=await db.rpc('staff_appeal_removal',{p_action_id:action.action_id,p_body:text});
    if(result.error){status.textContent=t('Não foi possível enviar: ','Unable to submit: ')+result.error.message;
      send.disabled=false;return;}
    await verify();
  });
  db.auth.onAuthStateChange(()=>setTimeout(verify,0));
  new MutationObserver(language).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
  verify();
})();
