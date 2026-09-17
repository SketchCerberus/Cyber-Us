# Cyber-Us — pacote de montagem do leitor oficial

Este arquivo contém as **12 imagens originais** recebidas nesta conversa, sem alteração de arte, texto, corte nem recompressão, mais os arquivos de leitura para atualização no repositório `SketchCerberus/Cyber-Us`.

## Ordem solicitada pelo autor

1. Inicializando / Initializing
2. Processando / Processing
3. Procurando / Searching
4. Prosseguindo / Proceeding
5. Reiniciando / Rebooting
6. Memória — Marco Zero / Memory — Ground Zero

O Marco 0 **vem por último**; não é a página 6. Os arquivos estão em `assets/episodes/{ep01...ep05,marco-zero}/{pt,en}/001.jpg` e o catálogo e as páginas usam caminhos relativos compatíveis com `/Cyber-Us/` no GitHub Pages.

## Arquivos que este pacote atualiza

- `catalogo.html`: seis entradas com botões reais e ordem correta.
- `episodios/episodio-01.html` até `episodio-05.html` + `marco-zero.html`: leitores verticais com navegação anterior/próximo e mudança de imagem por idioma.
- `reader.js`: conserva PT/EN entre as páginas e troca texto, atributo alt e imagem verdadeira.
- `script.js`: direciona os botões já existentes da página inicial ao catálogo oficial.
- `reader.css`: cópia idêntica do CSS atual, incluída para visualização local.
- `comic-reader.css`: ajuste de exibição responsiva sem cortar as tiras.
- `assets/episodes/...`: 12 JPEGs originais de usuário, ambos os idiomas.

**Mescle este pacote sobre o site atual, preservando `index.html` e todos os arquivos não incluídos aqui.** `script.js` altera só o destino dos botões de leitura existentes para o catálogo. `reader.css` tem o mesmo conteúdo do arquivo do site. Não mexa no PR #3 de comunidade nem no PR #7 Sobre nós.

## Como subir as imagens que o conector GitHub não aceita

1. Extraia o ZIP `Cyber-Us-imagens-para-GitHub.zip` em seu computador.
2. Abra o repositório no GitHub e selecione a branch do pull request de leitura, não `main`.
3. Entre em **Add file → Upload files**. Envie os 12 arquivos JPEG preservando os caminhos de pastas `assets/episodes/...`. Se o navegador não preservar pastas, envie por pastas individualmente, criando as pastas necessárias, ou use Git local (`git add assets/episodes && git commit && git push`).
4. Confirme que todos os 12 arquivos constam na branch e avise nesta conversa. Não faça o merge se faltar um arquivo.

A página Sobre nós do PR #7 e a comunidade do PR #3 são trabalhos separados e não fazem parte deste pacote.
