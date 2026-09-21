/* Fanarts moderation: gallery submissions are not open yet. Moderator-only account
   lookup/ban now; never pretend static fanarts have account-owned submissions. */
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
  const setStatus = (value,error=false) => {
    status.textContent = value;
    status.classList.toggle('error',error);
  };
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const username = /^[a-z0-9_]{3,24}$/;
  let authorized = false;
  let permissionTicket = 0;
  let lookupTicket = 0;
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
    'Os envios de fanarts ainda não estão abertos. Não há obras nem autores de obras para listar. Por enquanto, você pode banir uma conta identificada pelo usuário ou ID; futuramente, cada obra será vinculada ao seu autor.',
    'Fanart submissions are not open yet. There are no artworks or artwork authors to list. For now, you can ban a verified account using its username or ID; future submissions will link each artwork to its author.');
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
    'Atenção: este é um banimento da comunidade inteira. Se já existir um banimento ativo, ele será substituído e continuará no histórico. O titular poderá apresentar recurso na própria conta.',
    'Warning: this bans the account from the entire community. Any existing active ban will be replaced and remain in the history. The account holder can appeal from their account.');
  banForm.append(confirmed,category,reasonLabel,reason,durationLabel,duration,warning,ban);

  const listHeading = localize(el('h3'),'Banimentos ativos classificados como fanarts','Active bans classified as fanart violations');
  const refresh = localize(el('button','community-action'),'Atualizar lista','Refresh list');
  refresh.type = 'button';
  const list = el('ol','comment-list');
  list.id = 'moderationFanartBans';
  view.append(heading,explanation,lookupForm,status,banForm,listHeading,refresh,list);
  workspace.append(view);

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
    ++listTicket;
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
      if (ticket === lookupTicket) setStatus(error?.message || t('Falha na consulta.','Lookup failed.'),true);
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
    if (!window.confirm(t(
      `Confirmar banimento de ${name} (${target.id}) em toda a comunidade? Isso substitui qualquer banimento ativo.`,
      `Ban ${name} (${target.id}) from the entire community? This replaces any active ban.`))) return;
    const userId = target.id;
    const ticket = lookupTicket;
    ban.disabled = true;
    try {
      const expires = Number(days) ? new Date(Date.now()+Number(days)*86400000).toISOString() : null;
      const result = await db.rpc('ban_member_categorized',{
        p_user_id:userId,p_reason:text,p_expires_at:expires,p_category:'fanart_violation'
      });
      if (result.error) throw result.error;
      if (ticket !== lookupTicket || !authorized) return;
      clearSelection();
      search.value = '';
      reason.value = '';
      setStatus(t('Banimento registrado na categoria Fanarts.','Ban recorded under the Fanarts category.'));
      await loadBans();
    } catch (error) {
      if (ticket === lookupTicket) setStatus(error?.message || t('Falha ao banir.','Ban failed.'),true);
    } finally {
      ban.disabled = false;
    }
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
        el('p','comment-meta',row.user_id),
        el('p','comment-body',row.reason),
        el('p','comment-meta',row.expires_at
          ? `${t('Até','Until')}: ${new Intl.DateTimeFormat(pt()?'pt-BR':'en',{dateStyle:'medium',timeStyle:'short'}).format(new Date(row.expires_at))}`
          : t('Permanente','Permanent')));
      list.append(card);
    }
  }

  tab.addEventListener('click',() => {
    if (!authorized || workspace.hidden) return;
    for (const id of ['moderationCommentsView','moderationBansView','moderationAppealsView']) {
      const other = $(id);
      if (other) other.hidden = true;
    }
    for (const id of ['moderationCommentsTab','moderationBansTab','moderationAppealsTab']) {
      $(id)?.setAttribute('aria-pressed','false');
    }
    view.hidden = false;
    tab.setAttribute('aria-pressed','true');
    loadBans();
  });
  for (const id of ['moderationCommentsTab','moderationBansTab','moderationAppealsTab']) {
    $(id)?.addEventListener('click',() => {
      view.hidden = true;
      tab.setAttribute('aria-pressed','false');
      ++listTicket;
    });
  }
  refresh.addEventListener('click',loadBans);
  new MutationObserver(() => {
    for (const [node,br,en] of labels) node.textContent = t(br,en);
    if (target) {
      const name = target.display_name || target.username || target.id;
      confirmed.textContent = `${t('Conta confirmada','Confirmed account')}: ${name} · ${target.username ? '@'+target.username+' · ' : ''}${target.id}`;
    }
    if (authorized && !view.hidden) loadBans();
  }).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
  db.auth.onAuthStateChange(() => setTimeout(checkPermission,0));
  checkPermission();
})();
