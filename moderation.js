/* Moderator-only workspace. Database RLS and RPCs remain the authorization boundary. */
(() => {
  'use strict';
  const byId = id => document.getElementById(id);
  if (!byId('moderationWorkspace')) return;
  const pt = () => document.documentElement.lang.startsWith('pt');
  const t = (br, en) => pt() ? br : en;
  const el = (tag, cls, text) => {
    const item = document.createElement(tag);
    if (cls) item.className = cls;
    if (text !== undefined) item.textContent = text;
    return item;
  };
  const announce = (text, error = false, id = 'moderationNotice') => {
    const item = byId(id);
    item.textContent = text;
    item.classList.toggle('error', error);
  };
  const date = value => value ? new Intl.DateTimeFormat(pt() ? 'pt-BR' : 'en', {dateStyle:'medium',timeStyle:'short'}).format(new Date(value)) : '';
  const message = error => error?.message || t('Tente novamente.', 'Please try again.');
  const pageSize = 25;
  const state = { authorized:false, user:null, episodes:[], open:null, selection:null, tab:'comments', offset:0, loading:false, request:0, identity:0 };
  if (!window.supabase?.createClient) {
    announce(t('Serviço indisponível. Atualize a página.', 'Service unavailable. Refresh the page.'), true);
    return;
  }
  const project = 'https://znenamrszhjsiztllcit.supabase.co';
  const db = window.supabase.createClient(project, 'sb_publishable_3VRFxwtDuYq4ETHs4xof8g_Fp3GRl6c', {
    auth: { flowType:'pkce', detectSessionInUrl:false, persistSession:true, autoRefreshToken:true }
  });
  const avatars = window.CyberUsAvatars?.create({db,projectUrl:project,state,t});
  const episodeName = episode => /^episodio-\d+$/.test(episode.slug)
    ? `EP-${String(episode.sort_order).padStart(2, '0')} · ${pt() ? episode.title_pt : episode.title_en}`
    : (pt() ? episode.title_pt : episode.title_en);
  const localeName = locale => locale === 'pt' ? t('Português', 'Portuguese') : t('Inglês', 'English');

  function showTab(tab) {
    state.tab = tab;
    byId('moderationCommentsView').hidden = tab !== 'comments';
    byId('moderationBansView').hidden = tab !== 'bans';
    byId('moderationCommentsTab').setAttribute('aria-pressed', String(tab === 'comments'));
    byId('moderationBansTab').setAttribute('aria-pressed', String(tab === 'bans'));
    if (tab === 'bans') loadBans();
  }

  function renderFolders() {
    const host = byId('moderationFolders');
    host.replaceChildren();
    if (!state.episodes.length) host.append(el('p', 'community-hint', t('Nenhum episódio disponível.', 'No episodes available.')));
    for (const [index, episode] of state.episodes.entries()) {
      const folder = el('div', 'moderation-folder');
      const button = el('button', '', `📁 ${episodeName(episode)}`);
      const choices = el('div', 'moderation-languages');
      const open = state.open === episode.slug;
      choices.id = `moderation-folder-${index}`;
      choices.hidden = !open;
      button.type = 'button';
      button.setAttribute('aria-expanded', String(open));
      button.setAttribute('aria-controls', choices.id);
      button.addEventListener('click', () => {
        state.open = open ? null : episode.slug;
        renderFolders();
      });
      for (const locale of ['pt','en']) {
        const option = el('button', '', localeName(locale));
        option.type = 'button';
        option.setAttribute('aria-pressed', String(state.selection?.slug === episode.slug && state.selection?.locale === locale));
        option.addEventListener('click', () => {
          // A previous locale's response must never be rendered under the newly selected heading.
          ++state.request;
          state.loading = false;
          state.selection = {slug:episode.slug,locale};
          state.open = episode.slug;
          byId('moderationSelection').hidden = false;
          renderFolders();
          loadComments(false);
          byId('moderationSelection').scrollIntoView({block:'start'});
        });
        choices.append(option);
      }
      folder.append(button, choices);
      host.append(folder);
    }
    if (state.selection) {
      const chosen = state.episodes.find(ep => ep.slug === state.selection.slug);
      byId('moderationSelectedHeading').textContent = chosen ? `${episodeName(chosen)} — ${localeName(state.selection.locale)}` : '';
    }
  }

  async function loadEpisodes() {
    const result = await db.from('episodes').select('slug,title_pt,title_en,sort_order').eq('community_enabled',true).order('sort_order',{ascending:true});
    if (result.error) { announce(message(result.error),true); return; }
    state.episodes = result.data || [];
    if (state.selection && !state.episodes.some(ep => ep.slug === state.selection.slug)) {
      state.selection = null;
      byId('moderationSelection').hidden = true;
    }
    renderFolders();
  }

  async function loadComments(more = false) {
    if (!state.authorized || !state.selection || state.loading) return;
    const {slug,locale} = state.selection;
    const ticket = ++state.request;
    const start = more ? state.offset : 0;
    state.loading = true;
    byId('moderationMore').disabled = true;
    if (!more) {
      state.offset = 0;
      byId('moderationMore').hidden = true;
      byId('moderationComments').replaceChildren();
    }
    announce(t('Carregando comentários…', 'Loading comments…'), false, 'moderationCommentsStatus');
    try {
      const result = await db.from('comments')
        .select('id,episode_slug,language_code,author_id,body,status,created_at,parent_id,deleted_by_author')
        .eq('episode_slug',slug).eq('language_code',locale)
        .order('created_at',{ascending:false}).order('id',{ascending:false})
        .range(start,start+pageSize-1);
      if (result.error) throw result.error;
      if (ticket !== state.request || !state.authorized) return;
      const comments = result.data || [];
      const ids = [...new Set(comments.map(row => row.author_id))];
      const profiles = ids.length ? await db.from('profiles').select('id,display_name,username,avatar').in('id',ids) : {data:[]};
      if (ticket !== state.request || !state.authorized) return;
      const people = new Map((profiles.data || []).map(person => [person.id,person]));
      for (const comment of comments) {
        const person = people.get(comment.author_id);
        const item = el('li','comment-item');
        if (avatars) item.append(avatars.image(person));
        const author = person?.display_name || person?.username || t('Leitor','Reader');
        item.append(el('strong','',author),
          el('p','comment-meta',`${comment.status} · ${date(comment.created_at)} · ${comment.author_id}`),
          el('p','comment-body',comment.deleted_by_author ? t('Removido pelo autor.','Removed by author.') : comment.body));
        if (comment.parent_id) item.append(el('p','comment-meta',t('Resposta a um comentário','Reply to comment')));
        const actions = el('div','community-actions');
        for (const [next,labelPT,labelEN] of [['visible','Restaurar','Restore'],['hidden','Ocultar','Hide'],['removed','Remover','Remove']]) {
          if (next === comment.status) continue;
          const action = el('button','community-action',t(labelPT,labelEN));
          action.type = 'button';
          action.addEventListener('click',async () => {
            const reason = window.prompt(t('Motivo da moderação (3 a 500 caracteres):','Moderation reason (3–500 characters):'));
            if (!reason || reason.trim().length < 3 || reason.trim().length > 500) return;
            action.disabled = true;
            try {
              const outcome = await db.rpc('moderate_comment',{p_comment_id:comment.id,p_status:next,p_reason:reason.trim()});
              if (outcome.error) throw outcome.error;
              announce(t('Comentário atualizado.','Comment updated.'));
              await loadCommentsAfterAction();
            } catch (error) { announce(message(error),true); action.disabled = false; }
          });
          actions.append(action);
        }
        const ban = el('button','community-action danger',t('Banir usuário','Ban user'));
        ban.type = 'button';
        ban.addEventListener('click',async () => {
          const reason = window.prompt(t('Motivo do banimento (5 a 500 caracteres):','Ban reason (5–500 characters):'));
          if (!reason || reason.trim().length < 5 || reason.trim().length > 500) return;
          const days = window.prompt(t('Duração em dias: 1 a 3650; 0 = permanente.','Duration in days: 1–3650; 0 = permanent.'),'7');
          if (days === null || !/^(0|[1-9][0-9]{0,3})$/.test(days) || Number(days) > 3650) return;
          if (!window.confirm(t('Confirmar banimento deste usuário?','Confirm ban for this user?'))) return;
          const expiry = Number(days) ? new Date(Date.now()+Number(days)*86400000).toISOString() : null;
          ban.disabled = true;
          try {
            const outcome = await db.rpc('ban_member',{p_user_id:comment.author_id,p_reason:reason.trim(),p_expires_at:expiry});
            if (outcome.error) throw outcome.error;
            announce(t('Banimento registrado.','Ban recorded.'));
            await loadCommentsAfterAction();
          } catch (error) { announce(message(error),true); ban.disabled = false; }
        });
        actions.append(ban);
        item.append(actions);
        byId('moderationComments').append(item);
      }
      state.offset = start+comments.length;
      byId('moderationMore').hidden = comments.length < pageSize;
      announce(!comments.length && !more ? t('Nenhum comentário nesta pasta.','No comments in this folder.') : t('Comentários carregados.','Comments loaded.'),false,'moderationCommentsStatus');
    } catch (error) {
      if (ticket === state.request) announce(message(error),true,'moderationCommentsStatus');
    } finally {
      if (ticket === state.request) {state.loading = false;byId('moderationMore').disabled = false;}
    }
  }

  async function loadCommentsAfterAction() {
    state.loading = false;
    ++state.request;
    await loadComments(false);
  }

  async function loadBans() {
    if (!state.authorized) return;
    const list = byId('moderationBans');
    list.replaceChildren(el('li','community-hint',t('Carregando…','Loading…')));
    try {
      // This RPC checks is_moderator() server-side before reading private ban/auth history.
      const result = await db.rpc('moderation_active_bans_with_history');
      if (result.error) throw result.error;
      if (!state.authorized) return;
      list.replaceChildren();
      if (!result.data?.length) list.append(el('li','community-hint',t('Nenhum banimento ativo.','No active bans.')));
      for (const ban of result.data || []) {
        const item = el('li','comment-item');
        item.append(el('strong','',ban.display_name || ban.user_id),
          el('p','comment-body',ban.reason),
          el('p','comment-meta',`${ban.user_id} · ${ban.expires_at ? date(ban.expires_at) : t('Permanente','Permanent')}`));
        const days = Number(ban.days_banned);
        const daysLabel = ban.days_banned == null || !Number.isFinite(days) ? '—'
          : `${new Intl.NumberFormat(pt() ? 'pt-BR' : 'en-US', {minimumFractionDigits:2,maximumFractionDigits:2}).format(days)} ${t('dias','days')}`;
        const stats = el('dl','moderation-ban-stats');
        for (const [label,value] of [
          [t('Vezes banido','Times banned'), String(ban.ban_count ?? '—')],
          [t('Tempo banido (cumprido)','Time banned (served)'),daysLabel],
          [t('Conta criada em','Account created'),ban.account_created_at ? date(ban.account_created_at) : '—']
        ]) {
          const field = el('div','moderation-ban-stat');
          field.append(el('dt','',label),el('dd','',value));
          stats.append(field);
        }
        item.append(stats);
        const revoke = el('button','community-action',t('Revogar banimento','Revoke ban'));
        revoke.type = 'button';
        revoke.addEventListener('click',async () => {
          const reason = window.prompt(t('Motivo da revogação (3 a 500 caracteres):','Reason for revocation (3–500 characters):'));
          if (!reason || reason.trim().length < 3 || reason.trim().length > 500) return;
          if (!window.confirm(t('Revogar o banimento?','Revoke this ban?'))) return;
          revoke.disabled = true;
          try {
            const outcome = await db.rpc('unban_member',{p_user_id:ban.user_id,p_reason:reason.trim()});
            if (outcome.error) throw outcome.error;
            announce(t('Banimento revogado. Comentários ocultos continuam ocultos.','Ban revoked. Hidden comments remain hidden.'));
            await loadBans();
          } catch (error) {announce(message(error),true);revoke.disabled = false;}
        });
        item.append(revoke);
        list.append(item);
      }
    } catch (error) { list.replaceChildren(el('li','community-notice error',message(error))); }
  }

  async function verify() {
    const ticket = ++state.identity;
    state.authorized = false;
    ++state.request;
    state.loading = false;
    byId('moderationWorkspace').hidden = true;
    announce(t('Verificando acesso…','Checking access…'));
    try {
      const identity = await db.auth.getUser();
      if (ticket !== state.identity) return;
      if (identity.error || !identity.data?.user) {announce(t('Entre na sua conta para acessar a moderação.','Sign in to access moderation.'),true);return;}
      const staff = await db.rpc('is_moderator');
      if (ticket !== state.identity) return;
      if (staff.error || staff.data !== true) {announce(t('Acesso restrito à equipe de moderação.','Access restricted to moderation staff.'),true);return;}
      state.user = identity.data.user;
      state.authorized = true;
      byId('moderationWorkspace').hidden = false;
      announce(t('Acesso autorizado. Selecione um episódio.','Access granted. Select an episode.'));
      await loadEpisodes();
      if (state.selection) await loadComments(false);
    } catch (error) { if (ticket === state.identity) announce(message(error),true); }
  }

  byId('moderationCommentsTab').addEventListener('click',() => showTab('comments'));
  byId('moderationBansTab').addEventListener('click',() => showTab('bans'));
  byId('moderationReload').addEventListener('click',() => loadComments(false));
  byId('moderationMore').addEventListener('click',() => loadComments(true));
  byId('moderationBansReload').addEventListener('click',loadBans);
  db.auth.onAuthStateChange(() => setTimeout(verify,0));
  new MutationObserver(() => {
    if (!state.authorized) return;
    renderFolders();
    if (state.selection) loadCommentsAfterAction();
    if (state.tab === 'bans') loadBans();
  }).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
  verify();
})();
