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

  let currentPercent = 0;
  function syncLanguage() {
    const pt = root.lang.toLowerCase().startsWith('pt');
    percentage.textContent = `${currentPercent}%`;
    meter.setAttribute('aria-label', pt ? 'Progresso de leitura do episódio' : 'Episode reading progress');
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
  window.addEventListener('scroll', scheduleUpdate, { passive: true });
  window.addEventListener('resize', scheduleUpdate);
  window.addEventListener('pageshow', scheduleUpdate);
  artwork.addEventListener('load', scheduleUpdate);
  new MutationObserver(syncLanguage).observe(root, { attributes: true, attributeFilter: ['lang'] });
  scheduleUpdate();
})();
