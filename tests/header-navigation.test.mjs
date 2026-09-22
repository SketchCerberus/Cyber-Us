import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = path => readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('shared header defines one canonical bilingual navigation',()=>{
  const script=read('header-scroll.js');
  for (const page of ['index.html','catalogo.html','about-us.html','fanarts.html','newsletter.html','extras.html']) {
    assert.match(script,new RegExp(page.replace('.','\\.')));
  }
  assert.match(script,/nav\.replaceChildren\(\.\.\.links,account/);
  assert.match(script,/aria-current','page'/);
});

test('mobile menu presents existing account, notifications, theme and language before links',()=>{
  const script=read('header-mobile-utilities.js');
  const style=read('header-mobile-utilities.css');
  const theme=read('theme.js');
  assert.match(theme,/new URL\('header-mobile-utilities\.js'/);
  assert.match(script,/matchMedia\('\(max-width:1100px\)'\)/);
  assert.match(script,/nav\.prepend\(tray\)/);
  assert.match(script,/\[account, shell, theme, language\]/);
  assert.match(script,/tray\.append\(\.\.\.controls\)/);
  assert.match(script,/nav\.append\(\.\.\.\[account, shell, theme, language\]/);
  assert.match(script,/new MutationObserver\(sync\)\.observe\(nav/);
  assert.match(script,/attributeFilter:\['aria-expanded'\]/);
  assert.match(style,/\.mobile-nav-utilities/);
  assert.match(style,/grid-template-columns:44px/);
  assert.match(style,/has-open-notifications/);
  assert.match(style,/\.header-notifications-panel/);
  assert.match(style,/html\[data-theme='light'\]/);
});

test('mobile utility tray retains one account, inbox and language picker with original listeners',()=>{
  const script=read('header-mobile-utilities.js');
  const account=read('header-account.js');
  const inbox=read('header-notifications.js');
  const theme=read('theme.js');
  assert.doesNotMatch(script,/cloneNode|innerHTML|createClient|\.replaceWith\(/);
  assert.match(script,/tray\.remove\(\)/);
  assert.match(account,/const link = document\.querySelector\('body > \.site-header nav \.account-access'\)/);
  assert.match(inbox,/account\.after\(shell\)/);
  assert.match(theme,/nav\.insertBefore\(toggle, languageControl \|\| null\)/);
  assert.match(script,/document\.documentElement\.lang/);
  assert.match(script,/aria-label/);
});

test('every site page loads the shared header behavior',()=>{
  const pages=[
    'index.html','catalogo.html','about-us.html','fanarts.html','newsletter.html','extras.html',
    'fanarts-regras.html','comunidade.html','cadastro.html','recuperar-senha.html','moderacao.html',
    'episodios/episodio-01.html','episodios/episodio-02.html','episodios/episodio-03.html',
    'episodios/episodio-04.html','episodios/episodio-05.html','episodios/marco-zero.html'
  ];
  for (const page of pages) assert.match(read(page),/header-scroll\.js/,page);
});
