/* Shared notification bell: only an authenticated reader may see their own inbox.
   The database continues to enforce notification ownership and opt-in preferences. */
(() => {
  'use strict';
  const account = document.querySelector('body > .site-header nav .account-access');
  if (!account || document.getElementById('headerNotifications')) return;
  const base = document.currentScript?.src || document.baseURI;
  const pt = () => document.documentElement.lang.startsWith('pt');
  const t = (br, en) => pt() ? br : en;
  const make = (tag, className) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    return element;
  };
  const shell = make('div', 'header-notifications');
  shell.id = 'headerNotifications';
  shell.hidden = true; // Never expose the inbox or its badge before verifying the session.
  const bell = make('button', 'header-notifications-bell');
  bell.type = 'button';
  bell.setAttribute('aria-expanded', 'false');
  bell.setAttribute('aria-controls', 'headerNotificationsPanel');
  const icon = make('span', 'header-notifications-icon');
  icon.textContent = '🔔';
  icon.setAttribute('aria-hidden', 'true');
  const badge = make('span', 'header-notifications-badge');
  badge.hidden = true;
  badge.setAttribute('aria-hidden', 'true');
  bell.append(icon, badge);
  const panel = make('section', 'header-notifications-panel');
  panel.id = 'headerNotificationsPanel';
  panel.hidden = true;
  panel.setAttribute('role', 'region');
  const headingRow = make('div', 'header-notifications-heading');
  const heading = make('h2');
  const actions = make('div', 'header-notifications-actions');
  const refresh = make('button', 'header-notifications-refresh');
  refresh.type = 'button';
  const close = make('button', 'header-notifications-close');
  close.type = 'button';
  close.textContent = '×';
  actions.append(refresh, close);
  headingRow.append(heading, actions);
  const status = make('p', 'header-notifications-status');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  const list = make('ol', 'header-notifications-list');
  panel.append(headingRow, status, list);
  shell.append(bell, panel);
  account.after(shell); // Immediately to the right of the account, before language selection.
  const css = document.createElement('link');
  css.rel = 'stylesheet';
  css.href = new URL('header-notifications.css', base).href;
  document.head.append(css);

  const uuid = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
  let user = null;
  let identity = 0;
  let inboxRequest = 0;
  let countRequest = 0;
  let unreadCount = 0;
  let entries = [];
  let db = null;
  const message = (br, en) => { status.textContent = t(br, en); };
  function syncLanguage() {
    heading.textContent = t('Notificações', 'Notifications');
    panel.setAttribute('aria-label', heading.textContent);
    refresh.textContent = t('Atualizar', 'Refresh');
    close.setAttribute('aria-label', t('Fechar notificações', 'Close notifications'));
    const label = unreadCount
      ? t(`Notificações: ${unreadCount} não lida(s)`, `Notifications: ${unreadCount} unread`)
      : t('Notificações', 'Notifications');
    bell.setAttribute('aria-label', label);
    bell.title = label;
    renderInbox();
  }
  function target(item) {
    if (/^(episodio-0[1-5]|marco-zero)$/.test(item.episode_slug || ''))
      return new URL(`episodios/${item.episode_slug}.html#communityHeading`, base).href;
    if (uuid.test(item.fanart_submission_id || ''))
      return new URL(`fanarts-galeria.html?art=${encodeURIComponent(item.fanart_submission_id)}#artwork`, base).href;
    return null;
  }
  function renderInbox() {
    list.replaceChildren();
    if (!user || !entries.length) {
      if (user && !panel.hidden) message('Nenhuma notificação ainda.', 'No notifications yet.');
      return;
    }
    const unread = entries.filter(item => !item.read_at).length;
    message(`${unread} não lida(s) entre as últimas ${entries.length}.`,
      `${unread} unread among the latest ${entries.length}.`);
    for (const item of entries) {
      const li = make('li', 'header-notification-item');
      if (!item.read_at) li.classList.add('is-unread');
      const href = target(item);
      const link = make(href ? 'a' : 'span', 'header-notification-link');
      link.textContent = item.kind === 'reply'
        ? t('Alguém respondeu ao seu comentário.', 'Someone replied to your comment.')
        : t('Seu @usuário foi mencionado em um comentário.', 'Your @username was mentioned in a comment.');
      if (href) {
        link.href = href;
        link.addEventListener('click', async event => {
          if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey ||
              event.shiftKey || event.altKey || !user) return;
          event.preventDefault();
          const current = user.id;
          const destination = link.href;
          link.setAttribute('aria-disabled', 'true');
          try {
            const result = await db.from('community_notifications')
              .update({read_at: new Date().toISOString()}).eq('id', item.id);
            if (!result.error && user?.id === current) {
              item.read_at = new Date().toISOString();
              renderInbox();
              await refreshUnread();
            }
          } finally {
            window.location.assign(destination);
          }
        });
      }
      const time = make('time', 'header-notification-date');
      time.dateTime = item.created_at;
      const parsed = new Date(item.created_at);
      time.textContent = Number.isNaN(parsed.getTime()) ? '' :
        new Intl.DateTimeFormat(pt() ? 'pt-BR' : 'en',
          {dateStyle: 'medium', timeStyle: 'short'}).format(parsed);
      li.append(link, time);
      list.append(li);
    }
  }
  function closePanel(restoreFocus = false) {
    if (panel.hidden) return;
    panel.hidden = true;
    bell.setAttribute('aria-expanded', 'false');
    ++inboxRequest;
    if (restoreFocus) bell.focus();
  }
  async function refreshUnread() {
    if (!db || !user) return;
    const ticket = ++countRequest;
    const owner = user.id;
    const result = await db.from('community_notifications')
      .select('id', {count: 'exact', head: true}).is('read_at', null);
    if (ticket !== countRequest || user?.id !== owner) return;
    if (result.error) { badge.hidden = true; unreadCount = 0; syncLanguage(); return; }
    unreadCount = Math.max(0, Number(result.count) || 0);
    badge.hidden = !unreadCount;
    badge.textContent = unreadCount > 99 ? '99+' : String(unreadCount);
    syncLanguage();
  }
  async function loadInbox() {
    if (!db || !user || panel.hidden) return;
    const ticket = ++inboxRequest;
    const owner = user.id;
    refresh.disabled = true;
    entries = [];
    list.replaceChildren();
    message('Carregando notificações…', 'Loading notifications…');
    const result = await db.from('community_notifications')
      .select('id,kind,episode_slug,fanart_submission_id,created_at,read_at')
      .order('created_at', {ascending: false}).limit(30);
    if (ticket !== inboxRequest || user?.id !== owner || panel.hidden) return;
    refresh.disabled = false;
    if (result.error) {
      message('Não foi possível carregar as notificações.', 'Could not load notifications.');
      return;
    }
    entries = result.data || [];
    renderInbox();
    await refreshUnread();
  }
  bell.addEventListener('click', () => {
    if (!user) return;
    if (!panel.hidden) { closePanel(); return; }
    panel.hidden = false;
    bell.setAttribute('aria-expanded', 'true');
    loadInbox();
  });
  refresh.addEventListener('click', loadInbox);
  close.addEventListener('click', () => closePanel(true));
  document.addEventListener('pointerdown', event => {
    if (!panel.hidden && !shell.contains(event.target)) closePanel();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !panel.hidden) closePanel(true);
  });
  new MutationObserver(syncLanguage).observe(document.documentElement,
    {attributes: true, attributeFilter: ['lang']});

  function start(sdk) {
    db = sdk.createClient('https://znenamrszhjsiztllcit.supabase.co',
      'sb_publishable_3VRFxwtDuYq4ETHs4xof8g_Fp3GRl6c',
      {auth: {flowType: 'pkce', detectSessionInUrl: false, persistSession: true,
        autoRefreshToken: false}});
    async function verify() {
      const ticket = ++identity;
      ++countRequest;
      user = null;
      unreadCount = 0;
      entries = [];
      badge.hidden = true;
      closePanel();
      shell.hidden = true;
      const result = await db.auth.getUser();
      if (ticket !== identity || result.error || !result.data?.user) return;
      user = result.data.user;
      shell.hidden = false;
      syncLanguage();
      await refreshUnread();
    }
    db.auth.onAuthStateChange(() => setTimeout(verify, 0));
    window.addEventListener('pageshow', () => { if (user) refreshUnread(); else verify(); });
    window.addEventListener('focus', () => { if (user) refreshUnread(); else verify(); });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && user) refreshUnread();
    });
    verify();
  }
  if (window.supabase?.createClient) start(window.supabase);
  else {
    // header-account.js creates the shared SDK tag on pages without a pinned SDK.
    const sdk = document.querySelector('script[src*="@supabase/supabase-js@"]');
    sdk?.addEventListener('load', () => {
      if (window.supabase?.createClient) start(window.supabase);
    }, {once: true});
  }
  syncLanguage();
})();
