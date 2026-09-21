/* Show a verified member's public profile in the shared header; never trust cached display data. */
(() => {
  'use strict';
  const link = document.querySelector('body > .site-header nav .account-access');
  if (!link || link.dataset.accountBadgeReady) return;
  link.dataset.accountBadgeReady = 'true';

  const project = 'https://znenamrszhjsiztllcit.supabase.co';
  const publishableKey = 'sb_publishable_3VRFxwtDuYq4ETHs4xof8g_Fp3GRl6c';
  const presets = { robot: '🤖', fox: '🦊', cat: '🐱', rocket: '🚀', star: '⭐', moon: '🌙' };
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
  const guestPT = link.getAttribute('data-pt') || 'Entrar / Cadastre-se';
  const guestEN = link.getAttribute('data-en') || 'Sign in / Sign up';
  const pt = () => document.documentElement.lang.toLowerCase().startsWith('pt');
  let member = null;
  let request = 0;

  const scriptBase = document.currentScript?.src || document.baseURI;
  const style = document.createElement('link');
  style.rel = 'stylesheet';
  style.href = new URL('header-account.css', scriptBase).href;
  document.head.appendChild(style);

  function guest() {
    member = null;
    ++request; // Invalidate a profile fetch started before sign-out.
    link.classList.remove('is-signed-in');
    link.setAttribute('data-pt', guestPT);
    link.setAttribute('data-en', guestEN);
    link.removeAttribute('aria-label');
    link.textContent = pt() ? guestPT : guestEN;
  }

  function display(profile) {
    const name = typeof profile?.display_name === 'string' && profile.display_name.trim()
      ? profile.display_name.trim().slice(0, 60)
      : typeof profile?.username === 'string' && profile.username.trim()
        ? profile.username.trim().slice(0, 24)
        : pt() ? 'Minha conta' : 'My account';
    return name;
  }

  function renderMember() {
    if (!member) return;
    const name = display(member.profile);
    const avatar = document.createElement('span');
    avatar.className = 'header-account-avatar';
    avatar.setAttribute('aria-hidden', 'true');
    const value = member.profile?.avatar;
    avatar.textContent = Object.prototype.hasOwnProperty.call(presets, value) ? presets[value] : '👤';
    const version = typeof value === 'string' && value.startsWith('upload:') ? value.slice(7) : '';
    if (uuid.test(member.id) && uuid.test(version)) {
      const image = document.createElement('img');
      image.src = `${project}/storage/v1/object/public/community-avatars/${member.id}/avatar.jpg?v=${version}`;
      image.alt = '';
      image.width = image.height = 32;
      image.addEventListener('error', () => image.remove(), { once: true });
      avatar.appendChild(image);
    }
    const label = document.createElement('span');
    label.className = 'header-account-name';
    label.textContent = name; // Never inject names or profile values as HTML.
    link.removeAttribute('data-pt');
    link.removeAttribute('data-en');
    link.classList.add('is-signed-in');
    link.setAttribute('aria-label', pt() ? `Sua conta: ${name}` : `Your account: ${name}`);
    link.replaceChildren(avatar, label);
  }

  // The home and reader language pickers replace nodes with data-pt/data-en.
  // Remove those attributes only while signed in so they cannot erase the avatar.
  new MutationObserver(() => {
    if (member) renderMember();
    else link.textContent = pt() ? guestPT : guestEN;
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });

  function start(sdk) {
    // Separate read-only client: do not process auth callbacks or sign users in/out here.
    const db = sdk.createClient(project, publishableKey, {
      auth: { persistSession: true, autoRefreshToken: false, detectSessionInUrl: false }
    });
    async function refresh() {
      const current = ++request;
      try {
        const { data, error } = await db.auth.getUser();
        if (current !== request) return;
        if (error || !data?.user) { guest(); return; }
        const id = data.user.id;
        if (!uuid.test(id)) { guest(); return; }
        const profile = await db.from('profiles').select('display_name,username,avatar').eq('id', id).maybeSingle();
        if (current !== request) return;
        // An inaccessible profile displays a generic account label, not an email address.
        member = { id, profile: profile.error ? null : profile.data };
        renderMember();
      } catch (_) {
        if (current === request) guest();
      }
    }
    let pending = null;
    const scheduleRefresh = () => {
      if (pending !== null) clearTimeout(pending);
      pending = setTimeout(() => { pending = null; refresh(); }, 80);
    };
    db.auth.onAuthStateChange(event => {
      if (event === 'SIGNED_OUT') guest();
      scheduleRefresh();
    });
    window.addEventListener('pageshow', scheduleRefresh);
    window.addEventListener('focus', scheduleRefresh);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') scheduleRefresh();
    });
    // Account forms update the visible member section and notices after login,
    // profile edits and picture saves, including when another client owns the form.
    const memberSection = document.getElementById('memberAccount');
    if (memberSection) {
      new MutationObserver(scheduleRefresh).observe(memberSection, {
        attributes: true, attributeFilter: ['hidden'], childList: true,
        characterData: true, subtree: true
      });
      const status = document.getElementById('accountStatus');
      if (status) new MutationObserver(scheduleRefresh).observe(status, {
        childList: true, characterData: true, subtree: true
      });
    }
    refresh();
  }

  // Community pages already have a pinned SDK script; other pages load it only
  // for the account badge, never duplicating the SDK script element.
  if (window.supabase?.createClient) start(window.supabase);
  else {
    let sdkScript = document.querySelector('script[src*="@supabase/supabase-js@"]');
    if (!sdkScript) {
      sdkScript = document.createElement('script');
      sdkScript.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/dist/umd/supabase.min.js';
      sdkScript.async = true;
      document.head.appendChild(sdkScript);
    }
    sdkScript.addEventListener('load', () => {
      if (window.supabase?.createClient) start(window.supabase);
    }, { once: true });
    // On unavailable services the original guest link remains usable.
  }
})();
