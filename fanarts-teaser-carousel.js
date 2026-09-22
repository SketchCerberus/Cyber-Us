/* Decorative homepage teaser: approved, manually featured, spoiler-free art only. */
(() => {
  'use strict';
  const panel = document.querySelector('.fanarts-teaser-art');
  if (!panel || !window.supabase?.createClient) return;

  const db = window.supabase.createClient('https://znenamrszhjsiztllcit.supabase.co',
    'sb_publishable_3VRFxwtDuYq4ETHs4xof8g_Fp3GRl6c',
    { auth: { flowType: 'pkce', detectSessionInUrl: false, persistSession: true, autoRefreshToken: true } });
  const validPath = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.(?:jpg|png|webp)$/i;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let timer = null;

  function isSafePublicUrl(value) {
    if (typeof value !== 'string') return false;
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && url.origin === 'https://znenamrszhjsiztllcit.supabase.co' &&
        url.pathname.startsWith('/storage/v1/object/public/fanart-public/');
    } catch (_) { return false; }
  }

  function preload(url) {
    return new Promise(resolve => {
      const image = new Image();
      image.onload = () => resolve(url);
      image.onerror = () => resolve(null);
      image.src = url;
    });
  }

  async function load() {
    try {
      // fanart_gallery is the approved-only public view; editorial picks are never inferred from votes.
      const { data, error } = await db.from('fanart_gallery')
        .select('image_path,tags,featured').eq('featured', true)
        .order('featured_at', { ascending: false }).limit(6);
      if (error) return;

      const eligible = (data || []).filter(work => work.featured === true &&
        validPath.test(work.image_path || '') && Array.isArray(work.tags) &&
        !work.tags.some(tag => typeof tag === 'string' && tag.trim().toLowerCase() === 'spoiler'));
      if (!eligible.length) return;
      const urls = eligible.map(work => db.storage.from('fanart-public').getPublicUrl(work.image_path)?.data?.publicUrl)
        .filter(isSafePublicUrl);
      const loaded = (await Promise.all(urls.map(preload))).filter(Boolean);
      if (!loaded.length) return; // No eligible or loadable image: keep the existing illustrated panel.

      const stylesheet = document.createElement('link');
      stylesheet.rel = 'stylesheet';
      stylesheet.href = new URL('fanarts-teaser-carousel.css', document.currentScript?.src || document.baseURI).href;
      document.head.append(stylesheet);

      const backdrop = document.createElement('div');
      backdrop.className = 'fanarts-teaser-slides';
      backdrop.setAttribute('aria-hidden', 'true');
      const slides = loaded.map((url, index) => {
        const slide = document.createElement('div');
        slide.className = 'fanarts-teaser-slide';
        slide.style.backgroundImage = `url("${url}")`;
        if (index === 0) slide.classList.add('is-active');
        backdrop.append(slide);
        return slide;
      });
      // Keep the first and last spans in place: script.js uses them for PT/EN labels.
      panel.insertBefore(backdrop, panel.querySelector('strong'));
      panel.classList.add('has-featured-backdrop');
      let current = 0;
      const schedule = () => {
        window.clearTimeout(timer);
        timer = null;
        if (slides.length < 2 || reducedMotion.matches || document.hidden) return;
        timer = window.setTimeout(() => {
          slides[current].classList.remove('is-active');
          current = (current + 1) % slides.length;
          slides[current].classList.add('is-active');
          schedule();
        }, 8000);
      };
      document.addEventListener('visibilitychange', schedule);
      reducedMotion.addEventListener?.('change', schedule);
      window.addEventListener('pagehide', () => window.clearTimeout(timer), { once: true });
      schedule();
    } catch (_) {
      // A temporary network or Storage failure must not replace the original teaser.
    }
  }
  load();
})();
