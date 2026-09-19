/* Reading progress stays in this browser: no account, server or artwork changes. */
(() => {
  'use strict';
  const key = 'cyber-us-reading-progress-v1';
  const root = document.documentElement;
  const scriptUrl = document.currentScript ? document.currentScript.src : document.baseURI;
  const styles = document.createElement('link');
  styles.rel = 'stylesheet';
  styles.href = new URL('reading-progress.css', scriptUrl).href;
  document.head.appendChild(styles);

  function readProgress() {
    try {
      const data = JSON.parse(localStorage.getItem(key));
      if (!data || typeof data.slug !== 'string' || !/^[a-z0-9-]+$/.test(data.slug) ||
          typeof data.fraction !== 'number' || !Number.isFinite(data.fraction) ||
          data.fraction < 0 || data.fraction > 1) return null;
      return {
        slug: data.slug,
        fraction: data.fraction,
        pt: typeof data.pt === 'string' ? data.pt.slice(0, 140) : data.slug,
        en: typeof data.en === 'string' ? data.en.slice(0, 140) : data.slug
      };
    } catch (_) { return null; } // Includes disabled storage and malformed old data.
  }

  const match = location.pathname.match(/\/episodios\/([a-z0-9-]+)\.html$/);
  const reader = document.querySelector('main.reader-page[data-community-episode]');
  const strip = reader && reader.querySelector('.comic-strip');
  const image = strip && strip.querySelector('img[data-src-pt][data-src-en]');
  if (match && reader && image) {
    const slug = match[1];
    const heading = reader.querySelector('.reader-header h1');
    const titles = {
      pt: (heading && (heading.getAttribute('data-pt') || heading.textContent) || slug).trim().slice(0, 140),
      en: (heading && (heading.getAttribute('data-en') || heading.textContent) || slug).trim().slice(0, 140)
    };
    const previous = readProgress();
    let restoring = new URLSearchParams(location.search).get('continue') === '1' &&
      previous && previous.slug === slug;
    let saveTimer = null;

    function metrics() {
      const top = strip.getBoundingClientRect().top + window.scrollY;
      const range = Math.max(1, strip.getBoundingClientRect().height - window.innerHeight * 0.75);
      return { top, range };
    }
    function save() {
      if (restoring) return;
      const { top, range } = metrics();
      const fraction = Math.max(0, Math.min(1, (window.scrollY - top) / range));
      try {
        localStorage.setItem(key, JSON.stringify({ slug, fraction, ...titles, savedAt: Date.now() }));
      } catch (_) { /* Disabled or full storage; reading continues normally. */ }
    }
    function scheduleSave() {
      if (restoring || saveTimer !== null) return;
      saveTimer = window.setTimeout(() => { saveTimer = null; save(); }, 700);
    }
    window.addEventListener('scroll', scheduleSave, { passive: true });
    window.addEventListener('pagehide', () => { window.clearTimeout(saveTimer); saveTimer = null; save(); });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') { window.clearTimeout(saveTimer); saveTimer = null; save(); }
    });
    if (restoring) {
      const restore = () => window.requestAnimationFrame(() => {
        const { top, range } = metrics();
        // Override html's smooth-scroll rule just for this explicit jump.
        const previousBehavior = root.style.scrollBehavior;
        root.style.scrollBehavior = 'auto';
        window.scrollTo(0, Math.round(top + previous.fraction * range));
        root.style.scrollBehavior = previousBehavior;
        restoring = false;
        save();
        const url = new URL(location.href);
        url.searchParams.delete('continue');
        history.replaceState(history.state, '', url.pathname + url.search + url.hash);
      });
      if (image.complete && image.naturalWidth > 0) restore();
      else {
        image.addEventListener('load', restore, { once: true });
        image.addEventListener('error', restore, { once: true });
      }
    }
    return;
  }

  // These two entry points share the same card; future episodes need only the
  // existing reader markup and their own /episodios/<filename>.html route.
  const heroButtons = document.querySelector('main .hero-content .hero-buttons');
  const episodeList = document.querySelector('main.wrap .episode-list');
  const anchor = heroButtons || episodeList;
  if (!anchor) return;
  const section = document.createElement('section');
  section.className = 'reading-resume';
  const label = document.createElement('p');
  label.className = 'reading-resume-eyebrow';
  const title = document.createElement('h3');
  const detail = document.createElement('p');
  detail.className = 'reading-resume-detail';
  const action = document.createElement('a');
  action.className = 'reading-resume-action';
  section.append(label, title, detail, action);
  function render() {
    const progress = readProgress();
    section.hidden = !progress;
    if (!progress) return;
    const pt = root.lang.toLowerCase().startsWith('pt');
    label.textContent = pt ? 'SUA LEITURA' : 'YOUR READING';
    title.textContent = pt ? progress.pt : progress.en;
    detail.textContent = pt
      ? `Última posição salva neste navegador · ${Math.round(progress.fraction * 100)}%`
      : `Last position saved in this browser · ${Math.round(progress.fraction * 100)}%`;
    action.textContent = pt ? 'Continuar lendo →' : 'Continue reading →';
    action.href = `episodios/${progress.slug}.html?continue=1`;
    section.setAttribute('aria-label', pt ? 'Continuar de onde parou' : 'Resume reading');
  }
  if (heroButtons) heroButtons.insertAdjacentElement('afterend', section);
  else episodeList.insertAdjacentElement('beforebegin', section);
  new MutationObserver(render).observe(root, { attributes: true, attributeFilter: ['lang'] });
  window.addEventListener('pageshow', render);
  render();
})();
