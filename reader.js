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
    // Only translate the decorative labels when those pages are present; episode images stay untouched.
    const gallerySignal = document.querySelector('.fanarts-signal');
    if (gallerySignal) {
      gallerySignal.querySelector('.fanarts-signal-label').textContent = lang === 'pt' ? 'CYBER-US / COMUNIDADE' : 'CYBER-US / COMMUNITY';
      gallerySignal.querySelector('.fanarts-signal-orbit span:first-child').textContent = lang === 'pt' ? 'ARTE' : 'ART';
      gallerySignal.querySelector('.fanarts-signal-bottom').textContent = lang === 'pt' ? 'SINAL CRIATIVO // 00' : 'CREATIVE SIGNAL // 00';
    }
    const newsletterSignal = document.querySelector('.newsletter-signal');
    if (newsletterSignal) {
      newsletterSignal.querySelector('small').textContent = lang === 'pt' ? 'TRANSMISSÃO PENDENTE' : 'TRANSMISSION PENDING';
    }
    if (button) {
      button.textContent = lang === 'pt' ? 'EN' : 'PT-BR';
      button.setAttribute('aria-label', lang === 'pt' ? 'Switch to English' : 'Mudar para português');
    }
    try { localStorage.setItem('cyber-us-language', lang); } catch (_) { /* private mode */ }
  }
  if (button) button.addEventListener('click', () => { lang = lang === 'pt' ? 'en' : 'pt'; render(); });
  render();
}());
