/* Navegação retrátil compartilhada pela home e pelas páginas do leitor.
   Não modifica a autenticação, links existentes ou imagens dos episódios. */
(function () {
  'use strict';
  const header = document.querySelector('body > .site-header');
  if (!header || header.dataset.scrollHeaderReady) return;
  const nav = header.querySelector('nav');
  if (!nav) return;
  header.dataset.scrollHeaderReady = 'true';
  header.classList.add('scroll-header');

  // A comunidade já está na main (PR #3). Dar acesso também pelo menu da home.
  if (document.querySelector('main > .hero') && !nav.querySelector('a[href="comunidade.html"]')) {
    const account = document.createElement('a');
    account.href = 'comunidade.html';
    account.dataset.pt = 'Minha conta';
    account.dataset.en = 'My account';
    account.textContent = document.documentElement.lang === 'en' ? account.dataset.en : account.dataset.pt;
    const languagePicker = nav.querySelector('.language-picker') || nav.querySelector('#languageBtn');
    nav.insertBefore(account, languagePicker);
  }

  // O menu compacto preserva TODOS os links no celular e em telas estreitas.
  if (!nav.id) nav.id = 'site-primary-navigation';
  const menuButton = document.createElement('button');
  menuButton.type = 'button';
  menuButton.className = 'mobile-nav-toggle';
  menuButton.setAttribute('aria-controls', nav.id);
  menuButton.setAttribute('aria-expanded', 'false');
  header.insertBefore(menuButton, nav);

  let menuOpen = false;
  let keyboardUser = false;
  let pointerNearTop = false;
  let scrollingDown = false;
  let lastScroll = Math.max(0, window.scrollY);
  const desktopPointer = window.matchMedia('(hover: hover) and (pointer: fine)');

  function syncMenu() {
    const pt = document.documentElement.lang !== 'en';
    menuButton.textContent = menuOpen ? (pt ? 'Fechar' : 'Close') : 'Menu';
    menuButton.setAttribute('aria-label', menuOpen ? (pt ? 'Fechar navegação' : 'Close navigation') : (pt ? 'Abrir navegação' : 'Open navigation'));
    menuButton.setAttribute('aria-expanded', String(menuOpen));
    header.classList.toggle('menu-open', menuOpen);
  }
  function closeMenu() {
    menuOpen = false;
    syncMenu();
  }
  function reveal() { header.classList.remove('is-hidden'); }
  function keepVisible() {
    return menuOpen || header.querySelector('[aria-expanded="true"]') ||
      (keyboardUser && header.matches(':focus-within')) ||
      (desktopPointer.matches && (pointerNearTop || header.matches(':hover')));
  }
  function conceal() {
    if (window.scrollY > 110 && !keepVisible()) header.classList.add('is-hidden');
  }

  menuButton.addEventListener('click', event => {
    menuOpen = !menuOpen;
    syncMenu();
    reveal();
    if (!menuOpen && event.detail > 0) menuButton.blur();
  });
  nav.addEventListener('click', event => {
    if (event.target.closest('a')) closeMenu();
  });
  document.addEventListener('pointerdown', event => {
    keyboardUser = false;
    if (menuOpen && !header.contains(event.target)) closeMenu();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Tab') { keyboardUser = true; reveal(); }
    if (event.key === 'Escape' && menuOpen) {
      closeMenu();
      menuButton.focus();
    }
  });
  header.addEventListener('focusin', reveal);
  header.addEventListener('focusout', () => {
    // A próxima tecla Tab continua revelando o cabeçalho para usuários de teclado.
    if (scrollingDown) window.setTimeout(conceal, 0);
  });
  header.addEventListener('pointerleave', () => {
    if (scrollingDown && !pointerNearTop) conceal();
  });

  window.addEventListener('scroll', () => {
    const current = Math.max(0, window.scrollY);
    const delta = current - lastScroll;
    if (current < 80) {
      scrollingDown = false;
      reveal();
    } else if (delta > 5) {
      scrollingDown = true;
      conceal();
    } else if (delta < -5) {
      scrollingDown = false;
      reveal();
    }
    lastScroll = current;
  }, { passive: true });

  document.addEventListener('pointermove', event => {
    if (!desktopPointer.matches) return;
    pointerNearTop = event.clientY <= 22;
    if (pointerNearTop) reveal();
    else if (scrollingDown) conceal();
  }, { passive: true });
  window.addEventListener('resize', () => {
    if (window.innerWidth > 1100 && menuOpen) closeMenu();
  });
  new MutationObserver(syncMenu).observe(document.documentElement, {
    attributes: true, attributeFilter: ['lang']
  });
  syncMenu();

  // Every page already loads this header; resolve assets relative to this script,
  // including when the current page is nested under /episodios/.
  const base = document.currentScript && document.currentScript.src || document.baseURI;
  const themeStyles = document.createElement('link');
  themeStyles.rel = 'stylesheet';
  themeStyles.href = new URL('theme.css', base).href;
  document.head.appendChild(themeStyles);
  const themeScript = document.createElement('script');
  themeScript.src = new URL('theme.js', base).href;
  document.head.appendChild(themeScript);

  // One shared module handles all current and future episode pages, plus home/catalog.
  const progressScript = document.createElement('script');
  progressScript.src = new URL('reading-progress.js', base).href;
  document.head.appendChild(progressScript);
}());
