/* Vitrine editorial: inclua SOMENTE obras aprovadas e autorizadas para exibição.
   Nenhum envio é aceito por este arquivo. As imagens devem estar em assets/fanarts/.
   Exemplo (NÃO é uma obra real; deixe comentado até obter autorização):
   { image: 'assets/fanarts/arquivo.webp', artist: 'Nome autorizado',
     region: 'Região autorizada', showRegion: true, accent: 'blue', approved: true }
   accent: 'blue', 'red', 'green' ou 'random'; região só aparece com showRegion: true.
*/
(function () {
  'use strict';

  const approvedFanarts = [
    // Adicionar apenas após aprovação da obra e consentimento específico do artista.
  ];
  const signal = document.querySelector('.fanarts-signal');
  if (!signal) return;

  // Este campo é só uma prévia desativada. O sistema de envios NÃO está aberto.
  const fileLabel = document.querySelector('.fanarts-form-preview label[for="fanarts-image"]');
  if (fileLabel) {
    const label = document.createElement('label');
    label.htmlFor = 'fanarts-accent';
    label.dataset.pt = 'Cor de destaque (opcional)';
    label.dataset.en = 'Accent color (optional)';
    const select = document.createElement('select');
    select.id = 'fanarts-accent';
    select.disabled = true;
    for (const [value, pt, en] of [
      ['random', 'Surpreenda-me / Aleatório', 'Surprise me / Random'],
      ['blue', 'Azul neon', 'Neon blue'],
      ['red', 'Vermelho neon', 'Neon red'],
      ['green', 'Verde neon', 'Neon green']
    ]) {
      const option = document.createElement('option');
      option.value = value;
      option.dataset.pt = pt;
      option.dataset.en = en;
      option.textContent = document.documentElement.lang === 'en' ? en : pt;
      select.appendChild(option);
    }
    label.textContent = document.documentElement.lang === 'en' ? label.dataset.en : label.dataset.pt;
    fileLabel.before(label, select);
  }

  // Não apresentar o exemplo ilustrativo como fanart publicada.
  const validImage = /^assets\/fanarts\/[a-zA-Z0-9_/-]+\.(?:png|jpe?g|webp)$/i;
  const works = approvedFanarts.filter(work =>
    work && work.approved === true && typeof work.image === 'string' &&
    validImage.test(work.image) && !work.image.includes('..') &&
    typeof work.artist === 'string' && work.artist.trim().length > 0 &&
    work.artist.length <= 60 &&
    ['blue', 'red', 'green', 'random'].includes(work.accent)
  ).map(work => ({
    image: work.image,
    artist: work.artist.trim(),
    region: work.showRegion === true && typeof work.region === 'string' ? work.region.trim().slice(0, 80) : '',
    accent: work.accent === 'random' ? ['blue', 'red', 'green'][Math.floor(Math.random() * 3)] : work.accent
  }));
  if (!works.length) return; // Moldura original intacta até existir arte aprovada.

  const style = document.createElement('link');
  style.rel = 'stylesheet';
  style.href = 'fanarts-showcase.css';
  document.head.appendChild(style);

  const originalOrbit = signal.querySelector('.fanarts-signal-orbit');
  const originalBottom = signal.querySelector('.fanarts-signal-bottom');
  const stage = document.createElement('div');
  stage.className = 'fanarts-showcase';
  stage.setAttribute('role', 'region');
  stage.setAttribute('aria-label', 'Vitrine de fanarts / Fanart showcase');
  stage.setAttribute('aria-live', 'off'); // Trocas automáticas não interrompem leitores de tela.

  const cards = {};
  for (const slot of ['previous', 'next', 'current']) {
    const figure = document.createElement('figure');
    figure.className = `fanarts-showcase-card fanarts-showcase-${slot}`;
    if (slot !== 'current') figure.setAttribute('aria-hidden', 'true');
    const image = document.createElement('img');
    image.decoding = 'async';
    image.alt = '';
    image.addEventListener('error', () => {
      // Uma referência inválida nunca deve deixar uma imagem quebrada visível.
      clearTimeout(timer);
      clearTimeout(transitionTimer);
      stage.remove();
      originalOrbit.hidden = false;
      originalBottom.hidden = false;
      signal.classList.remove('has-showcase');
      signal.setAttribute('aria-hidden', 'true');
    });
    figure.appendChild(image);
    if (slot === 'current') {
      const caption = document.createElement('figcaption');
      const artist = document.createElement('strong');
      artist.className = 'fanarts-showcase-artist';
      const region = document.createElement('span');
      region.className = 'fanarts-showcase-region';
      caption.append(artist, region);
      figure.appendChild(caption);
      cards[slot] = { figure, image, artist, region };
    } else cards[slot] = { figure, image };
    stage.appendChild(figure);
  }

  // Uma função de embaralhamento por ciclo; nenhuma obra se repete imediatamente.
  function shuffle() {
    const result = works.map((_, index) => index);
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
  let order = shuffle();
  let position = 0;
  let timer;
  let transitionTimer;
  let manuallyPaused = false;
  let hovered = false;
  let focused = false;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  const pause = document.createElement('button');
  pause.className = 'fanarts-showcase-pause';
  pause.type = 'button';
  pause.setAttribute('aria-pressed', 'false');
  function syncPauseText() {
    const pt = document.documentElement.lang !== 'en';
    pause.textContent = manuallyPaused ? (pt ? 'Continuar' : 'Resume') : (pt ? 'Pausar' : 'Pause');
    pause.setAttribute('aria-label', manuallyPaused ? (pt ? 'Continuar a vitrine de fanarts' : 'Resume fanart showcase') : (pt ? 'Pausar a vitrine de fanarts' : 'Pause fanart showcase'));
    const current = cards.current;
    current.image.alt = pt ? `Fanart de ${current.artist.textContent}` : `Fanart by ${current.artist.textContent}`;
  }
  pause.addEventListener('click', () => {
    manuallyPaused = !manuallyPaused;
    pause.setAttribute('aria-pressed', String(manuallyPaused));
    syncPauseText();
    schedule();
  });

  function display(slot, work) {
    const card = cards[slot];
    card.figure.hidden = !work;
    if (!work) return;
    card.figure.dataset.accent = work.accent;
    if (card.image.getAttribute('src') !== work.image) card.image.src = work.image;
    if (slot === 'current') {
      card.artist.textContent = work.artist;
      card.region.textContent = work.region;
      card.region.hidden = !work.region;
    }
  }
  function render() {
    display('current', works[order[position]]);
    display('previous', works.length > 2 ? works[order[(position - 1 + works.length) % works.length]] : null);
    display('next', works.length > 1 ? works[order[(position + 1) % works.length]] : null);
    syncPauseText();
  }
  function blocked() {
    return manuallyPaused || hovered || focused || document.hidden || reducedMotion.matches || works.length < 2;
  }
  function schedule() {
    clearTimeout(timer);
    if (!blocked()) timer = setTimeout(advance, 8000);
  }
  function advance() {
    if (blocked()) return;
    stage.classList.add('is-changing');
    transitionTimer = setTimeout(() => {
      const previous = order[position];
      position++;
      if (position >= works.length) {
        order = shuffle();
        if (works.length > 1 && order[0] === previous) {
          const swap = order[0];
          order[0] = order[1];
          order[1] = swap;
        }
        position = 0;
      }
      render();
      stage.classList.remove('is-changing');
      schedule();
    }, 240);
  }
  stage.addEventListener('mouseenter', () => { hovered = true; schedule(); });
  stage.addEventListener('mouseleave', () => { hovered = false; schedule(); });
  stage.addEventListener('focusin', () => { focused = true; schedule(); });
  stage.addEventListener('focusout', event => {
    if (!stage.contains(event.relatedTarget)) { focused = false; schedule(); }
  });
  document.addEventListener('visibilitychange', schedule);
  if (reducedMotion.addEventListener) reducedMotion.addEventListener('change', schedule);
  new MutationObserver(syncPauseText).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });

  render();
  if (works.length > 1) stage.appendChild(pause);
  originalOrbit.hidden = true;
  originalBottom.hidden = true;
  signal.removeAttribute('aria-hidden');
  signal.classList.add('has-showcase');
  originalOrbit.after(stage);
  schedule();
}());
