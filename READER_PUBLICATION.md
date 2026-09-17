# Cyber-Us — leitor oficial

## Ordem e idiomas

Ordem definida pelo autor: **1 → 2 → 3 → 4 → 5 → Marco 0**. Cada parte possui imagens em português (`pt`) e inglês (`en`), selecionadas pelo botão de idioma e preservadas durante a navegação. Marco 0 é uma parte própria, depois do episódio 5.

## Imagens recebidas e organizadas

O autor enviou 12 imagens para a branch de publicação. O upload inicial acrescentou a pasta extra `Cyber-Us-leitor-pronto/`; corrigimos a localização das imagens usando as referências aos mesmos blobs do GitHub (sem recortes, recompressão ou alterações na arte) e removemos a pasta extra. A branch contém exatamente os caminhos de arte esperados:

- `assets/episodes/ep01/{pt,en}/001.jpg`
- `assets/episodes/ep02/{pt,en}/001.jpg`
- `assets/episodes/ep03/{pt,en}/001.jpg`
- `assets/episodes/ep04/{pt,en}/001.jpg`
- `assets/episodes/ep05/{pt,en}/001.jpg`
- `assets/episodes/marco-zero/{pt,en}/001.jpg`

## Verificações

- 12 caminhos de imagem presentes na árvore da branch, com 12 blobs JPEG e tamanhos não nulos.
- Catálogo aponta para seis páginas do leitor na ordem autorizada.
- HTMLs possuem URLs de imagem correspondentes a cada idioma; `reader.js` seleciona `data-src-pt`/`data-src-en`, atualiza texto/alt e guarda escolha de idioma.
- Páginas usam imagem fluida com proporção preservada e navegação anterior/próximo; o CSS inclui adaptação para telas estreitas.
- Testes estáticos de links, sintaxe JS e mudança simulada de idioma foram realizados durante a preparação. Inspeção visual real em navegador/celular não foi efetuada e deve ser acompanhada após a implantação.

## Escopo

Somente leitor, catálogo, imagens e links de leitura da homepage. Não inclui PR #3 (comunidade) nem PR #7 (Sobre nós), nem muda newsletter, Ko-fi ou fanarts. Não há serviço pago nem conteúdo de HQ inventado.
