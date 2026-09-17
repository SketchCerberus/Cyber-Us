/* The same reader handles every official episode, switching real PT/EN images. */
(function () {
  const button = document.getElementById('languageBtn');
  const query = new URLSearchParams(window.location.search).get('lang');
  let saved = null;
  try { saved = localStorage.getItem('cyber-us-language'); } catch (_) { /* private mode */ }
  let lang = query === 'pt' || query === 'en' ? query : saved;
  if (lang !== 'pt' && lang !== 'en') lang = 'pt';
  function render() {
    document.documentElement.lang = lang === 'pt' ? 'pt-BR' : 'en';
    document.querySelectorAll('[data-pt][data-en]').forEach(node => {
      node.textContent = node.getAttribute('data-' + lang);
    });
    document.querySelectorAll('[data-href-pt][data-href-en]').forEach(node => {
      node.href = node.getAttribute('data-href-' + lang);
    });
    document.querySelectorAll('img[data-src-pt][data-src-en]').forEach(image => {
      const src = image.getAttribute('data-src-' + lang);
      image.alt = image.getAttribute('data-alt-' + lang) || '';
      if (image.getAttribute('src') !== src) image.setAttribute('src', src);
    });
    if (button) {
      button.textContent = lang === 'pt' ? 'EN' : 'PT-BR';
      button.setAttribute('aria-label', lang === 'pt' ? 'Switch to English' : 'Mudar para português');
    }
    try { localStorage.setItem('cyber-us-language', lang); } catch (_) { /* private mode */ }
  }
  if (button) button.addEventListener('click', () => { lang = lang === 'pt' ? 'en' : 'pt'; render(); });
  render();
}());
