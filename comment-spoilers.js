/* Whole-comment spoilers: the author opts in; storage remains plain text. */
(() => {
  'use strict';
  const panel = document.querySelector('main.reader-page[data-community-episode] .community-panel');
  if (!panel || panel.dataset.spoilersReady) return;
  panel.dataset.spoilersReady = 'true';

  // Distinctive plain-text prefix avoids a database migration. Never render it to readers.
  const SPOILER_PREFIX = '[CYBER-US-SPOILER]\n';
  const base = document.currentScript?.src || document.baseURI;
  const stylesheet = document.createElement('link');
  stylesheet.rel = 'stylesheet';
  stylesheet.href = new URL('comment-spoilers.css', base).href;
  document.head.append(stylesheet);

  const pt = () => document.documentElement.lang.toLowerCase().startsWith('pt');
  const tr = (portuguese, english) => pt() ? portuguese : english;
  const optionText = () => tr('Este comentário contém spoilers', 'This comment contains spoilers');
  const lengthError = () => tr('Reduza o texto: a marcação de spoiler também conta no limite de 2.000 caracteres.', 'Shorten the text: the spoiler marker also counts toward the 2,000-character limit.');
  const editors = new WeakMap();

  function decorateForm(form) {
    if (form.dataset.spoilersEditorReady) return;
    const textarea = form.querySelector('textarea');
    const submit = form.querySelector('button[type="submit"]');
    if (!textarea || !submit) return;
    form.dataset.spoilersEditorReady = 'true';

    const option = document.createElement('label');
    option.className = 'spoiler-option';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'spoiler-checkbox';
    const label = document.createElement('span');
    label.className = 'spoiler-option-label';
    label.textContent = optionText();
    option.append(checkbox, label);
    const help = document.createElement('p');
    help.className = 'community-hint spoiler-editor-help';
    help.setAttribute('role', 'alert');
    help.hidden = true;
    submit.insertAdjacentElement('beforebegin', option);
    option.insertAdjacentElement('afterend', help);
    editors.set(form, { textarea, checkbox, help });

    const clearError = () => { help.hidden = true; help.textContent = ''; };
    checkbox.addEventListener('change', clearError);
    textarea.addEventListener('input', clearError);
  }

  // A form's capture listener does NOT run before an older listener on that same
  // target. Capture the submit on its ancestor instead, before community.js can
  // read the textarea, regardless of script load / listener registration order.
  panel.addEventListener('submit', event => {
    const editor = editors.get(event.target);
    if (!editor || !editor.checkbox.checked) return;
    const { textarea, help } = editor;
    const original = textarea.value;
    const body = original.trim();
    if (!body) return; // Let the existing empty-comment validation run normally.
    const limit = textarea.maxLength > 0 ? textarea.maxLength : 2000;
    if (body.length + SPOILER_PREFIX.length > limit) {
      event.preventDefault();
      event.stopImmediatePropagation();
      help.hidden = false;
      help.textContent = lengthError();
      textarea.focus();
      return;
    }
    const encoded = SPOILER_PREFIX + body;
    textarea.value = encoded;
    queueMicrotask(() => {
      if (textarea.value === encoded) textarea.value = original;
    });
  }, true);

  let nextId = 0;
  function syncReveal(button, content) {
    button.textContent = content.hidden
      ? tr('Comentário com spoiler — revelar', 'Spoiler comment — reveal')
      : tr('Ocultar comentário com spoiler', 'Hide spoiler comment');
    button.setAttribute('aria-expanded', String(!content.hidden));
  }

  function renderSpoiler(body) {
    if (body.dataset.spoilersReady) return;
    body.dataset.spoilersReady = 'true';
    const raw = body.textContent || '';
    if (!raw.startsWith(SPOILER_PREFIX)) return;
    const comment = raw.slice(SPOILER_PREFIX.length);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'spoiler-reveal';
    const content = document.createElement('span');
    content.className = 'spoiler-text';
    content.id = `comment-spoiler-${++nextId}`;
    content.hidden = true;
    content.textContent = comment; // User text is never interpreted as HTML.
    button.setAttribute('aria-controls', content.id);
    button.addEventListener('click', () => {
      content.hidden = !content.hidden;
      syncReveal(button, content);
    });
    syncReveal(button, content);
    body.replaceChildren(button, content);
  }

  function scan() {
    panel.querySelectorAll('#commentForm, .reply-form').forEach(decorateForm);
    panel.querySelectorAll('.comment-list .comment-body').forEach(renderSpoiler);
  }
  new MutationObserver(scan).observe(panel, { childList: true, subtree: true });
  new MutationObserver(() => {
    panel.querySelectorAll('.spoiler-option-label').forEach(label => { label.textContent = optionText(); });
    panel.querySelectorAll('.spoiler-editor-help:not([hidden])').forEach(help => { help.textContent = lengthError(); });
    panel.querySelectorAll('.spoiler-reveal').forEach(button => syncReveal(button, button.nextElementSibling));
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  scan();
})();
