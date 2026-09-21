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

test('every site page loads the shared header behavior',()=>{
  const pages=[
    'index.html','catalogo.html','about-us.html','fanarts.html','newsletter.html','extras.html',
    'fanarts-regras.html','comunidade.html','cadastro.html','recuperar-senha.html','moderacao.html',
    'episodios/episodio-01.html','episodios/episodio-02.html','episodios/episodio-03.html',
    'episodios/episodio-04.html','episodios/episodio-05.html','episodios/marco-zero.html'
  ];
  for (const page of pages) assert.match(read(page),/header-scroll\.js/,page);
});
