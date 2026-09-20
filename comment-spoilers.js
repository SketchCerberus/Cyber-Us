/* Optional inline spoilers in comments; plain-text storage uses ||spoiler||. */
(() => {
  'use strict';
  const panel = document.querySelector('main.reader-page[data-community-episode] .community-panel');
  if (!panel || panel.dataset.spoilersReady) return;
  panel.dataset.spoilersReady = 'true';

  const base = document.currentScript?.src || document.baseURI;
  const stylesheet = document.createElement('link');
  stylesheet.rel = 'stylesheet';
  stylesheet.href = new URL('comment-spoilers.css', base).href;
  document.head.append(stylesheet);

  const pt = () => document.documentElement.lang.toLowerCase().startsWith('pt');
  const tr = (portuguese, english) => pt() ? portuguese : english;
  const editorHelp = (help, state = '') => {
    help.dataset.state = state;
    help.textContent = state === 'marked'
      ? tr('Trecho marcado. Publique o comentário para ocultá-lo dos leitores.', 'Selection marked. Post your comment to hide it from readers.')
      : state === 'select'
        ? tr('Primeiro, selecione o texto que deseja ocultar.', 'First select the text you want to hide.')
        : state === 'length'
          ? tr('O comentário ultrapassaria o limite de 2.000 caracteres.', 'This would exceed the 2,000-character comment limit.')
          : state === 'nested'
            ? tr('Selecione um trecho sem outra marcação de spoiler.', 'Select text without another spoiler marker.')
            : tr('Selecione um trecho e clique em “Marcar spoiler”. Também é possível escrever ||trecho secreto||.', 'Select some text and click “Mark spoiler”. You can also type ||secret text||.');
  };

  function decorateForm(form) {
    if (form.dataset.spoilersEditorReady) return;
    const textarea = form.querySelector('textarea');
    const submit = form.querySelector('button[type="submit"]');
    if (!textarea || !submit) return;
    form.dataset.spoilersEditorReady = 'true';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'community-action spoiler-mark';
    const help = document.createElement('p');
    help.className = 'community-hint spoiler-editor-help';
    editorHelp(help);
    button.textContent = tr('Marcar spoiler', 'Mark spoiler');
    button.addEventListener('click', () => {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selected = textarea.value.slice(start, end);
      if (!selected.trim()) { editorHelp(help, 'select'); textarea.focus(); return; }
      if (selected.includes('||')) { editorHelp(help, 'nested'); textarea.focus(); return; }
      if (textarea.maxLength > -1 && textarea.value.length + 4 > textarea.maxLength) {
        editorHelp(help, 'length'); textarea.focus(); return;
      }
      textarea.setRangeText(`||${selected}||`, start, end, 'select');
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      textarea.focus();
      textarea.setSelectionRange(start + 2, end + 2);
      editorHelp(help, 'marked');
    });
    textarea.insertAdjacentElement('afterend', help);
    submit.insertAdjacentElement('beforebegin', button);
  }

  let nextId = 0;
  function syncSpoilerButton(button) {
    const secret = button.nextElementSibling;
    const open = secret && !secret.hidden;
    button.textContent = open
      ? tr('Ocultar spoiler', 'Hide spoiler')
      : tr('Spoiler — revelar trecho', 'Spoiler — reveal text');
    button.setAttribute('aria-expanded', String(!!open));
  }
  function renderSpoilers(body) {
    if (body.dataset.spoilersReady) return;
    body.dataset.spoilersReady = 'true';
    const original = body.textContent || '';
    const pattern = /\|\|([^|]|\|(?!\|))+?\|\|/g;
    let cursor = 0;
    let match;
    const content = document.createDocumentFragment();
    while ((match = pattern.exec(original))) {
      const secretText = match[0].slice(2, -2);
      if (!secretText.trim()) continue;
      content.append(document.createTextNode(original.slice(cursor, match.index)));
      const wrapper = document.createElement('span');
      wrapper.className = 'comment-spoiler';
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'spoiler-reveal';
      const secret = document.createElement('span');
      secret.className = 'spoiler-text';
      secret.id = `comment-spoiler-${++nextId}`;
      secret.textContent = secretText;
      secret.hidden = true;
      button.setAttribute('aria-controls', secret.id);
      button.addEventListener('click', () => {
        secret.hidden = !secret.hidden;
        syncSpoilerButton(button);
      });
      wrapper.append(button, secret);
      syncSpoilerButton(button);
      content.append(wrapper);
      cursor = pattern.lastIndex;
    }
    if (!cursor) return;
    content.append(document.createTextNode(original.slice(cursor)));
    // Author content is always text, never HTML; a spoiler starts collapsed.
    body.replaceChildren(content);
  }

  function scan() {
    panel.querySelectorAll('#commentForm, .reply-form').forEach(decorateForm);
    panel.querySelectorAll('.comment-list .comment-body').forEach(renderSpoilers);
  }
  new MutationObserver(scan).observe(panel, { childList: true, subtree: true });
  new MutationObserver(() => {
    panel.querySelectorAll('.spoiler-reveal').forEach(syncSpoilerButton);
    panel.querySelectorAll('.spoiler-mark').forEach(button => {
      button.textContent = tr('Marcar spoiler', 'Mark spoiler');
    });
    panel.querySelectorAll('.spoiler-editor-help').forEach(help => editorHelp(help, help.dataset.state));
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  scan();
})();
