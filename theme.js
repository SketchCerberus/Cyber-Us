/* Site-wide visual preference only: no account, database or artwork changes. */
(() => {
  'use strict';
  const root = document.documentElement;
  const key = 'cyber-us-theme';
  const system = window.matchMedia('(prefers-color-scheme: dark)');
  let stored = null;
  try { stored = window.localStorage.getItem(key); } catch (_) { /* storage disabled */ }
  let manual = stored === 'light' || stored === 'dark';
  let theme = manual ? stored : (system.matches ? 'dark' : 'light');
  root.dataset.theme = theme;

  const nav = document.querySelector('body > .site-header nav');
  if (!nav || nav.querySelector('.theme-toggle')) return;
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'theme-toggle';
  const languageControl = nav.querySelector('.language-picker') || nav.querySelector('#languageBtn');
  nav.insertBefore(toggle, languageControl || null);

  function sync() {
    const pt = root.lang.toLowerCase().startsWith('pt');
    const toLight = theme === 'dark';
    toggle.textContent = toLight ? (pt ? '☀ Claro' : '☀ Light') : (pt ? '☾ Escuro' : '☾ Dark');
    const description = toLight
      ? (pt ? 'Ativar modo claro' : 'Switch to light mode')
      : (pt ? 'Ativar modo escuro' : 'Switch to dark mode');
    toggle.setAttribute('aria-label', description);
    toggle.setAttribute('title', description);
    toggle.setAttribute('aria-pressed', String(theme === 'light'));
  }
  function setTheme(next, save) {
    if (next !== 'light' && next !== 'dark') return;
    theme = next;
    root.dataset.theme = theme;
    if (save) {
      manual = true;
      try { window.localStorage.setItem(key, theme); } catch (_) { /* storage disabled */ }
    }
    sync();
  }
  toggle.addEventListener('click', () => setTheme(theme === 'light' ? 'dark' : 'light', true));
  const onSystemChange = event => {
    if (!manual) setTheme(event.matches ? 'dark' : 'light', false);
  };
  if (system.addEventListener) system.addEventListener('change', onSystemChange);
  else if (system.addListener) system.addListener(onSystemChange);
  new MutationObserver(sync).observe(root, { attributes: true, attributeFilter: ['lang'] });
  sync();
})();
