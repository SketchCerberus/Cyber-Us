/* Language-specific Brevo forms keep newsletter preferences in separate lists. */
(() => {
  'use strict';
  const frame = document.querySelector('[data-newsletter-src-pt]');
  const link = document.querySelector('[data-newsletter-link-pt]');
  if (!frame || !link) return;
  const sync = () => {
    const suffix = document.documentElement.lang.startsWith('pt') ? 'Pt' : 'En';
    const source = frame.dataset['newsletterSrc' + suffix];
    if (frame.getAttribute('src') !== source) frame.setAttribute('src', source);
    link.href = link.dataset['newsletterLink' + suffix];
  };
  new MutationObserver(sync).observe(document.documentElement, {attributes: true, attributeFilter: ['lang']});
  sync();
})();
