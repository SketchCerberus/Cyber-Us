/* The same reader handles every official episode, switching real PT/EN images. */
(function () {
  const button = document.getElementById('languageBtn');
  const query = new URLSearchParams(window.location.search).get('lang');
  let saved = null;
  try { saved = localStorage.getItem('cyber-us-language'); } catch (_) { /* private mode */ }
  let lang = query === 'pt' || query === 'en' ? query : saved;
  if (lang !== 'pt' && lang !== 'en') lang = 'pt';

  // The trigger displays the ACTIVE language; clicking opens two choices below it.
  function makeLanguagePicker(trigger, getLanguage, setLanguage) {
    if (!trigger) return null;
    const wrapper = document.createElement('span');
    wrapper.className = 'language-picker';
    wrapper.style.cssText = 'position:relative;display:inline-block;flex:0 0 auto';
    trigger.parentNode.insertBefore(wrapper, trigger);
    wrapper.appendChild(trigger);
    trigger.type = 'button';
    trigger.setAttribute('aria-haspopup', 'true');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-controls', 'languageChoices');
    const panel = document.createElement('div');
    panel.id = 'languageChoices';
    panel.setAttribute('role', 'group');
    panel.setAttribute('aria-label', 'Idioma / Language');
    panel.style.cssText = 'position:absolute;right:0;top:calc(100% + 8px);z-index:50;min-width:172px;padding:6px;background:var(--panel,#11151d);border:1px solid var(--line,rgba(255,255,255,.15));border-radius:10px;box-shadow:0 12px 30px rgba(0,0,0,.35)';
    panel.hidden = true;
    panel.style.display = 'none';
    const options = {};
    for (const [code, label] of [['pt', 'Português'], ['en', 'English']]) {
      const choice = document.createElement('button');
      choice.type = 'button';
      choice.className = trigger.className;
      choice.textContent = label;
      choice.style.cssText = 'display:block;width:100%;margin:0;border:0;text-align:left;white-space:nowrap';
      choice.addEventListener('click', () => {
        setLanguage(code);
        close();
        trigger.focus();
      });
      panel.appendChild(choice);
      options[code] = choice;
    }
    wrapper.appendChild(panel);
    function close() {
      panel.hidden = true;
      panel.style.display = 'none';
      trigger.setAttribute('aria-expanded', 'false');
    }
    trigger.addEventListener('click', () => {
      const open = panel.hidden;
      panel.hidden = !open;
      panel.style.display = open ? 'block' : 'none';
      trigger.setAttribute('aria-expanded', String(open));
      if (open) options[getLanguage()].focus();
    });
    document.addEventListener('click', event => { if (!wrapper.contains(event.target)) close(); });
    wrapper.addEventListener('keydown', event => {
      if (event.key === 'Escape') { close(); trigger.focus(); }
    });
    return {
      sync(code) {
        trigger.textContent = code === 'pt' ? 'Português ▾' : 'English ▾';
        trigger.setAttribute('aria-label', code === 'pt' ? 'Idioma atual: português. Escolher idioma' : 'Current language: English. Choose language');
        options.pt.setAttribute('aria-pressed', String(code === 'pt'));
        options.en.setAttribute('aria-pressed', String(code === 'en'));
      }
    };
  }

  const picker = makeLanguagePicker(button, () => lang, code => {
    lang = code;
    // A link with ?lang= must not override a later manual choice on refresh.
    // Keep other query parameters and the current section anchor untouched.
    const url = new URL(window.location.href);
    if (url.searchParams.has('lang')) {
      url.searchParams.set('lang', code);
      window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
    }
    render();
  });
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
    const aboutHero = document.querySelector('.about-us-hero');
    if (aboutHero) {
      aboutHero.querySelector('.eyebrow').textContent = lang === 'pt' ? 'CYBER-US // SOBRE NÓS' : 'CYBER-US // ABOUT';
      aboutHero.querySelector('.about-us-art small:first-child').textContent = lang === 'pt' ? 'CYBER-US / SINAL DO CRIADOR' : 'CYBER-US / CREATOR SIGNAL';
      aboutHero.querySelector('.about-us-art small:last-child').textContent = lang === 'pt' ? 'HISTÓRIA EM ANDAMENTO · · ·' : 'STORY IN PROGRESS · · ·';
    }

    // Extras section labels now use the same data-pt/data-en flow as the rest
    // of the page. Only metadata and accessible names need special handling.
    const extrasPage = document.querySelector('.extras-page');
    if (extrasPage) {
      const english = lang === 'en';
      document.title = english ? 'Cyber-Us — Universe extras' : 'Cyber-Us — Extras do universo';
      const description = document.querySelector('meta[name="description"]');
      if (description) description.content = english
        ? 'Official Cyber-Us extras: concept art, trivia, behind the scenes and spoiler-safe character profiles.'
        : 'Extras oficiais de Cyber-Us: artes conceituais, curiosidades, bastidores e fichas de personagens sem spoilers futuros.';
      const logo = document.querySelector('.site-header .logo');
      if (logo) logo.setAttribute('aria-label', english ? 'Cyber-Us — home' : 'Cyber-Us — início');
      const mainNav = document.querySelector('.site-header nav');
      if (mainNav) mainNav.setAttribute('aria-label', english ? 'Main navigation' : 'Navegação principal');
      const sectionNav = extrasPage.querySelector('.extras-jump-links');
      if (sectionNav) sectionNav.setAttribute('aria-label', english ? 'Extras sections' : 'Seções dos extras');
      const languageChoices = document.getElementById('languageChoices');
      if (languageChoices) languageChoices.setAttribute('aria-label', english ? 'Language' : 'Idioma');
    }

    if (picker) picker.sync(lang);
    try { localStorage.setItem('cyber-us-language', lang); } catch (_) { /* private mode */ }
  }
  render();

  // The Supabase-backed gallery handles the search and cards. The retired editorial
  // showcase has its own search: never inject it alongside the live gallery.
  if (document.querySelector('.fanarts-signal') &&
      !document.querySelector('script[src="fanarts-gallery.js"]')) {
    const showcase = document.createElement('script');
    showcase.src = 'fanarts-showcase.js';
    document.head.appendChild(showcase);
  }

  // Load only the modules relevant to this page after all deferred Supabase scripts.
  // Resolve against reader.js because episode pages are one directory deeper.
  const base=new URL('.',document.currentScript?.src||document.baseURI);
  const modules=[];
  if(document.querySelector('.fanarts-gallery')){
    modules.push('fanarts-featured.js');
    if(document.querySelector('script[src="fanarts-detail.js"]'))modules.push('community-mentions.js');
  }
  if(document.body.dataset.communityPage==='account')
    modules.push('community-notifications.js','community-staff-appeals.js');
  if(document.getElementById('moderationWorkspace')){
    modules.push('moderation-edit-history.js','moderation-featured-fanarts.js','moderation-hierarchy.js');
  }
  if(modules.length){
    const css=document.createElement('link');css.rel='stylesheet';
    css.href=new URL('community-social.css',base).href;document.head.append(css);
    const load=()=>modules.forEach(file=>{
      const script=document.createElement('script');script.src=new URL(file,base).href;
      document.head.append(script);
    });
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load,{once:true});
    else load();
  }
}());
