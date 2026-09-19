/* Share a clean, language-specific episode link without touching the comic or reader state. */
(() => {
  'use strict';
  const reader = document.querySelector('main.reader-page[data-community-episode]');
  const header = reader && reader.querySelector('.reader-header');
  const heading = header && header.querySelector('h1');
  if (!heading || reader.querySelector('.episode-share')) return;

  const scriptUrl = document.currentScript ? document.currentScript.src : document.baseURI;
  const styles = document.createElement('link');
  styles.rel = 'stylesheet';
  styles.href = new URL('episode-share.css', scriptUrl).href;
  document.head.appendChild(styles);

  const controls = document.createElement('div');
  controls.className = 'episode-share';
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'episode-share-button';
  const status = document.createElement('span');
  status.className = 'episode-share-status';
  status.setAttribute('role', 'status');
  const manualLink = document.createElement('input');
  manualLink.className = 'episode-share-manual';
  manualLink.type = 'text';
  manualLink.readOnly = true;
  manualLink.spellcheck = false;
  manualLink.hidden = true;
  controls.append(button, status, manualLink);

  // Keep sharing beside the vote buttons without placing it inside the
  // reactions group. The community panel is injected by another script.
  function positionBesideVotes() {
    const votes = reader.querySelector('.community-votes');
    if (!votes) {
      // Safe fallback while the community is still loading or unavailable.
      reader.append(controls);
      return;
    }
    let row = votes.closest('.community-vote-share-row');
    if (!row) {
      row = document.createElement('div');
      row.className = 'community-vote-share-row';
      votes.insertAdjacentElement('beforebegin', row);
      row.append(votes);
    }
    row.append(controls);
  }
  positionBesideVotes();
  if (document.readyState !== 'complete') {
    document.addEventListener('DOMContentLoaded', positionBesideVotes, { once: true });
  }

  const nativeShare = typeof navigator.share === 'function';
  const isPortuguese = () => document.documentElement.lang.toLowerCase().startsWith('pt');
  const episodeTitle = () => (heading.getAttribute(isPortuguese() ? 'data-pt' : 'data-en') || heading.textContent).trim();
  function cleanEpisodeUrl() {
    const url = new URL(window.location.href);
    // Never share temporary reading position, tracking, fragments or other query parameters.
    url.search = '';
    url.hash = '';
    url.searchParams.set('lang', isPortuguese() ? 'pt' : 'en');
    return url.href;
  }
  function syncLanguage() {
    const pt = isPortuguese();
    controls.setAttribute('aria-label', pt ? 'Compartilhar este episódio' : 'Share this episode');
    button.textContent = nativeShare ? (pt ? 'Compartilhar episódio ↗' : 'Share episode ↗')
      : (pt ? 'Copiar link do episódio' : 'Copy episode link');
    manualLink.setAttribute('aria-label', pt ? 'Link do episódio para copiar' : 'Episode link to copy');
    if (!manualLink.hidden) manualLink.value = cleanEpisodeUrl();
    if (status.dataset.message === 'copied') {
      status.textContent = pt ? 'Link copiado!' : 'Link copied!';
    } else if (status.dataset.message === 'manual') {
      status.textContent = pt ? 'Selecione e copie o link abaixo.' : 'Select and copy the link below.';
    }
  }

  async function copyLink(url) {
    try {
      if (!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') {
        throw new Error('Clipboard API unavailable');
      }
      await navigator.clipboard.writeText(url);
      status.dataset.message = 'copied';
    } catch (_) {
      manualLink.value = url;
      manualLink.hidden = false;
      manualLink.focus();
      manualLink.select();
      status.dataset.message = 'manual';
    }
    syncLanguage();
  }

  let sharing = false;
  button.addEventListener('click', async () => {
    if (sharing) return;
    sharing = true;
    status.dataset.message = '';
    status.textContent = '';
    manualLink.hidden = true;
    const url = cleanEpisodeUrl();
    try {
      if (nativeShare) {
        try {
          await navigator.share({ title: `Cyber-Us — ${episodeTitle()}`, url });
          return;
        } catch (error) {
          // Closing the native share sheet isn't an error and shouldn't copy unexpectedly.
          if (error && error.name === 'AbortError') return;
        }
      }
      await copyLink(url);
    } finally {
      sharing = false;
    }
  });
  new MutationObserver(syncLanguage).observe(document.documentElement, {
    attributes: true, attributeFilter: ['lang']
  });
  syncLanguage();
})();
