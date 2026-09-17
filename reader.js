/* Independent from the homepage script: both demo pages are safe without Ko-fi DOM elements. */
(function () {
  const button = document.getElementById('languageBtn');
  const query = new URLSearchParams(window.location.search).get('lang');
  let lang = query === 'pt' || query === 'en' ? query : localStorage.getItem('cyber-us-language');
  if (lang !== 'pt' && lang !== 'en') lang = 'pt';
  function render() {
    document.documentElement.lang = lang === 'pt' ? 'pt-BR' : 'en';
    document.querySelectorAll('[data-pt][data-en]').forEach(node => {
      node.textContent = node.getAttribute('data-' + lang);
    });
    document.querySelectorAll('[data-href-pt][data-href-en]').forEach(node => {
      node.href = node.getAttribute('data-href-' + lang);
    });
    if (button) {
      button.textContent = lang === 'pt' ? 'EN' : 'PT-BR';
      button.setAttribute('aria-label', lang === 'pt' ? 'Switch to English' : 'Mudar para português');
    }
    localStorage.setItem('cyber-us-language', lang);
  }
  if (button) button.addEventListener('click', () => { lang = lang === 'pt' ? 'en' : 'pt'; render(); });
  render();
}());
