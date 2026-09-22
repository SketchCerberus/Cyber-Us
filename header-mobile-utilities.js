/* Put account, notifications, theme and language before site links on compact screens.
   Move existing elements instead of cloning them so their auth, menus and handlers survive. */
(() => {
  'use strict';
  const header = document.querySelector('body > .site-header.scroll-header');
  const nav = header?.querySelector('nav');
  const account = nav?.querySelector('.account-access');
  const theme = nav?.querySelector('.theme-toggle');
  const language = nav?.querySelector('.language-picker') || nav?.querySelector('#languageBtn');
  if (!nav || !account || !theme || !language || nav.dataset.mobileUtilitiesReady) return;
  nav.dataset.mobileUtilitiesReady = 'true';

  const base = document.currentScript?.src || document.baseURI;
  const css = document.createElement('link');
  css.rel = 'stylesheet';
  css.href = new URL('header-mobile-utilities.css', base).href;
  document.head.append(css);

  const compact = window.matchMedia('(max-width:1100px)');
  const tray = document.createElement('div');
  tray.className = 'mobile-nav-utilities';
  tray.setAttribute('role', 'group');
  let observedBell = null;
  const syncLanguage = () => tray.setAttribute('aria-label',
    document.documentElement.lang.toLowerCase().startsWith('pt') ? 'Conta e preferências' : 'Account and preferences');

  function observeBell(shell) {
    const bell = shell?.querySelector('.header-notifications-bell');
    if (!bell || bell === observedBell) return;
    observedBell = bell;
    const syncOpen = () => tray.classList.toggle('has-open-notifications',
      bell.getAttribute('aria-expanded') === 'true');
    new MutationObserver(syncOpen).observe(bell, {attributes:true, attributeFilter:['aria-expanded']});
    syncOpen();
  }

  function sync() {
    const shell = nav.querySelector('#headerNotifications');
    if (!compact.matches) {
      if (tray.isConnected) {
        // Restore desktop DOM order and original control instances.
        nav.append(...[account, shell, theme, language].filter(Boolean));
        tray.remove();
      }
      return;
    }
    if (!tray.isConnected) nav.prepend(tray);
    const controls = [account, shell, theme, language].filter(Boolean);
    if (controls.length !== tray.children.length ||
        controls.some((control, index) => tray.children[index] !== control)) {
      tray.append(...controls);
    }
    observeBell(shell);
    syncLanguage();
  }

  // The bell is loaded asynchronously after the account session module.
  // Observing additions also preserves the ordering when it first appears.
  new MutationObserver(sync).observe(nav, {childList:true, subtree:true});
  if (compact.addEventListener) compact.addEventListener('change', sync);
  else compact.addListener(sync);
  new MutationObserver(syncLanguage).observe(document.documentElement,
    {attributes:true, attributeFilter:['lang']});
  sync();
})();
