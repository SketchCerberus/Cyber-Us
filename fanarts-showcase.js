/* Overview carousel: only approved public gallery rows, never pending submissions. */
(() => {
  'use strict';
  const signal = document.querySelector('.fanarts-signal');
  if (!signal || signal.dataset.carouselReady === 'true' || !window.supabase?.createClient) return;
  signal.dataset.carouselReady = 'true';
  const db = window.supabase.createClient('https://znenamrszhjsiztllcit.supabase.co',
    'sb_publishable_3VRFxwtDuYq4ETHs4xof8g_Fp3GRl6c',
    { auth: { flowType: 'pkce', detectSessionInUrl: false, persistSession: true, autoRefreshToken: true } });
  const pt = () => document.documentElement.lang.toLowerCase().startsWith('pt');
  const t = (br, en) => pt() ? br : en;
  const validId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const validPath = /^[0-9a-f-]{36}\.(?:jpg|png|webp)$/i;
  const make = (tag, className) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    return element;
  };

  async function load() {
    const result = await db.from('fanart_gallery')
      .select('submission_id,title,artist_name,image_path,accent,tags')
      .order('published_at', { ascending: false }).limit(100);
    // Keep the existing illustration in place when there are no approved works or the service is down.
    if (result.error) return;
    const works = (result.data || []).filter(work =>
      validId.test(work.submission_id || '') && validPath.test(work.image_path || '') &&
      typeof work.title === 'string' && typeof work.artist_name === 'string'
    ).map(work => ({...work, spoiler: Array.isArray(work.tags) && work.tags.includes('Spoiler')}));
    if (!works.length) return;

    const originalOrbit = signal.querySelector('.fanarts-signal-orbit');
    const originalBottom = signal.querySelector('.fanarts-signal-bottom');
    if (!originalOrbit || !originalBottom) return;
    const stage = make('div', 'fanarts-showcase');
    stage.id = 'fanarts-carousel';
    stage.setAttribute('role', 'region');
    stage.setAttribute('aria-label', t('Carrossel de fanarts aprovadas', 'Approved fanart carousel'));
    stage.setAttribute('aria-live', 'off');
    const slots = {};
    for (const slot of ['previous', 'current', 'next']) {
      const figure = make('figure', `fanarts-showcase-card fanarts-showcase-${slot}`);
      if (slot !== 'current') figure.setAttribute('aria-hidden', 'true');
      const image = make('img');
      image.decoding = 'async';
      image.hidden = true;
      const placeholder = slot === 'current' ? make('button', 'fanarts-carousel-reveal') : make('span', 'fanarts-carousel-placeholder');
      if (slot === 'current') {
        placeholder.type = 'button';
        placeholder.addEventListener('click', () => {
          const work = works[order[position]];
          if (!work || !work.spoiler) return;
          revealed.add(work.submission_id);
          render();
          controls.querySelector('.fanarts-carousel-next')?.focus({ preventScroll: true });
        });
      }
      placeholder.hidden = true;
      figure.append(image, placeholder);
      let caption = null;
      if (slot === 'current') {
        caption = make('figcaption');
        const title = make('strong', 'fanarts-showcase-artist');
        const artist = make('span', 'fanarts-showcase-region');
        const link = make('a', 'fanarts-carousel-open');
        caption.append(title, artist, link);
        figure.append(caption);
        slots[slot] = { figure, image, placeholder, caption, title, artist, link };
      } else slots[slot] = { figure, image, placeholder };
      stage.append(figure);
    }

    const controls = make('div', 'fanarts-carousel-controls');
    const previous = make('button', 'fanarts-carousel-previous');
    const next = make('button', 'fanarts-carousel-next');
    const pause = make('button', 'fanarts-carousel-pause');
    for (const button of [previous, next, pause]) {
      button.type = 'button';
      button.setAttribute('aria-controls', stage.id);
    }
    const progress = make('span', 'fanarts-carousel-progress');
    progress.setAttribute('aria-live', 'off');
    controls.append(previous, progress, next, pause);
    const stylesheet = document.createElement('link');
    stylesheet.rel = 'stylesheet';
    stylesheet.href = new URL('fanarts-carousel.css', document.currentScript?.src || document.baseURI).href;
    document.head.append(stylesheet);

    // Reveal is per artwork, only after the visitor clicks; captions and image URLs stay absent before that.
    const revealed = new Set();
    const order = works.map((_, index) => index);
    for (let index = order.length - 1; index > 0; index--) {
      const random = Math.floor(Math.random() * (index + 1));
      [order[index], order[random]] = [order[random], order[index]];
    }
    let position = 0;
    let timer = null;
    let paused = false;
    let hovered = false;
    let focused = false;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const isBlocked = () => paused || hovered || focused || document.hidden || reducedMotion.matches || works.length < 2;
    function schedule() {
      window.clearTimeout(timer);
      timer = null;
      if (!isBlocked()) timer = window.setTimeout(() => go(1), 8000);
    }
    function show(slotName, work) {
      const slot = slots[slotName];
      slot.figure.hidden = !work;
      if (!work) return;
      slot.figure.dataset.accent = ['red', 'blue', 'green'].includes(work.accent) ? work.accent : 'blue';
      const locked = work.spoiler && !revealed.has(work.submission_id);
      slot.placeholder.hidden = !locked;
      slot.image.hidden = locked;
      if (locked) {
        slot.image.removeAttribute('src');
        slot.image.alt = t('Imagem com spoiler oculto', 'Spoiler image hidden');
        slot.placeholder.textContent = slotName === 'current'
          ? t('Spoiler · Revelar imagem', 'Spoiler · Reveal artwork')
          : t('Imagem com spoiler', 'Spoiler artwork');
      } else {
        const url = db.storage.from('fanart-public').getPublicUrl(work.image_path).data.publicUrl;
        if (slot.image.getAttribute('src') !== url) slot.image.src = url;
        slot.image.alt = t(`Fanart “${work.title}”, de ${work.artist_name}`, `Fanart “${work.title}” by ${work.artist_name}`);
      }
      if (slotName === 'current') {
        slot.caption.hidden = locked;
        slot.title.textContent = locked ? '' : work.title;
        slot.artist.textContent = locked ? '' : t(`Por ${work.artist_name}`, `By ${work.artist_name}`);
        slot.link.textContent = locked ? '' : t('Ver obra →', 'View artwork →');
        slot.link.href = locked ? '#' : `fanarts-galeria.html?art=${encodeURIComponent(work.submission_id)}#artwork`;
      }
    }
    function render() {
      const length = works.length;
      show('current', works[order[position]]);
      show('previous', length > 2 ? works[order[(position - 1 + length) % length]] : null);
      show('next', length > 1 ? works[order[(position + 1) % length]] : null);
      progress.textContent = `${position + 1} / ${length}`;
      previous.textContent = t('← Anterior', '← Previous');
      next.textContent = t('Próxima →', 'Next →');
      pause.textContent = paused ? t('Continuar', 'Resume') : t('Pausar', 'Pause');
      pause.setAttribute('aria-pressed', String(paused));
      stage.setAttribute('aria-label', t('Carrossel de fanarts aprovadas', 'Approved fanart carousel'));
      controls.hidden = length < 2;
    }
    function go(delta) {
      if (works.length < 2) return;
      position = (position + delta + works.length) % works.length;
      render();
      schedule();
    }
    previous.addEventListener('click', () => go(-1));
    next.addEventListener('click', () => go(1));
    pause.addEventListener('click', () => { paused = !paused; render(); schedule(); });
    stage.addEventListener('mouseenter', () => { hovered = true; schedule(); });
    stage.addEventListener('mouseleave', () => { hovered = false; schedule(); });
    controls.addEventListener('mouseenter', () => { hovered = true; schedule(); });
    controls.addEventListener('mouseleave', () => { hovered = false; schedule(); });
    signal.addEventListener('focusin', () => { focused = true; schedule(); });
    signal.addEventListener('focusout', event => {
      if (!signal.contains(event.relatedTarget)) { focused = false; schedule(); }
    });
    document.addEventListener('visibilitychange', schedule);
    reducedMotion.addEventListener?.('change', schedule);
    new MutationObserver(render).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
    render();
    originalOrbit.hidden = true;
    originalBottom.hidden = true;
    signal.removeAttribute('aria-hidden');
    signal.classList.add('has-showcase');
    originalOrbit.after(stage, controls);
    schedule();
  }
  load();
})();
