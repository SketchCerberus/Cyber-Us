/* Enhancements for the moderator workspace. Every sensitive RPC re-checks staff on the server. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const workspace = $('moderationWorkspace');
  if (!workspace || !window.supabase?.createClient) return;
  const db = window.supabase.createClient('https://znenamrszhjsiztllcit.supabase.co',
    'sb_publishable_3VRFxwtDuYq4ETHs4xof8g_Fp3GRl6c',
    {auth:{flowType:'pkce',detectSessionInUrl:false,persistSession:true,autoRefreshToken:true}});
  const pt = () => document.documentElement.lang.startsWith('pt');
  const t = (br,en) => pt() ? br : en;
  const el = (tag,cls,text) => {
    const node = document.createElement(tag);
    if (cls) node.className=cls;
    if (text!==undefined) node.textContent=text;
    return node;
  };
  const categories = [
    ['rule_violation','Violação de regras','Rule violation'],
    ['inappropriate_content','Conteúdo impróprio','Inappropriate content'],
    ['harassment','Assédio ou ofensas','Harassment or abuse'],
    ['spam','Spam','Spam'],
    ['other','Outro','Other'],
    ['fanart_violation','Violação das regras de fanarts','Fanart rules violation']
  ];
  const categoryLabel = code => categories.find(row=>row[0]===code)?.[pt()?1:2] || t('A classificar','Not classified');
  const date = value => value ? new Intl.DateTimeFormat(pt()?'pt-BR':'en',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value)) : '';
  const notice = (value,error=false) => {const node=$('moderationNotice');node.textContent=value;node.classList.toggle('error',error);};
  const uuid = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
  let authorized=false;
  let identityRequest=0;
  let categoryRequest=0;
  let appealRequest=0;
  const tabs=document.querySelector('.moderation-tabs');
  const appealsTab=el('button','community-action',t('Recursos','Appeals'));
  appealsTab.type='button';appealsTab.hidden=true;appealsTab.id='moderationAppealsTab';
  appealsTab.setAttribute('aria-pressed','false');
  tabs.append(appealsTab);
  const appealsView=el('section','moderation-appeals');
  appealsView.id='moderationAppealsView';appealsView.hidden=true;
  appealsView.append(el('h2','',t('Recursos pendentes','Pending appeals')));
  const reload=el('button','community-action',t('Atualizar recursos','Refresh appeals'));
  reload.type='button';
  const list=el('ol','comment-list');list.id='moderationAppeals';
  appealsView.append(reload,list);workspace.append(appealsView);

  async function verifyStaff() {
    const result=await db.auth.getUser();
    if (result.error || !result.data?.user) return false;
    const staff=await db.rpc('is_moderator');
    return !staff.error && staff.data===true;
  }
  async function refreshPermission() {
    const ticket=++identityRequest;
    authorized=false;appealsTab.hidden=true;appealsView.hidden=true;
    list.replaceChildren();++categoryRequest;++appealRequest;
    try {
      const permitted=await verifyStaff();
      if (ticket!==identityRequest) return;
      authorized=permitted;
      appealsTab.hidden=!authorized;
      if (authorized) decorateBans();
    } catch (error) {if (ticket===identityRequest) notice(t('Não foi possível verificar a permissão.','Could not verify permissions.'),true);}
  }

  // Capture ban clicks before the legacy handler. Never allow the old, uncategorized flow,
  // even while staff permission is loading: all authorization is rechecked by the RPC.
  $('moderationComments').addEventListener('click',async event => {
    const button=event.target.closest('button.community-action.danger');
    if (!button || !event.currentTarget.contains(button)) return;
    event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
    if (!authorized) return notice(t('Aguarde a verificação da moderação.','Wait for moderation access verification.'),true);
    const author=button.closest('li')?.querySelector('.comment-meta')?.textContent.match(uuid)?.[0];
    if (!author) return notice(t('Não foi possível identificar a conta.','Could not identify the account.'),true);
    const menu=categories.map((category,index)=>`${index+1}. ${categoryLabel(category[0])}`).join('\n');
    const answer=window.prompt(`${t('Categoria do banimento','Ban category')}:\n${menu}`);
    if (answer===null) return;
    const category=categories[Number(answer.trim())-1]?.[0];
    if (!category || !/^[1-6]$/.test(answer.trim())) return notice(t('Escolha uma categoria de 1 a 6.','Choose a category from 1 to 6.'),true);
    const reason=window.prompt(t('Descreva a infração (5–500 caracteres):','Describe the violation (5–500 characters):'));
    if (!reason || reason.trim().length<5 || reason.trim().length>500) return;
    const days=window.prompt(t('Duração em dias: 1 a 3650; 0 = permanente.','Duration in days: 1–3650; 0 = permanent.'),'7');
    if (days===null || !/^(0|[1-9][0-9]{0,3})$/.test(days) || Number(days)>3650) return;
    if (!window.confirm(t('Confirmar banimento desta conta?','Confirm ban for this account?'))) return;
    button.disabled=true;
    try {
      const expires=Number(days)?new Date(Date.now()+Number(days)*86400000).toISOString():null;
      const result=await db.rpc('ban_member_categorized',{
        p_user_id:author,p_reason:reason.trim(),p_expires_at:expires,p_category:category
      });
      if (result.error) throw result.error;
      notice(t('Banimento classificado e registrado.','Categorized ban recorded.'));
      $('moderationReload').click();
    } catch(error) {notice(error.message||t('Falha ao banir.','Ban failed.'),true);button.disabled=false;}
  },true);

  const banList=$('moderationBans');
  async function decorateBans() {
    const ticket=++categoryRequest;
    if (!authorized || !banList.querySelector('li.comment-item')) return;
    const result=await db.rpc('moderation_active_ban_categories');
    if (ticket!==categoryRequest || !authorized) return;
    if (result.error) return notice(t('Não foi possível carregar as categorias.','Could not load categories.'),true);
    const byUser=new Map((result.data||[]).map(ban=>[ban.user_id,ban]));
    for (const card of banList.querySelectorAll('li.comment-item')) {
      if (card.querySelector('.ban-category-editor')) continue;
      const user=card.querySelector('.comment-meta')?.textContent.match(uuid)?.[0];
      const ban=byUser.get(user);
      if (!ban) continue;
      const editor=el('div','ban-category-editor');
      const label=el('label','',t('Classificação','Classification'));
      const select=el('select','');
      const unspecified=el('option','',t('A classificar','Not classified'));
      unspecified.value='unspecified';unspecified.disabled=true;select.append(unspecified);
      for (const [code] of categories) {const option=el('option','',categoryLabel(code));option.value=code;select.append(option);}
      select.value=ban.category;
      const save=el('button','community-action',t('Salvar classificação','Save classification'));
      save.type='button';save.disabled=true;
      select.addEventListener('change',()=>{save.disabled=select.value===ban.category;});
      save.addEventListener('click',async()=>{
        save.disabled=true;
        const outcome=await db.rpc('moderation_classify_ban',{p_ban_id:ban.ban_id,p_category:select.value});
        if (outcome.error) {notice(outcome.error.message,true);save.disabled=false;return;}
        ban.category=select.value;
        notice(t('Classificação atualizada.','Classification updated.'));
      });
      label.append(select);editor.append(label,save);card.append(editor);
    }
  }
  new MutationObserver(()=>{if (authorized) decorateBans();}).observe(banList,{childList:true});

  async function loadAppeals() {
    const ticket=++appealRequest;
    if (!authorized) return;
    list.replaceChildren(el('li','community-hint',t('Carregando recursos…','Loading appeals…')));
    const result=await db.rpc('moderation_pending_appeals');
    if (ticket!==appealRequest || !authorized) return;
    list.replaceChildren();
    if (result.error) return list.append(el('li','community-notice error',t('Falha ao carregar recursos.','Unable to load appeals.')));
    if (!result.data?.length) return list.append(el('li','community-hint',t('Nenhum recurso pendente.','No pending appeals.')));
    for (const appeal of result.data) {
      const card=el('li','comment-item');
      card.append(el('strong','',appeal.display_name||appeal.user_id),
        el('p','comment-meta',`${categoryLabel(appeal.category)} · ${date(appeal.appeal_created_at)}`),
        el('p','comment-body',`${t('Motivo do banimento','Ban reason')}: ${appeal.ban_reason}`),
        el('p','comment-body',`${t('Justificativa do recurso','Appeal explanation')}: ${appeal.appeal_body}`));
      const actions=el('div','community-actions');
      for (const [approve,br,en] of [[true,'Aceitar e desbanir','Accept and unban'],[false,'Negar recurso','Reject appeal']]) {
        const button=el('button','community-action',t(br,en));button.type='button';
        button.addEventListener('click',async()=>{
          const note=window.prompt(t('Resposta ao recurso (5–500 caracteres; visível ao usuário se negado):','Decision note (5–500 characters; visible to user if rejected):'));
          if (!note || note.trim().length<5 || note.trim().length>500) return;
          if (!window.confirm(t(approve?'Aceitar este recurso e revogar o banimento?':'Negar este recurso?',approve?'Accept appeal and revoke this ban?':'Reject this appeal?'))) return;
          button.disabled=true;
          const outcome=await db.rpc('moderation_decide_appeal',{p_appeal_id:appeal.appeal_id,p_approve:approve,p_note:note.trim()});
          if (outcome.error) {notice(outcome.error.message,true);button.disabled=false;return;}
          notice(t('Recurso analisado.','Appeal reviewed.'));
          await loadAppeals();$('moderationBansReload').click();
        });
        actions.append(button);
      }
      card.append(actions);list.append(card);
    }
  }
  appealsTab.addEventListener('click',()=>{
    if (!authorized) return;
    $('moderationCommentsView').hidden=true;$('moderationBansView').hidden=true;
    appealsView.hidden=false;
    appealsTab.setAttribute('aria-pressed','true');
    $('moderationCommentsTab').setAttribute('aria-pressed','false');
    $('moderationBansTab').setAttribute('aria-pressed','false');
    loadAppeals();
  });
  for (const id of ['moderationCommentsTab','moderationBansTab']) {
    $(id).addEventListener('click',()=>{appealsView.hidden=true;appealsTab.setAttribute('aria-pressed','false');});
  }
  reload.addEventListener('click',loadAppeals);
  db.auth.onAuthStateChange(()=>setTimeout(refreshPermission,0));
  new MutationObserver(()=>{
    appealsTab.textContent=t('Recursos','Appeals');
    appealsView.querySelector('h2').textContent=t('Recursos pendentes','Pending appeals');
    reload.textContent=t('Atualizar recursos','Refresh appeals');
    if (authorized && !appealsView.hidden) loadAppeals();
  }).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
  refreshPermission();
})();
