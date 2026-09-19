/* Cyber-Us community. Only the PUBLIC Supabase URL and publishable key belong here.
   Authorization, bans, rate limits and vote uniqueness are enforced in Postgres/RLS. */
(() => {
  'use strict';
  const PROJECT_URL = 'https://znenamrszhjsiztllcit.supabase.co';
  const PUBLISHABLE_KEY = 'sb_publishable_3VRFxwtDuYq4ETHs4xof8g_Fp3GRl6c';
  // Resolve against this script so previews keep their own origin and base path.
  const ACCOUNT_URL = new URL('comunidade.html', document.currentScript.src).href;
  const account = document.body.dataset.communityPage === 'account';
  const episodeRoot = document.querySelector('[data-community-episode]');
  if (!account && !episodeRoot) return;
  const byId = id => document.getElementById(id);
  const pt = () => document.documentElement.lang.startsWith('pt');
  const t = (a, b) => pt() ? a : b;
  const node = (tag, className, text) => {
    const item = document.createElement(tag);
    if (className) item.className = className;
    if (text !== undefined) item.textContent = text;
    return item;
  };
  const notice = (id, text, error = false) => {
    const item = byId(id);
    if (!item) return;
    item.textContent = text;
    item.classList.toggle('error', error);
  };
  const state = { user: null, banned: false, moderator: false, vote: null, offset: 0 };
  if (!window.supabase || !window.supabase.createClient) {
    notice(account ? 'accountStatus' : 'communityStatus', t('Não foi possível carregar o serviço de comunidade. Tente novamente mais tarde.', 'Community service failed to load. Try again later.'), true);
    return;
  }
  const db = window.supabase.createClient(PROJECT_URL, PUBLISHABLE_KEY, {
    auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true, autoRefreshToken: true }
  });
  const avatars = window.CyberUsAvatars?.create({db,projectUrl:PROJECT_URL,state,t});
  let refreshIndex = 0;
  const busy = (form, value) => form?.querySelectorAll('button').forEach(button => { button.disabled = value; });
  const errorText = error => error?.message || t('Tente novamente.', 'Please try again.');
  const dateText = value => value ? new Intl.DateTimeFormat(pt() ? 'pt-BR' : 'en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '';
  const captchaTokenFor = formId => {
    const gate = window.CyberUsCaptcha;
    const token = gate?.configured ? gate.token(formId) : null;
    if (!token) notice('accountStatus', t('Conclua a verificação antibots antes de continuar. Se ela não aparecer, avise o administrador.', 'Complete bot verification before continuing. If it does not appear, contact the administrator.'), true);
    return token;
  };
  const resetCaptcha = formId => window.CyberUsCaptcha?.reset(formId);

  async function refreshIdentity() {
    const index = ++refreshIndex;
    const { data, error } = await db.auth.getUser();
    if (index !== refreshIndex) return;
    state.user = !error && data?.user ? data.user : null;
    state.banned = false;
    state.moderator = false;
    if (state.user) {
      const [ban, staff] = await Promise.all([db.rpc('is_banned'), db.rpc('is_moderator')]);
      if (index !== refreshIndex) return;
      if (ban.error || staff.error) {
        notice(account ? 'accountStatus' : 'communityStatus', t('Falha ao verificar as permissões. Atualize a página.', 'Could not verify permissions. Refresh the page.'), true);
        return;
      }
      state.banned = ban.data === true;
      state.moderator = staff.data === true;
    }
    if (account) await renderAccount();
    if (episodeRoot) await renderEpisode();
  }

  async function renderAccount() {
    byId('guestAccount').hidden = !!state.user;
    byId('memberAccount').hidden = !state.user;
    byId('moderationPanel').hidden = !state.moderator;
    if (!state.user) {
      notice('accountStatus', t('Entre ou crie sua conta para participar.', 'Sign in or create an account to participate.'));
      return;
    }
    byId('memberEmail').textContent = state.user.email || '';
    byId('banStatus').hidden = !state.banned;
    byId('banStatus').textContent = state.banned ? t('Sua conta foi suspensa da comunidade. A leitura continua disponível.', 'Your account is suspended from participating. Reading remains available.') : '';
    byId('profileForm').querySelectorAll('input,button').forEach(item => { item.disabled = state.banned; });
    const { data, error } = await db.from('profiles').select('username,display_name,avatar').eq('id', state.user.id).maybeSingle();
    if (error) notice('accountStatus', errorText(error), true);
    else {
      avatars?.render({...data,id:state.user.id});
      byId('profileName').value = data?.display_name || '';
      byId('profileUsername').value = data?.username || '';
      notice('accountStatus', t('Sua sessão está ativa.', 'You are signed in.'));
    }
    if (state.moderator) await loadModeration();
  }

  function installPasswordToggle(input) {
    if (!input) return () => {};
    const button = node('button', 'community-link password-toggle');
    button.type = 'button';
    button.setAttribute('aria-controls', input.id);
    const render = () => {
      const visible = input.type === 'text';
      button.textContent = visible ? t('Ocultar senha', 'Hide password') : t('Mostrar senha', 'Show password');
      button.setAttribute('aria-pressed', String(visible));
    };
    button.addEventListener('click', () => {
      input.type = input.type === 'password' ? 'text' : 'password';
      render();
    });
    input.insertAdjacentElement('afterend', button);
    byId('languageChoices')?.addEventListener('click', render);
    render();
    return () => { input.value = ''; input.type = 'password'; render(); };
  }

  function installPasswordConfirmation(password, confirmation) {
    if (!password || !confirmation) return () => false;
    const message = () => password.value !== confirmation.value ? t('As senhas não coincidem. Digite a mesma senha nos dois campos.', 'Passwords do not match. Enter the same password in both fields.') : '';
    const validate = () => confirmation.setCustomValidity(message());
    password.addEventListener('input', validate);
    confirmation.addEventListener('input', validate);
    byId('languageChoices')?.addEventListener('click', validate);
    return () => {
      validate();
      if (password.value.length < 8) {
        notice('accountStatus', t('Use uma senha de pelo menos 8 caracteres.', 'Use a password with at least 8 characters.'), true);
        password.focus();
        return false;
      }
      if (message()) {
        notice('accountStatus', message(), true);
        confirmation.reportValidity();
        return false;
      }
      return true;
    };
  }

  function installAccountForms() {
    const clearLoginPassword = installPasswordToggle(byId('loginPassword'));
    const clearSignupPassword = installPasswordToggle(byId('signupPassword'));
    const clearSignupConfirmation = installPasswordToggle(byId('signupPasswordConfirm'));
    const validateSignup = installPasswordConfirmation(byId('signupPassword'), byId('signupPasswordConfirm'));
    byId('signupForm')?.addEventListener('submit', async event => {
      event.preventDefault();
      const form = event.currentTarget;
      const email = byId('signupEmail').value.trim();
      const password = byId('signupPassword').value;
      if (!validateSignup()) return;
      const captchaToken = captchaTokenFor('signupForm');
      if (!captchaToken) return;
      busy(form, true);
      try {
        const { data, error } = await db.auth.signUp({ email, password, options: { emailRedirectTo: ACCOUNT_URL, captchaToken } });
        if (error) return notice('accountStatus', errorText(error), true);
        if (data.session) await refreshIdentity();
        notice('accountStatus', t('Cadastro solicitado. Se necessário, abra o link de confirmação enviado ao seu e-mail.', 'Sign-up requested. If required, follow the confirmation link sent to your email.'));
      } catch (error) {
        notice('accountStatus', errorText(error), true);
      } finally {
        clearSignupPassword();
        clearSignupConfirmation();
        byId('signupPasswordConfirm').setCustomValidity('');
        busy(form, false);
        resetCaptcha('signupForm');
      }
    });
    byId('loginForm')?.addEventListener('submit', async event => {
      event.preventDefault();
      const form = event.currentTarget;
      const captchaToken = captchaTokenFor('loginForm');
      if (!captchaToken) return;
      busy(form, true);
      try {
        const { error } = await db.auth.signInWithPassword({ email: byId('loginEmail').value.trim(), password: byId('loginPassword').value, options: { captchaToken } });
        if (error) return notice('accountStatus', errorText(error), true);
        await refreshIdentity();
      } catch (error) {
        notice('accountStatus', errorText(error), true);
      } finally {
        clearLoginPassword();
        busy(form, false);
        resetCaptcha('loginForm');
      }
    });
    byId('resetForm')?.addEventListener('submit', async event => {
      event.preventDefault();
      const emailInput = byId('resetEmail');
      const email = emailInput.value.trim();
      if (!email || !emailInput.checkValidity()) return notice('accountStatus', t('Digite um e-mail válido.', 'Enter a valid email.'), true);
      const captchaToken = captchaTokenFor('resetForm');
      if (!captchaToken) return;
      const form = event.currentTarget;
      busy(form, true);
      try {
        const { error } = await db.auth.resetPasswordForEmail(email, { redirectTo: ACCOUNT_URL, captchaToken });
        notice('accountStatus', error ? errorText(error) : t('Se o endereço estiver cadastrado, enviaremos um link para redefinir a senha.', 'If the address is registered, a password reset link will be sent.'), !!error);
      } catch (error) {
        notice('accountStatus', errorText(error), true);
      } finally {
        busy(form, false);
        resetCaptcha('resetForm');
      }
    });
    byId('profileForm').addEventListener('submit', async event => {
      event.preventDefault();
      if (!state.user || state.banned) return;
      const form = event.currentTarget;
      const username = byId('profileUsername').value.trim();
      const name = byId('profileName').value.trim();
      if (!name || (username && !/^[a-z0-9_]{3,24}$/.test(username))) return notice('accountStatus', t('Confira os dados do perfil.', 'Check your profile details.'), true);
      busy(form, true);
      const { error } = await db.from('profiles').update({ display_name: name, username: username || null }).eq('id', state.user.id);
      busy(form, false);
      notice('accountStatus', error ? errorText(error) : t('Perfil atualizado.', 'Profile updated.'), !!error);
    });
    byId('logoutBtn').addEventListener('click', async () => {
      const { error } = await db.auth.signOut();
      if (error) return notice('accountStatus', errorText(error), true);
      await refreshIdentity();
    });
    // The password recovery email lands on this page. Never store passwords in our database.
    const passwordForm = node('form', 'community-form');
    passwordForm.id = 'passwordForm';
    const passwordLabel = node('label', '', t('Nova senha (mínimo 8 caracteres)', 'New password (at least 8 characters)'));
    passwordLabel.htmlFor = 'newPassword';
    const passwordInput = node('input');
    passwordInput.id = 'newPassword';
    passwordInput.type = 'password';
    passwordInput.autocomplete = 'new-password';
    passwordInput.minLength = 8;
    passwordInput.required = true;
    const confirmationLabel = node('label', '', t('Repita a nova senha', 'Repeat new password'));
    confirmationLabel.htmlFor = 'newPasswordConfirm';
    const confirmationInput = node('input');
    confirmationInput.id = 'newPasswordConfirm';
    confirmationInput.type = 'password';
    confirmationInput.autocomplete = 'new-password';
    confirmationInput.minLength = 8;
    confirmationInput.required = true;
    const passwordButton = node('button', 'action', t('Alterar senha', 'Change password'));
    passwordButton.type = 'submit';
    passwordForm.append(passwordLabel, passwordInput, confirmationLabel, confirmationInput, passwordButton);
    byId('memberAccount').insertBefore(passwordForm, byId('logoutBtn'));
    const clearNewPassword = installPasswordToggle(passwordInput);
    const clearNewConfirmation = installPasswordToggle(confirmationInput);
    const validateNewPassword = installPasswordConfirmation(passwordInput, confirmationInput);
    passwordForm.addEventListener('submit', async event => {
      event.preventDefault();
      if (!state.user) return;
      if (!validateNewPassword()) return;
      busy(passwordForm, true);
      try {
        const { error } = await db.auth.updateUser({ password: passwordInput.value });
        notice('accountStatus', error ? errorText(error) : t('Senha atualizada.', 'Password updated.'), !!error);
      } catch (error) {
        notice('accountStatus', errorText(error), true);
      } finally {
        clearNewPassword();
        clearNewConfirmation();
        confirmationInput.setCustomValidity('');
        busy(passwordForm, false);
      }
    });
    byId('reloadModeration').addEventListener('click', loadModeration);
    byId('languageChoices')?.addEventListener('click', () => {
      passwordLabel.textContent = t('Nova senha (mínimo 8 caracteres)', 'New password (at least 8 characters)');
      confirmationLabel.textContent = t('Repita a nova senha', 'Repeat new password');
      passwordButton.textContent = t('Alterar senha', 'Change password');
      refreshIdentity();
    });
  }

  async function loadModeration() {
    if (!state.moderator) return;
    const list = byId('moderationComments');
    const bansList = byId('activeBans');
    list.replaceChildren(node('li', 'community-hint', t('Carregando…', 'Loading…')));
    bansList.replaceChildren();
    const [comments, bans] = await Promise.all([
      db.from('comments').select('id,author_id,body,status,created_at').eq('episode_slug', 'episodio-01').order('created_at', { ascending: false }).limit(100),
      db.rpc('moderation_active_bans')
    ]);
    if (comments.error || bans.error) {
      list.replaceChildren(node('li', 'community-notice error', errorText(comments.error || bans.error)));
      return;
    }
    const ids = [...new Set((comments.data || []).map(item => item.author_id))];
    const profiles = ids.length ? await db.from('profiles').select('id,display_name,username,avatar').in('id', ids) : { data: [] };
    const names = new Map((profiles.data || []).map(item => [item.id, item.display_name]));
    const people = new Map((profiles.data || []).map(item => [item.id, item]));
    list.replaceChildren();
    if (!comments.data.length) list.append(node('li', 'community-hint', t('Nenhum comentário.', 'No comments.')));
    (comments.data || []).forEach(comment => {
      const item = node('li', 'comment-item');
      if (avatars) item.append(avatars.image(people.get(comment.author_id)));
      item.append(node('strong', '', names.get(comment.author_id) || t('Leitor', 'Reader')),
        node('p', 'comment-meta', `${comment.status} · ${dateText(comment.created_at)} · ${comment.author_id}`),
        node('p', 'comment-body', comment.body));
      const actions = node('div', 'community-actions');
      [['visible', t('Restaurar', 'Restore')], ['hidden', t('Ocultar', 'Hide')], ['removed', t('Remover', 'Remove')]].forEach(([status, label]) => {
        if (status === comment.status) return;
        const button = node('button', 'community-action', label);
        button.type = 'button';
        button.addEventListener('click', async () => {
          const reason = window.prompt(t('Motivo da moderação (3 a 500 caracteres):', 'Moderation reason (3 to 500 characters):'));
          if (!reason || reason.trim().length < 3 || reason.trim().length > 500) return;
          button.disabled = true;
          const { error } = await db.rpc('moderate_comment', { p_comment_id: comment.id, p_status: status, p_reason: reason.trim() });
          if (error) notice('accountStatus', errorText(error), true);
          await loadModeration();
        });
        actions.append(button);
      });
      const ban = node('button', 'community-action danger', t('Banir usuário', 'Ban user'));
      ban.type = 'button';
      ban.addEventListener('click', async () => {
        const reason = window.prompt(t('Motivo do banimento (5 a 500 caracteres):', 'Ban reason (5 to 500 characters):'));
        if (!reason || reason.trim().length < 5 || reason.trim().length > 500) return;
        const days = window.prompt(t('Duração em dias: 1 a 3650; 0 = permanente.', 'Duration in days: 1 to 3650; 0 = permanent.'), '7');
        if (days === null || !/^(0|[1-9][0-9]{0,3})$/.test(days) || Number(days) > 3650) return;
        const expiry = Number(days) ? new Date(Date.now() + Number(days) * 86400000).toISOString() : null;
        if (!window.confirm(t('Confirmar banimento deste usuário?', 'Confirm ban for this user?'))) return;
        ban.disabled = true;
        const { error } = await db.rpc('ban_member', { p_user_id: comment.author_id, p_reason: reason.trim(), p_expires_at: expiry });
        notice('accountStatus', error ? errorText(error) : t('Banimento registrado.', 'Ban recorded.'), !!error);
        await loadModeration();
      });
      actions.append(ban);
      item.append(actions);
      list.append(item);
    });
    bansList.replaceChildren();
    if (!bans.data?.length) bansList.append(node('li', 'community-hint', t('Nenhum banimento ativo.', 'No active bans.')));
    (bans.data || []).forEach(ban => {
      const item = node('li', 'comment-item');
      item.append(node('strong', '', ban.display_name || ban.user_id), node('p', 'comment-body', ban.reason),
        node('p', 'comment-meta', `${ban.user_id} · ${ban.expires_at ? dateText(ban.expires_at) : t('Permanente', 'Permanent')}`));
      const button = node('button', 'community-action', t('Revogar banimento', 'Revoke ban'));
      button.type = 'button';
      button.addEventListener('click', async () => {
        const reason = window.prompt(t('Motivo da revogação (3 a 500 caracteres):', 'Reason for revocation (3 to 500 characters):'));
        if (!reason || reason.trim().length < 3 || reason.trim().length > 500) return;
        if (!window.confirm(t('Revogar o banimento?', 'Revoke this ban?'))) return;
        button.disabled = true;
        const { error } = await db.rpc('unban_member', { p_user_id: ban.user_id, p_reason: reason.trim() });
        notice('accountStatus', error ? errorText(error) : t('Banimento revogado. Comentários ocultos permanecem ocultos.', 'Ban revoked. Hidden comments remain hidden.'), !!error);
        await loadModeration();
      });
      item.append(button);
      bansList.append(item);
    });
  }

  async function renderEpisode() {
    const slug = episodeRoot.dataset.communityEpisode;
    const [episode, totals] = await Promise.all([
      db.from('episodes').select('slug').eq('slug', slug).maybeSingle(),
      db.rpc('reaction_totals', { p_slug: slug })
    ]);
    if (episode.error || totals.error || !episode.data) {
      byId('voteLike').disabled = true;
      byId('voteDislike').disabled = true;
      notice('communityStatus', t('A comunidade deste episódio ainda não está disponível.', 'This episode community is not yet available.'), true);
      return;
    }
    const counts = Array.isArray(totals.data) ? totals.data[0] : totals.data;
    byId('likeCount').textContent = String(counts?.likes ?? 0);
    byId('dislikeCount').textContent = String(counts?.dislikes ?? 0);
    state.vote = null;
    if (state.user) {
      const { data, error } = await db.from('reactions').select('vote').eq('episode_slug', slug).eq('user_id', state.user.id).maybeSingle();
      if (error) return notice('communityStatus', errorText(error), true);
      state.vote = data?.vote ?? null;
    }
    const allowed = !!state.user && !state.banned;
    byId('voteLike').disabled = !allowed;
    byId('voteDislike').disabled = !allowed;
    byId('voteLike').setAttribute('aria-pressed', String(state.vote === 1));
    byId('voteDislike').setAttribute('aria-pressed', String(state.vote === -1));
    byId('commentForm').hidden = !allowed;
    byId('joinCommunity').hidden = !!state.user;
    notice('communityStatus', state.banned ? t('Sua conta está suspensa de comentar e votar.', 'Your account cannot comment or vote while suspended.') : state.user ? t('Você está conectado. Respeite os outros leitores.', 'You are signed in. Please respect other readers.') : t('Leia os comentários livremente. Entre para comentar ou votar.', 'Read comments freely. Sign in to comment or vote.'));
    state.offset = 0;
    await loadComments(false);
  }

  async function loadComments(more) {
    if (!more) byId('commentList').replaceChildren();
    const slug = episodeRoot.dataset.communityEpisode;
    const { data, error } = await db.from('comments').select('id,author_id,body,created_at').eq('episode_slug', slug).eq('status', 'visible').order('created_at', { ascending: false }).range(state.offset, state.offset + 19);
    if (error) {
      notice('communityStatus', errorText(error), true);
      byId('moreComments').hidden = true;
      return;
    }
    const ids = [...new Set((data || []).map(item => item.author_id))];
    const profiles = ids.length ? await db.from('profiles').select('id,display_name,avatar').in('id', ids) : { data: [] };
    const names = new Map((profiles.data || []).map(item => [item.id, item.display_name]));
    const people = new Map((profiles.data || []).map(item => [item.id, item]));
    if (!more && !data.length) byId('commentList').append(node('li', 'community-hint', t('Ainda não há comentários. Comece a conversa!', 'No comments yet. Start the conversation!')));
    (data || []).forEach(comment => {
      const item = node('li', 'comment-item');
      const header = node('div', 'comment-header');
      const time = node('time', '', dateText(comment.created_at));
      time.dateTime = comment.created_at;
      if (avatars) header.append(avatars.image(people.get(comment.author_id)));
      header.append(node('strong', '', names.get(comment.author_id) || t('Leitor', 'Reader')), time);
      item.append(header, node('p', 'comment-body', comment.body));
      byId('commentList').append(item);
    });
    state.offset += (data || []).length;
    byId('moreComments').hidden = data.length < 20;
  }

  function installEpisodeForms() {
    const slug = episodeRoot.dataset.communityEpisode;
    async function vote(value) {
      if (!state.user || state.banned) return;
      byId('voteLike').disabled = true;
      byId('voteDislike').disabled = true;
      const was = state.vote;
      const operation = was === value ? db.from('reactions').delete().eq('episode_slug', slug).eq('user_id', state.user.id)
        : was === null ? db.from('reactions').insert({ episode_slug: slug, user_id: state.user.id, vote: value })
          : db.from('reactions').update({ vote: value }).eq('episode_slug', slug).eq('user_id', state.user.id);
      const { error } = await operation;
      if (error) notice('communityStatus', errorText(error), true);
      await renderEpisode();
    }
    byId('voteLike').addEventListener('click', () => vote(1));
    byId('voteDislike').addEventListener('click', () => vote(-1));
    byId('commentForm').addEventListener('submit', async event => {
      event.preventDefault();
      if (!state.user || state.banned) return;
      const form = event.currentTarget;
      const body = byId('commentBody').value.trim();
      if (!body || body.length > 2000) return notice('communityStatus', t('Seu comentário deve ter de 1 a 2.000 caracteres.', 'Comments must contain 1–2,000 characters.'), true);
      busy(form, true);
      const { error } = await db.from('comments').insert({ episode_slug: slug, author_id: state.user.id, body });
      busy(form, false);
      if (error) return notice('communityStatus', errorText(error), true);
      byId('commentBody').value = '';
      notice('communityStatus', t('Comentário publicado.', 'Comment posted.'));
      state.offset = 0;
      await loadComments(false);
    });
    byId('moreComments').addEventListener('click', () => loadComments(true));
    byId('languageChoices')?.addEventListener('click', () => refreshIdentity());
  }

  if (account) installAccountForms();
  if (episodeRoot) installEpisodeForms();
  db.auth.onAuthStateChange(() => { setTimeout(refreshIdentity, 0); });
  refreshIdentity();
})();
