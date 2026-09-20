# Publicação dos extras Cyber-Us

A página `extras.html` tem quatro áreas: artes conceituais, curiosidades, bastidores e fichas de personagens. Nesta primeira versão, curiosidades/bastidores vêm de `about-us.html`, e a ficha do protagonista contém apenas a sinopse pública de `index.html`. A área de artes informa claramente que o acervo ainda não foi publicado: **não substituir com páginas finais dos episódios fingindo serem esboços**. Os textos existem em PT e EN.

## Regra fundamental para evitar spoilers

**Não colocar material ainda bloqueado dentro do HTML, JavaScript, JSON, comentários, atributos `data-*`, textos ocultos, nomes de arquivos ou alt de imagens públicos.** Esconder uma ficha com CSS, `<details>`, senha no navegador ou botão de “desbloquear após o episódio X” não protege spoilers: qualquer visitante pode inspecionar o código. Uma ficha futura só entra no repositório público depois da publicação do episódio que revela seus fatos e da aprovação editorial do criador. O aviso de “liberação gradual” não contém nomes, imagens nem pistas de personagens futuros.

## Como adicionar cada extra

1. Confirmar com o criador que a obra/arte e as informações podem ser publicadas e em qual episódio foram reveladas. Para artes, confirmar titularidade e créditos; usar arquivo otimizado e texto alternativo descritivo em PT e EN. Criar `assets/extras/` apenas ao receber imagens reais.
2. Verificar que o episódio de referência está realmente publicado no `catalogo.html` e nas duas versões da história. Se o assunto é apenas de bastidores, checar se o criador já o divulgou publicamente e se sua divulgação não antecipa uma revelação.
3. Adicionar somente a ficha já liberada a `extras.html`. Use o selo de disponibilidade indicando o episódio de referência e traduções `data-pt` / `data-en` em elementos de texto simples; não colocar HTML aninhado dentro desses elementos, porque `reader.js` atualiza `textContent`.
4. Revisar nomes, descrições, alt, links, metadados e código-fonte nos dois idiomas com uma conta que não tenha lido capítulos futuros. Não supor que o progresso salvo no navegador é uma proteção de conteúdo.
5. Testar página em PT e EN, celular/desktop, temas claro/escuro, navegação por teclado, links, imagens e leitores de tela. Abrir PR separado e pedir aprovação antes de integrar/publicar.

O link global para os extras é incluído pelo `header-scroll.js`, que já é compartilhado por `index.html`, catálogo e páginas do leitor. Esta seção **não** altera newsletter/Brevo, comunidade, banco de dados ou arquivos das páginas da HQ.
