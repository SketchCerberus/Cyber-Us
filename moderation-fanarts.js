/* Moderator-only fanart review queue and account sanctions. Database RLS/RPCs
   remain the authorization boundary; signed preview URLs expire after 10 minutes. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const workspace = $('moderationWorkspace');
  const tabs = document.querySelector('.moderation-tabs');
  if (!workspace || !tabs || !window.supabase?.createClient) return;
  const db = window.supabase.createClient('https://znenamrszhjsiztllcit.supabase.co',
    'sb_publishable_3VRFxwtDuYq4ETHs4xof8g_Fp3GRl6c',
    {auth:{flowType:'pkce',detectSessionInUrl:false,persistSession:true,autoRefreshToken:true}});
  const pt = () => document.documentElement.lang.startsWith('pt');
  const t = (br,en) => pt() ? br : en;
  const el = (tag,cls,text) => {
    const item = document.createElement(tag);
    if (cls) item.className = cls;
    if (text !== undefined) item.textContent = text;
    return item;
  };
  const labels = [];
  const localize = (node,br,en) => {
    labels.push([node,br,en]);
    node.textContent = t(br,en);
    return node;
  };
  const formatDate = value => new Intl.DateTimeFormat(pt()?'pt-BR':'en',{
    dateStyle:'medium',timeStyle:'short'
  }).format(new Date(value));
  const message = error => error?.message || t('Tente novamente.','Please try again.');
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const username = /^[a-z0-9_]{3,24}$/;
  let authorized = false;
  let permissionTicket = 0;
  let lookupTicket = 0;
  let queueTicket = 0;
  let listTicket = 0;
  let target = null;

  const tab = localize(el('button','community-action'),'Fanarts','Fanarts');
  tab.id = 'moderationFanartsTab';
  tab.type = 'button';
  tab.hidden = true;
  tab.setAttribute('aria-pressed','false');
  tabs.insertBefore(tab,$('moderationAppealsTab') || null);

  const view = el('section','moderation-fanarts');
  view.id = 'moderationFanartsView';
  view.hidden = true;
  const heading = localize(el('h2'),'Moderação de fanarts','Fanart moderation');
  heading.id = 'moderationFanartsHeading';
  view.setAttribute('aria-labelledby',heading.id);
  const explanation = localize(el('p','community-hint'),
    'Revise a imagem privada antes de decidir. Aprovar registra a decisão, mas ainda não publica a obra na galeria. Rejeitar registra o motivo e tenta excluir o arquivo privado.',
    'Review the private image before deciding. Approval records the decision but does not publish the artwork to the gallery. Rejection records the reason and attempts to delete the private file.');

  const queueHeading = el('div','moderation-selection-heading');
  const queueTitle = localize(el('h3'),'Fila de análise','Review queue');
  const queueRefresh = localize(el('button','community-action'),'Atualizar fila','Refresh queue');
  queueRefresh.type = 'button';
  queueHeading.append(queueTitle,queueRefresh);
  const queueStatus = el('p','community-notice');
  queueStatus.id = 'moderationFanartQueueStatus';
  queueStatus.setAttribute('role','status');
  queueStatus.setAttribute('aria-live','polite');
  const queue = el('div','moderation-fanart-queue');
  queue.id = 'moderationFanartQueue';

  const accountHeading = localize(el('h3'),'Ação sobre uma conta','Account action');
  const accountHint = localize(el('p','community-hint'),
    'Use esta área somente quando a infração também justificar banimento da comunidade inteira.',
    'Use this area only when the violation also warrants a community-wide ban.');
  const lookupForm = el('form','community-form moderation-fanart-lookup');
  const searchLabel = localize(el('label'),'Nome de usuário ou ID da conta','Username or account ID');
  const search = el('input');
  search.id = 'moderationFanartAccount';
  search.type = 'text';
  search.maxLength = 50;
  search.autocomplete = 'off';
  search.required = true;
  searchLabel.htmlFor = search.id;
  const find = localize(el('button','community-action'),'Localizar conta','Find account');
  find.type = 'submit';
  lookupForm.append(searchLabel,search,find);
  const status = el('p','community-notice');
  status.id = 'moderationFanartsStatus';
  status.setAttribute('role','status');
  status.setAttribute('aria-live','polite');
  const setStatus = (value,error=false) => {
    status.textContent = value;
    status.classList.toggle('error',error);
  };

  const banForm = el('form','community-form moderation-fanart-ban');
  banForm.hidden = true;
  const confirmed = el('p','community-hint');
  const category = localize(el('p','moderation-fanart-category'),
    'Categoria: violação das regras de fanarts','Category: fanart rules violation');
  const reasonLabel = localize(el('label'),'Motivo específico (5–500 caracteres)','Specific reason (5–500 characters)');
  const reason = el('textarea');
  reason.id = 'moderationFanartReason';
  reason.required = true;
  reason.minLength = 5;
  reason.maxLength = 500;
  reason.rows = 4;
  reasonLabel.htmlFor = reason.id;
  const durationLabel = localize(el('label'),
    'Duração em dias (0 = permanente; 1 a 3650 = temporário)',
    'Duration in days (0 = permanent; 1 to 3650 = temporary)');
  const duration = el('input');
  duration.id = 'moderationFanartDuration';
  duration.type = 'number';
  duration.min = '0';
  duration.max = '3650';
  duration.step = '1';
  duration.value = '7';
  duration.required = true;
  durationLabel.htmlFor = duration.id;
  const ban = localize(el('button','community-action danger'),
    'Banir conta por infração nas fanarts','Ban account for fanart violation');
  ban.type = 'submit';
  const warning = localize(el('p','community-hint'),
    'Atenção: este banimento vale para toda a comunidade. O titular poderá apresentar recurso na própria conta.',
    'Warning: this ban applies to the entire community. The account holder can appeal from their account.');
  banForm.append(confirmed,category,reasonLabel,reason,durationLabel,duration,warning,ban);

  const listHeading = localize(el('h3'),'Banimentos ativos classificados como fanarts','Active bans classified as fanart violations');
  const refresh = localize(el('button','community-action'),'Atualizar lista','Refresh list');
  refresh.type = 'button';
  const list = el('ol','comment-list');
  list.id = 'moderationFanartBans';
  view.append(heading,explanation,queueHeading,queueStatus,queue,
    accountHeading,accountHint,lookupForm,status,banForm,listHeading,refresh,list);
  workspace.append(view);

  const queueNotice = (value,error=false) => {
    queueStatus.textContent = value;
    queueStatus.classList.toggle('error',error);
  };

  async function decide(work,decision,reasonText=null) {
    const label = decision === 'approved'
      ? t('aprovar esta fanart','approve this fanart')
      : t('rejeitar esta fanart','reject this fanart');
    if (!window.confirm(t(`Confirmar: ${label}?`,`Confirm: ${label}?`))) return;
    queueNotice(t('Registrando decisão…','Recording decision…'));
    const result = await db.rpc('moderate_fanart_submission',{
      p_submission_id:work.id,p_decision:decision,p_reason:reasonText
    });
    if (result.error) throw result.error;
    if (decision === 'rejected') {
      const removal = await db.storage.from('fanart-pending').remove([work.image_path]);
      if (removal.error) {
        queueNotice(t(
          'A rejeição foi registrada, mas o arquivo privado não foi excluído. Remova-o manualmente no armazenamento.',
          'The rejection was recorded, but the private file was not deleted. Remove it manually from storage.'),true);
        await loadQueue();
        return;
      }
    }
    queueNotice(decision === 'approved'
      ? t('Fanart aprovada. A publicação na galeria continua manual.','Fanart approved. Gallery publication remains manual.')
      : t('Fanart rejeitada e arquivo privado excluído.','Fanart rejected and private file deleted.'));
    await loadQueue();
  }

  function renderSubmission(work,preview) {
    const card = el('article','moderation-fanart-card');
    const media = el('div','moderation-fanart-media');
    if (preview) {
      const image = el('img');
      image.src = preview;
      image.alt = `${work.title} — ${work.artist_name}`;
      image.loading = 'lazy';
      image.referrerPolicy = 'no-referrer';
      media.append(image);
    } else {
      media.append(el('p','community-notice error',t('Prévia indisponível. Não aprove sem conferir o arquivo.','Preview unavailable. Do not approve without checking the file.')));
    }
    const details = el('div','moderation-fanart-details');
    details.append(el('h4','',work.title),
      el('p','moderation-fanart-artist',`${t('Artista','Artist')}: ${work.artist_name}`),
      el('p','comment-meta',`${formatDate(work.created_at)} · ${work.user_id}`));
    if (work.region) details.append(el('p','comment-meta',`${t('Região','Region')}: ${work.region} · ${work.show_region?t('exibição autorizada','display authorized'):t('não exibir','do not display')}`));
    if (work.artist_link) {
      const link = el('a','moderation-fanart-link',work.artist_link);
      link.href = work.artist_link;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      details.append(link);
    }
    if (work.status === 'withdrawal_requested') {
      details.append(el('p','community-notice',t('Retirada solicitada pelo artista. Confira e remova qualquer cópia já publicada.','Withdrawal requested by the artist. Check and remove any published copy.')));
    }
    const actions = el('div','community-actions moderation-fanart-actions');
    if (work.status === 'pending') {
      const approve = localize(el('button','community-action'),'Aprovar','Approve');
      approve.id = `fanartApprove-${work.id}`;
      approve.type = 'button';
      approve.disabled = !preview;
      approve.addEventListener('click',async()=>{
        approve.disabled = true;
        try { await decide(work,'approved'); }
        catch (error) { queueNotice(message(error),true); approve.disabled = !preview; }
      });
      actions.append(approve);
    }
    const reject = localize(el('button','community-action danger'),
      work.status === 'withdrawal_requested'?'Concluir retirada':'Rejeitar',
      work.status === 'withdrawal_requested'?'Complete withdrawal':'Reject');
    reject.id = `fanartReject-${work.id}`;
    reject.type = 'button';
    reject.addEventListener('click',async()=>{
      let reasonText = t('Retirada solicitada pelo artista','Withdrawal requested by artist');
      if (work.status !== 'withdrawal_requested') {
        reasonText = window.prompt(t('Motivo da rejeição (3–500 caracteres):','Rejection reason (3–500 characters):'));
        if (!reasonText || reasonText.trim().length < 3 || reasonText.trim().length > 500) return;
        reasonText = reasonText.trim();
      }
      reject.disabled = true;
      try { await decide(work,'rejected',reasonText); }
      catch (error) { queueNotice(message(error),true); reject.disabled = false; }
    });
    actions.append(reject);
    details.append(actions);
    card.append(media,details);
    queue.append(card);
  }

  async function loadQueue() {
    const ticket = ++queueTicket;
    if (!authorized) return;
    queueRefresh.disabled = true;
    queue.replaceChildren();
    queueNotice(t('Carregando envios…','Loading submissions…'));
    try {
      const result = await db.from('fanart_submissions')
        .select('id,user_id,artist_name,title,region,show_region,artist_link,accent,extension,image_path,status,created_at')
        .in('status',['withdrawal_requested','pending'])
        .order('status',{ascending:false})
        .order('created_at',{ascending:true})
        .limit(50);
      if (result.error) throw result.error;
      if (ticket !== queueTicket || !authorized) return;
      const works = result.data || [];
      if (!works.length) {
        queueNotice(t('Nenhuma fanart aguardando ação.','No fanart is awaiting action.'));
        return;
      }
      queueNotice(t(`${works.length} envio(s) aguardando ação.`,`${works.length} submission(s) awaiting action.`));
      for (const work of works) {
        const signed = await db.storage.from('fanart-pending').createSignedUrl(work.image_path,600);
        if (ticket !== queueTicket || !authorized) return;
        renderSubmission(work,signed.error ? null : signed.data?.signedUrl);
      }
    } catch (error) {
      if (ticket === queueTicket) queueNotice(message(error),true);
    } finally {
      if (ticket === queueTicket) queueRefresh.disabled = false;
    }
  }

  function clearSelection() {
    target = null;
    ++lookupTicket;
    banForm.hidden = true;
    confirmed.textContent = '';
  }
  search.addEventListener('input',clearSelection);

  async function checkPermission() {
    const ticket = ++permissionTicket;
    authorized = false;
    tab.hidden = true;
    view.hidden = true;
    clearSelection();
    ++queueTicket;
    ++listTicket;
    queue.replaceChildren();
    list.replaceChildren();
    const user = await db.auth.getUser();
    if (ticket !== permissionTicket || user.error || !user.data?.user) return;
    const staff = await db.rpc('is_moderator');
    if (ticket !== permissionTicket || staff.error || staff.data !== true) return;
    authorized = true;
    tab.hidden = false;
  }

  lookupForm.addEventListener('submit',async event => {
    event.preventDefault();
    if (!authorized) return;
    clearSelection();
    const ticket = ++lookupTicket;
    const term = search.value.trim().replace(/^@/,'');
    if (!username.test(term) && !uuid.test(term)) {
      setStatus(t('Informe um usuário válido ou o ID completo da conta.','Enter a valid username or full account ID.'),true);
      return;
    }
    find.disabled = true;
    setStatus(t('Localizando conta…','Finding account…'));
    try {
      const query = db.from('profiles').select('id,username,display_name');
      const response = await (uuid.test(term) ? query.eq('id',term) : query.eq('username',term)).maybeSingle();
      if (ticket !== lookupTicket || !authorized) return;
      if (response.error) throw response.error;
      if (!response.data) {
        setStatus(t('Conta não encontrada. Confira o usuário ou ID.','Account not found. Check the username or ID.'),true);
        return;
      }
      target = response.data;
      const name = target.display_name || target.username || target.id;
      confirmed.textContent = `${t('Conta confirmada','Confirmed account')}: ${name} · ${target.username ? '@'+target.username+' · ' : ''}${target.id}`;
      banForm.hidden = false;
      setStatus(t('Confira a conta e preencha a infração antes de confirmar.','Check the account and enter the violation before confirming.'));
    } catch (error) {
      if (ticket === lookupTicket) setStatus(message(error),true);
    } finally {
      find.disabled = false;
    }
  });

  banForm.addEventListener('submit',async event => {
    event.preventDefault();
    if (!authorized || !target) return;
    const text = reason.value.trim();
    const days = duration.value.trim();
    if (text.length < 5 || text.length > 500 || !/^(0|[1-9][0-9]{0,3})$/.test(days) || Number(days) > 3650) {
      setStatus(t('Confira o motivo e a duração.','Check the reason and duration.'),true);
      return;
    }
    const name = target.display_name || target.username || target.id;
    if (!window.confirm(t(`Confirmar banimento de ${name} (${target.id}) em toda a comunidade?`,`Ban ${name} (${target.id}) from the entire community?`))) return;
    ban.disabled = true;
    try {
      const expires = Number(days) ? new Date(Date.now()+Number(days)*86400000).toISOString() : null;
      const result = await db.rpc('ban_member_categorized',{
        p_user_id:target.id,p_reason:text,p_expires_at:expires,p_category:'fanart_violation'
      });
      if (result.error) throw result.error;
      clearSelection();
      search.value = '';
      reason.value = '';
      setStatus(t('Banimento registrado na categoria Fanarts.','Ban recorded under the Fanarts category.'));
      await loadBans();
    } catch (error) { setStatus(message(error),true); }
    finally { ban.disabled = false; }
  });

  async function loadBans() {
    const ticket = ++listTicket;
    if (!authorized) return;
    list.replaceChildren(el('li','community-hint',t('Carregando…','Loading…')));
    const [bans,categories] = await Promise.all([
      db.rpc('moderation_active_bans_with_history'),db.rpc('moderation_active_ban_categories')
    ]);
    if (ticket !== listTicket || !authorized) return;
    list.replaceChildren();
    if (bans.error || categories.error) {
      list.append(el('li','community-notice error',t('Não foi possível carregar a lista.','Could not load the list.')));
      return;
    }
    const fanartUsers = new Set((categories.data || []).filter(row => row.category === 'fanart_violation').map(row => row.user_id));
    const rows = (bans.data || []).filter(row => fanartUsers.has(row.user_id));
    if (!rows.length) {
      list.append(el('li','community-hint',t('Nenhum banimento ativo nesta categoria.','No active bans in this category.')));
      return;
    }
    for (const row of rows) {
      const card = el('li','comment-item');
      card.append(el('strong','',row.display_name || row.user_id),
        el('p','comment-meta',row.user_id),el('p','comment-body',row.reason),
        el('p','comment-meta',row.expires_at
          ? `${t('Até','Until')}: ${formatDate(row.expires_at)}` : t('Permanente','Permanent')));
      list.append(card);
    }
  }

  tab.addEventListener('click',() => {
    if (!authorized || workspace.hidden) return;
    for (const id of ['moderationCommentsView','moderationBansView','moderationAppealsView']) $(id) && ($(id).hidden = true);
    for (const id of ['moderationCommentsTab','moderationBansTab','moderationAppealsTab']) $(id)?.setAttribute('aria-pressed','false');
    view.hidden = false;
    tab.setAttribute('aria-pressed','true');
    loadQueue();
    loadBans();
  });
  for (const id of ['moderationCommentsTab','moderationBansTab','moderationAppealsTab']) {
    $(id)?.addEventListener('click',() => {
      view.hidden = true;
      tab.setAttribute('aria-pressed','false');
      ++queueTicket;
      ++listTicket;
    });
  }
  queueRefresh.addEventListener('click',loadQueue);
  refresh.addEventListener('click',loadBans);
  new MutationObserver(() => {
    for (const [node,br,en] of labels) node.textContent = t(br,en);
    if (authorized && !view.hidden) { loadQueue(); loadBans(); }
  }).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
  db.auth.onAuthStateChange(() => setTimeout(checkPermission,0));
  checkPermission();
})();
