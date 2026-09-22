/* Notification preferences stay on the account page; the inbox lives in the shared header bell. */
(() => {
  'use strict';
  const member = document.getElementById('memberAccount');
  if (!member || !window.supabase?.createClient) return;
  const db = window.supabase.createClient('https://znenamrszhjsiztllcit.supabase.co',
    'sb_publishable_3VRFxwtDuYq4ETHs4xof8g_Fp3GRl6c',
    {auth: {flowType: 'pkce', detectSessionInUrl: false, persistSession: true,
      autoRefreshToken: true}});
  const pt = () => document.documentElement.lang.startsWith('pt');
  const t = (br, en) => pt() ? br : en;
  const node = (tag, cls) => {
    const element = document.createElement(tag);
    if (cls) element.className = cls;
    return element;
  };
  const loc = (element, br, en) => {
    element.dataset.pt = br;
    element.dataset.en = en;
    element.textContent = t(br, en);
    return element;
  };
  const section = node('section', 'community-notification-section community-box');
  section.id = 'myNotificationPreferences';
  section.hidden = true;
  const title = loc(node('h2'), 'Preferências de notificações', 'Notification preferences');
  const intro = loc(node('p', 'community-hint'),
    'Escolha quais avisos receber no sino ao lado da conta. Desativados por padrão; não enviamos e-mails.',
    'Choose which alerts appear in the bell beside your account. Off by default; no emails are sent.');
  const settings = node('form', 'community-form');
  const replyLabel = node('label', 'community-notification-choice');
  const reply = node('input');
  reply.type = 'checkbox';
  replyLabel.append(reply, loc(node('span'), 'Avisar quando responderem aos meus comentários',
    'Notify me when someone replies to my comments'));
  const mentionLabel = node('label', 'community-notification-choice');
  const mention = node('input');
  mention.type = 'checkbox';
  mentionLabel.append(mention, loc(node('span'), 'Avisar quando mencionarem meu @usuário',
    'Notify me when someone mentions my @username'));
  const save = loc(node('button', 'action'), 'Salvar preferências', 'Save preferences');
  save.type = 'submit';
  save.disabled = true;
  const status = node('p', 'community-notice');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  settings.append(replyLabel, mentionLabel, save, status);
  section.append(title, intro, settings);
  member.append(section);
  let user = null;
  let identity = 0;
  function say(br, en, error = false) {
    status.dataset.pt = br;
    status.dataset.en = en;
    status.textContent = t(br, en);
    status.classList.toggle('error', error);
  }
  async function verify() {
    const ticket = ++identity;
    user = null;
    section.hidden = true;
    save.disabled = true;
    const auth = await db.auth.getUser();
    if (ticket !== identity || auth.error || !auth.data?.user) return;
    user = auth.data.user;
    section.hidden = false;
    const prefs = await db.from('community_notification_preferences')
      .select('user_id,replies,mentions').maybeSingle();
    if (ticket !== identity || !user) return;
    if (prefs.error) say('Falha ao carregar as preferências.', 'Could not load preferences.', true);
    else {
      reply.checked = prefs.data?.replies === true;
      mention.checked = prefs.data?.mentions === true;
      save.disabled = false;
      say('Escolha e salve suas preferências.', 'Choose and save your preferences.');
    }
  }
  settings.addEventListener('submit', async event => {
    event.preventDefault();
    if (!user || save.disabled) return;
    save.disabled = true;
    const owner = user.id;
    const data = {replies: reply.checked, mentions: mention.checked};
    const lookup = await db.from('community_notification_preferences')
      .select('user_id').maybeSingle();
    let outcome = {error: lookup.error};
    if (!lookup.error) {
      outcome = lookup.data
        ? await db.from('community_notification_preferences').update(data).eq('user_id', owner)
        : await db.from('community_notification_preferences').insert({...data, user_id: owner});
    }
    if (user?.id !== owner) return;
    say(outcome.error ? 'Não foi possível salvar. Tente novamente.' : 'Preferências salvas.',
      outcome.error ? 'Could not save. Try again.' : 'Preferences saved.', !!outcome.error);
    save.disabled = false;
  });
  db.auth.onAuthStateChange(() => setTimeout(verify, 0));
  new MutationObserver(() => {
    section.querySelectorAll('[data-pt][data-en]').forEach(element => {
      element.textContent = t(element.dataset.pt, element.dataset.en);
    });
  }).observe(document.documentElement, {attributes: true, attributeFilter: ['lang']});
  verify();
})();
