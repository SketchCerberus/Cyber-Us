/* Shared, visual reading indicator. No changes to saved progress, accounts or comic images. */
(() => {
  'use strict';
  const reader = document.querySelector('main.reader-page[data-community-episode]');
  const strip = reader && reader.querySelector('.comic-strip');
  const artwork = strip && strip.querySelector('img');
  if (!artwork) return;

  const root = document.documentElement;
  const scriptBase = document.currentScript ? document.currentScript.src : document.baseURI;
  const stylesheet = document.createElement('link');
  stylesheet.rel = 'stylesheet';
  stylesheet.href = new URL('episode-progress.css', scriptBase).href;
  document.head.appendChild(stylesheet);

  // Keep the indicator compact, outside the artwork and below the retractable header.
  const indicator = document.createElement('div');
  indicator.className = 'episode-reading-progress';
  indicator.hidden = true;
  const percentage = document.createElement('span');
  percentage.className = 'episode-reading-percentage';
  const meter = document.createElement('div');
  meter.className = 'episode-reading-meter';
  meter.setAttribute('role', 'progressbar');
  meter.setAttribute('aria-valuemin', '0');
  meter.setAttribute('aria-valuemax', '100');
  meter.setAttribute('aria-valuenow', '0');
  const fill = document.createElement('div');
  fill.className = 'episode-reading-fill';
  meter.append(fill);
  indicator.append(percentage, meter);
  document.body.append(indicator);

  const completion = document.createElement('section');
  completion.className = 'episode-complete';
  completion.hidden = true;
  completion.setAttribute('aria-labelledby', 'episodeCompleteHeading');
  const heading = document.createElement('h2');
  heading.id = 'episodeCompleteHeading';
  const description = document.createElement('p');
  const actions = document.createElement('div');
  actions.className = 'episode-complete-actions';
  const nextItem = reader.querySelector('.episode-navigation')?.lastElementChild;
  // Last episode ends with a disabled span, not a link to the previous episode.
  const nextEpisode = nextItem && nextItem.matches('a[href]') ? nextItem : null;
  const nextAction = document.createElement('a');
  nextAction.className = 'episode-complete-action primary';
  nextAction.href = nextEpisode
    ? nextEpisode.getAttribute('href')
    : (reader.querySelector('.reader-header .back')?.getAttribute('href') || '../catalogo.html');
  actions.append(nextAction);
  completion.append(heading, description, actions);
  strip.insertAdjacentElement('afterend', completion);

  const voteAction = document.createElement('a');
  voteAction.className = 'episode-complete-action secondary';
  const commentAction = document.createElement('a');
  commentAction.className = 'episode-complete-action secondary';
  let currentPercent = 0;
  let communityActionsAdded = false;
  function addCommunityActions() {
    if (communityActionsAdded) return;
    const voteGroup = reader.querySelector('.community-votes');
    const commentHeading = reader.querySelector('#communityHeading');
    if (!voteGroup || !commentHeading) return;
    if (!voteGroup.id) voteGroup.id = 'episodeReadingVotes';
    voteAction.href = `#${voteGroup.id}`;
    commentAction.href = `#${commentHeading.id}`;
    actions.append(voteAction, commentAction);
    communityActionsAdded = true;
    syncLanguage();
  }

  function syncLanguage() {
    const pt = root.lang.toLowerCase().startsWith('pt');
    percentage.textContent = `${currentPercent}%`;
    meter.setAttribute('aria-label', pt ? 'Progresso de leitura do episódio' : 'Episode reading progress');
    heading.textContent = pt ? 'Você chegou ao final!' : 'You reached the end!';
    description.textContent = pt
      ? 'Continue a história ou participe da conversa sobre este episódio.'
      : 'Continue the story or join the discussion about this episode.';
    if (nextEpisode) {
      const title = (nextEpisode.getAttribute(pt ? 'data-pt' : 'data-en') || nextEpisode.textContent).trim();
      nextAction.textContent = `${pt ? 'Próximo episódio: ' : 'Next episode: '}${title}`;
    } else {
      nextAction.textContent = pt ? 'Voltar ao catálogo →' : 'Back to the catalog →';
    }
    voteAction.textContent = pt ? 'Avaliar episódio ↓' : 'Rate episode ↓';
    commentAction.textContent = pt ? 'Ver comentários ↓' : 'View comments ↓';
  }

  function update() {
    const rect = strip.getBoundingClientRect();
    const top = rect.top + window.scrollY;
    // Match the fraction used by the existing "Continue reading" feature.
    const range = Math.max(1, rect.height - window.innerHeight * 0.75);
    const fraction = Math.max(0, Math.min(1, (window.scrollY - top) / range));
    currentPercent = Math.round(fraction * 100);
    indicator.hidden = !(window.scrollY + window.innerHeight > top &&
      window.scrollY < top + rect.height + 160);
    meter.setAttribute('aria-valuenow', String(currentPercent));
    fill.style.width = `${currentPercent}%`;
    completion.hidden = fraction < 0.98;
    syncLanguage();
  }

  let framePending = false;
  function scheduleUpdate() {
    if (framePending) return;
    framePending = true;
    window.requestAnimationFrame(() => {
      framePending = false;
      update();
    });
  }
  addCommunityActions();
  // The episode's community panel is injected by a separate defer script.
  document.addEventListener('DOMContentLoaded', addCommunityActions, { once: true });
  window.addEventListener('scroll', scheduleUpdate, { passive: true });
  window.addEventListener('resize', scheduleUpdate);
  window.addEventListener('pageshow', scheduleUpdate);
  artwork.addEventListener('load', scheduleUpdate);
  new MutationObserver(syncLanguage).observe(root, { attributes: true, attributeFilter: ['lang'] });
  scheduleUpdate();
})();
