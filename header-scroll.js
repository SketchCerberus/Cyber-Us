/* Navegação retrátil e padronizada para todas as páginas do site.
   Não modifica a autenticação nem as imagens dos episódios. */
(function () {
  'use strict';
  const header = document.querySelector('body > .site-header');
  if (!header || header.dataset.scrollHeaderReady) return;
  const nav = header.querySelector('nav');
  if (!nav) return;
  // Resolve os destinos pela localização deste arquivo, inclusive dentro de /episodios/.
  const base = document.currentScript && document.currentScript.src || document.baseURI;
  const logo = header.querySelector('.logo');
  const account = nav.querySelector('.account-access') || document.createElement('a');
  const languageControl = nav.querySelector('.language-picker') || nav.querySelector('#languageBtn');
  const currentPath = location.pathname;
  const standardLinks = [
    ['index.html','Início','Home'],
    ['catalogo.html','Episódios','Episodes'],
    ['about-us.html','Sobre nós','About us'],
    ['fanarts.html','Fanarts','Fanarts'],
    ['newsletter.html','Newsletter','Newsletter'],
    ['extras.html','Extras','Extras']
  ];
  let activeFile = currentPath.split('/').pop() || 'index.html';
  if (currentPath.includes('/episodios/')) activeFile = 'catalogo.html';
  if (activeFile === 'fanarts-regras.html') activeFile = 'fanarts.html';
  if (['cadastro.html','recuperar-senha.html','moderacao.html'].includes(activeFile)) activeFile = 'comunidade.html';
  const links = standardLinks.map(([file,pt,en]) => {
    const link = document.createElement('a');
    link.href = new URL(file,base).href;
    link.dataset.pt = pt;
    link.dataset.en = en;
    link.textContent = document.documentElement.lang.startsWith('pt') ? pt : en;
    if (file === activeFile) link.setAttribute('aria-current','page');
    return link;
  });
  account.classList.add('account-access');
  if (!account.href) account.href = new URL('comunidade.html',base).href;
  if (!account.dataset.pt) account.dataset.pt = 'Entrar / Cadastre-se';
  if (!account.dataset.en) account.dataset.en = 'Sign in / Sign up';
  if (activeFile === 'comunidade.html') account.setAttribute('aria-current','page');
  else account.removeAttribute('aria-current');
  nav.replaceChildren(...links,account,...(languageControl?[languageControl]:[]));
  header.dataset.scrollHeaderReady = 'true';
  header.classList.add('scroll-header');

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
    nav.setAttribute('aria-label',pt?'Navegação principal':'Main navigation');
    if (logo) logo.setAttribute('aria-label',pt?'Cyber-Us — início':'Cyber-Us — home');
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

  // Update the guest account entry to a verified public name/avatar after login.
  const accountScript = document.createElement('script');
  accountScript.src = new URL('header-account.js', base).href;
  document.head.appendChild(accountScript);

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

  // Reader-only visual progress and sharing, without duplicating episode HTML.
  if (document.querySelector('main.reader-page[data-community-episode] .comic-strip')) {
    const episodeProgressScript = document.createElement('script');
    episodeProgressScript.src = new URL('episode-progress.js', base).href;
    document.head.appendChild(episodeProgressScript);
    const shareScript = document.createElement('script');
    shareScript.src = new URL('episode-share.js', base).href;
    document.head.appendChild(shareScript);
  }
}());
