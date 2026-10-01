/* Keep accessible names, page titles and sharing links in the selected language. */
(() => {
  'use strict';
  const sync = () => {
    const lang = document.documentElement.lang.startsWith('pt') ? 'pt' : 'en';
    const title = document.querySelector('title[data-title-pt]');
    if (title) document.title = title.dataset['title' + (lang === 'pt' ? 'Pt' : 'En')];
    document.querySelectorAll('[data-description-pt]').forEach(node => {
      node.content = node.dataset[lang === 'pt' ? 'descriptionPt' : 'descriptionEn'];
    });
    document.querySelectorAll('[data-label-pt]').forEach(node => {
      node.setAttribute('aria-label', node.dataset[lang === 'pt' ? 'labelPt' : 'labelEn']);
    });
    document.querySelectorAll('[data-frame-title-pt]').forEach(node => {
      node.title = node.dataset[lang === 'pt' ? 'frameTitlePt' : 'frameTitleEn'];
    });
    document.querySelectorAll('meta[property="og:title"],meta[name="twitter:title"]').forEach(node => {node.content = document.title;});
    const locale = document.querySelector('meta[property="og:locale"]');
    if (locale) locale.content = lang === 'pt' ? 'pt_BR' : 'en_US';
    document.querySelectorAll('[data-platform-pt]').forEach(link => {
      link.href = link.dataset[lang === 'pt' ? 'platformPt' : 'platformEn'];
    });
    document.querySelectorAll('.comic-strip').forEach(node => node.setAttribute('aria-label', lang === 'pt' ? 'Página do quadrinho' : 'Comic page'));
    document.querySelectorAll('.episode-navigation').forEach(node => node.setAttribute('aria-label', lang === 'pt' ? 'Navegação entre episódios' : 'Episode navigation'));
    document.querySelectorAll('.community-votes').forEach(node => node.setAttribute('aria-label', lang === 'pt' ? 'Reações ao episódio' : 'Episode reactions'));
  };
  new MutationObserver(sync).observe(document.documentElement, {attributes: true, attributeFilter: ['lang']});
  sync();
})();
