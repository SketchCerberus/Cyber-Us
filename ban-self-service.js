/* Personal ban details. No user ID is sent: RPC always uses the authenticated account. */
(() => {
  'use strict';
  const member=document.getElementById('memberAccount');
  const banNotice=document.getElementById('banStatus');
  if (!member || !banNotice || !window.supabase?.createClient) return;
  const db=window.supabase.createClient('https://znenamrszhjsiztllcit.supabase.co',
    'sb_publishable_3VRFxwtDuYq4ETHs4xof8g_Fp3GRl6c',
    {auth:{flowType:'pkce',detectSessionInUrl:false,persistSession:true,autoRefreshToken:true}});
  const pt=()=>document.documentElement.lang.startsWith('pt');
  const t=(br,en)=>pt()?br:en;
  const el=(tag,cls,text)=>{
    const item=document.createElement(tag);
    if(cls)item.className=cls;
    if(text!==undefined)item.textContent=text;
    return item;
  };
  const names={
    unspecified:['A classificar','Not classified'],
    rule_violation:['Violação de regras','Rule violation'],
    inappropriate_content:['Conteúdo impróprio','Inappropriate content'],
    harassment:['Assédio ou ofensas','Harassment or abuse'],
    spam:['Spam','Spam'],other:['Outro','Other']
  };
  const formatDate=value=>new Intl.DateTimeFormat(pt()?'pt-BR':'en',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value));
  const container=el('div','ban-self-service');
  const toggle=el('button','community-action ban-details-toggle');
  toggle.type='button';toggle.hidden=true;toggle.setAttribute('aria-expanded','false');
  const panel=el('section','ban-details-panel');
  panel.hidden=true;panel.id='banDetailsPanel';toggle.setAttribute('aria-controls',panel.id);
  const heading=el('h3');const facts=el('dl','ban-detail-facts');
  const status=el('p','community-notice');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  const form=el('form','community-form ban-appeal-form');
  const label=el('label');const body=el('textarea');body.id='banAppealBody';
  body.required=true;body.minLength=20;body.maxLength=2000;body.rows=5;
  label.htmlFor=body.id;
  const submit=el('button','action');submit.type='submit';
  form.append(label,body,submit);
  panel.append(heading,facts,status,form);
  container.append(toggle,panel);
  banNotice.insertAdjacentElement('afterend',container);
  let current=null;
  let request=0;
  const field=(label,value)=>{const row=el('div','ban-detail-fact');row.append(el('dt','',label),el('dd','',value));facts.append(row);};
  function remaining(expires) {
    if(!expires)return t('Permanente','Permanent');
    const minutes=Math.max(0,Math.ceil((new Date(expires).getTime()-Date.now())/60000));
    if(!minutes)return t('Prazo encerrado. Atualize a página.','Ban expired. Refresh the page.');
    const days=Math.floor(minutes/1440),hours=Math.floor(minutes%1440/60),mins=minutes%60;
    return pt()?`${days} dia(s), ${hours} h e ${mins} min`:`${days} day(s), ${hours} h and ${mins} min`;
  }
  function render() {
    toggle.textContent=t('Informações do banimento','Ban information');
    heading.textContent=t('Informações do seu banimento','Your ban information');
    label.textContent=t('Explique por que considera o banimento indevido (20–2.000 caracteres)','Explain why you believe this ban is unjustified (20–2,000 characters)');
    submit.textContent=t('Enviar recurso','Submit appeal');
    facts.replaceChildren();
    if(!current)return;
    field(t('Categoria','Category'),(names[current.category]||names.unspecified)[pt()?0:1]);
    field(t('Motivo informado','Stated reason'),current.reason);
    field(t('Início','Issued'),formatDate(current.issued_at));
    field(t('Fim','End date'),current.expires_at?formatDate(current.expires_at):t('Permanente','Permanent'));
    field(t('Tempo restante','Time remaining'),remaining(current.expires_at));
    form.hidden=!!current.appeal_status;
    if(current.appeal_status==='pending')status.textContent=t('Recurso enviado. Aguarde a análise da moderação.','Appeal submitted. Awaiting staff review.');
    else if(current.appeal_status==='rejected')status.textContent=t('Recurso negado.','Appeal rejected.')+(current.decision_note?' '+current.decision_note:'');
    else if(current.appeal_status==='approved')status.textContent=t('Recurso aceito. Atualize a página.','Appeal accepted. Refresh the page.');
    else status.textContent=t('Você pode enviar um recurso por banimento. O envio não suspende automaticamente a punição.','You may appeal each ban once. Submitting does not automatically lift it.');
  }
  async function refresh() {
    const ticket=++request;
    const user=await db.auth.getUser();
    if(ticket!==request)return;
    if(user.error || !user.data?.user) {
      current=null;toggle.hidden=true;panel.hidden=true;toggle.setAttribute('aria-expanded','false');return;
    }
    const response=await db.rpc('my_active_ban_details');
    if(ticket!==request)return;
    if(response.error) {
      current=null;toggle.hidden=true;panel.hidden=true;
      return;
    }
    current=response.data?.[0]||null;
    toggle.hidden=!current;
    if(!current) {panel.hidden=true;toggle.setAttribute('aria-expanded','false');}
    render();
  }
  toggle.addEventListener('click',async()=>{
    if(!panel.hidden){panel.hidden=true;toggle.setAttribute('aria-expanded','false');return;}
    await refresh();
    if(!current)return;
    panel.hidden=false;toggle.setAttribute('aria-expanded','true');render();
  });
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    if(!current || current.appeal_status)return;
    const text=body.value.trim();
    if(text.length<20 || text.length>2000){status.textContent=t('Escreva entre 20 e 2.000 caracteres.','Write between 20 and 2,000 characters.');return;}
    submit.disabled=true;
    const response=await db.rpc('submit_ban_appeal',{p_ban_id:current.ban_id,p_body:text});
    submit.disabled=false;
    if(response.error){status.textContent=t('Não foi possível enviar o recurso. Atualize as informações e tente novamente.','Could not submit the appeal. Refresh the information and try again.');await refresh();return;}
    body.value='';await refresh();
  });
  new MutationObserver(()=>{render();}).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
  new MutationObserver(()=>{if(!member.hidden)refresh();else {++request;current=null;toggle.hidden=true;panel.hidden=true;}})
    .observe(member,{attributes:true,attributeFilter:['hidden']});
  new MutationObserver(()=>{if(!member.hidden)refresh();}).observe(banNotice,{attributes:true,attributeFilter:['hidden']});
  db.auth.onAuthStateChange(()=>setTimeout(refresh,0));
  refresh();
})();
