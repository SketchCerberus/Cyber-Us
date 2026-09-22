const translations = {
  en: document.querySelectorAll("[data-en]"),
  pt: document.querySelectorAll("[data-pt]")
};

let language = localStorage.getItem("cyber-us-language") || "en";
if (language !== 'pt' && language !== 'en') language = 'en';

// Keep the menu labels bilingual without changing navigation destinations.
for (const [href, pt, en] of [
  ['#comic', 'Quadrinho', 'Comic'],
  ['#about', 'Sobre a HQ', 'About the comic'],
  ['#newsletter', 'Newsletter', 'Newsletter'],
  ['#support', 'Apoie Cyber-Us', 'Fund Cyber-Us']
]) {
  const link = document.querySelector(`.site-header nav a[href="${href}"]`);
  if (link) {
    link.setAttribute('data-pt', pt);
    link.setAttribute('data-en', en);
  }
}

// The trigger displays the ACTIVE language; clicking opens two choices below it.
function makeLanguagePicker(trigger, getLanguage, setLanguage) {
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

const picker = makeLanguagePicker(document.getElementById('languageBtn'), () => language, code => {
  language = code;
  applyLanguage();
});

function applyLanguage() {
  const target = language === "pt" ? "data-pt" : "data-en";
  document.querySelectorAll("[data-en], [data-pt]").forEach(el => {
    const value = el.getAttribute(target);
    if (value) el.textContent = value;
  });

  // Decorative panels also follow the chosen language; keep their existing line breaks.
  const fanartsArt = document.querySelector('.fanarts-teaser-art');
  if (fanartsArt) {
    fanartsArt.querySelector('span:first-child').textContent = language === 'pt' ? 'CYBER / US · COMUNIDADE' : 'CYBER / US · COMMUNITY';
    fanartsArt.querySelector('strong').innerHTML = language === 'pt' ? 'ARTE<br>SEM<br>FRONTEIRAS' : 'ART<br>WITHOUT<br>BORDERS';
    fanartsArt.querySelector('span:last-child').textContent = language === 'pt' ? 'TRANSMISSÃO // PENDENTE' : 'TRANSMISSION // PENDING';
  }
  const newsletterArt = document.querySelector('.newsletter-teaser-art');
  if (newsletterArt) {
    newsletterArt.querySelector('strong').innerHTML = language === 'pt' ? 'SINAL<br>A CAMINHO' : 'INCOMING<br>SIGNAL';
    newsletterArt.querySelector('span:last-child').textContent = language === 'pt' ? 'TRANSMISSÃO PENDENTE · · ·' : 'TRANSMISSION PENDING · · ·';
  }

  document.documentElement.lang = language === "pt" ? "pt-BR" : "en";
  picker.sync(language);
  localStorage.setItem("cyber-us-language", language);
}

document.getElementById("year").textContent = new Date().getFullYear();

/* Keep the homepage layout intact; route its existing Comic / Read buttons to our official reader. */
document.querySelector('.site-header nav a[href="#comic"]')?.setAttribute('href', 'catalogo.html');
document.querySelector('.hero-buttons a[href="#comic"]')?.setAttribute('href', 'catalogo.html');

applyLanguage();

// Homepage only: load the public gallery SDK and the decorative featured-art background.
// If the network is unavailable, leave the original illustrated teaser untouched.
if (document.querySelector('.fanarts-teaser-art')) {
  const startFeaturedBackdrop = () => {
    const script = document.createElement('script');
    script.src = 'fanarts-teaser-carousel.js';
    document.head.append(script);
  };
  if (window.supabase?.createClient) startFeaturedBackdrop();
  else {
    const sdk = document.createElement('script');
    sdk.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/dist/umd/supabase.min.js';
    sdk.onload = startFeaturedBackdrop;
    document.head.append(sdk);
  }
}
