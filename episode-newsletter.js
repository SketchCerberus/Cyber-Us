/* A compact opt-in invitation below the latest published comic, never inside its artwork. */
(() => {
  'use strict';
  const reader = document.querySelector('main.reader-page[data-community-episode]');
  const navigation = reader?.querySelector('.episode-navigation');
  if (!reader || !navigation || reader.querySelector('.episode-newsletter-cta')) return;

  const scriptUrl = document.currentScript?.src || document.baseURI;
  const catalogUrl = new URL('catalogo.html', scriptUrl);
  const newsletterUrl = new URL('newsletter.html', scriptUrl);
  const dismissKey = 'cyber-us-newsletter-invite-dismissed';
  try {
    if (localStorage.getItem(dismissKey) === '1') return;
  } catch (_) { /* Private browsing may disable storage; invitation still works. */ }

  const pt = () => document.documentElement.lang.toLowerCase().startsWith('pt');
  function translated(tag, className, portuguese, english) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    element.dataset.pt = portuguese;
    element.dataset.en = english;
    element.textContent = pt() ? portuguese : english;
    return element;
  }

  // The reading order is maintained in the public catalog. Only linked episode
  // cards count as published; when a new episode is added, the invitation moves.
  fetch(catalogUrl.href, { cache: 'no-store' })
    .then(response => {
      if (!response.ok) throw new Error('Catalog unavailable');
      return response.text();
    })
    .then(html => {
      const documentFromCatalog = new DOMParser().parseFromString(html, 'text/html');
      const published = [...documentFromCatalog.querySelectorAll('ol.episode-list > li.episode-card a[href]')]
        .filter(link => !link.closest('.pending, [aria-disabled="true"]'));
      const latestLink = published[published.length - 1];
      if (!latestLink) return;
      const latestUrl = new URL(latestLink.getAttribute('href'), catalogUrl);
      if (latestUrl.origin !== location.origin || latestUrl.pathname !== location.pathname) return;
      if (reader.querySelector('.episode-newsletter-cta')) return;

      const styles = document.createElement('link');
      styles.rel = 'stylesheet';
      styles.href = new URL('episode-newsletter.css', scriptUrl).href;
      document.head.append(styles);

      const banner = document.createElement('section');
      banner.className = 'episode-newsletter-cta';
      banner.setAttribute('aria-labelledby', 'episodeNewsletterTitle');
      const heading = translated('h2', '', 'Quer saber quando sair o próximo episódio?', 'Want to know when the next episode arrives?');
      heading.id = 'episodeNewsletterTitle';
      const description = translated('p', '', 'Assine gratuitamente a Transmissão de Cyber-Us. A inscrição é feita pelo Brevo e precisa de confirmação por e-mail.', 'Subscribe to the free Transmissão de Cyber-Us newsletter. Sign-up is handled by Brevo and requires email confirmation.');
      const actions = document.createElement('div');
      actions.className = 'episode-newsletter-actions';
      const subscribe = translated('a', 'action episode-newsletter-link', 'Assinar newsletter →', 'Subscribe to newsletter →');
      const makeLanguageLink = language => {
        const url = new URL(newsletterUrl.href);
        url.searchParams.set('lang', language);
        url.hash = 'newsletter-signup-title';
        return url.href;
      };
      subscribe.dataset.hrefPt = makeLanguageLink('pt');
      subscribe.dataset.hrefEn = makeLanguageLink('en');
      subscribe.href = pt() ? subscribe.dataset.hrefPt : subscribe.dataset.hrefEn;

      // Brevo's embedded form is cross-origin: a static page cannot privately
      // verify who has confirmed. Offer an explicit device-only opt-out instead.
      const dismiss = translated('button', 'episode-newsletter-dismiss', 'Já assino / ocultar convite', 'Already subscribed / hide invitation');
      dismiss.type = 'button';
      dismiss.addEventListener('click', () => {
        try { localStorage.setItem(dismissKey, '1'); } catch (_) { /* Dismiss this page anyway. */ }
        banner.remove();
      });
      actions.append(subscribe, dismiss);
      banner.append(heading, description, actions);
      navigation.insertAdjacentElement('afterend', banner);
    })
    .catch(() => { /* Without a confirmed latest episode, never show on older chapters. */ });
})();
