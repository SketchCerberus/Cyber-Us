# Cyber-Us — vitrine de fanarts (PR de preparação)

Esta implementação é uma **vitrine editorial estática**, não um sistema de envio. Nenhum upload, cadastro, moderação automática, API, serviço pago ou integração com o PR #3 foi criado. O formulário de envio continua integralmente desativado.

## Comportamento acordado

- Na caixa à direita do destaque da página `fanarts.html`, a arte da vez aparece nítida no centro. A arte anterior e a próxima aparecem atrás, com opacidade reduzida e desfoque suave (havendo pelo menos três obras). Com duas obras, há só uma lateral; com uma, não há rotação.
- Ordem embaralhada; troca automática a cada 8 segundos, sem setas ou botões de navegação. Há um controle **Pausar / Continuar** discreto por acessibilidade. A troca pausa no hover, ao focar a vitrine e quando a aba estiver oculta. Com preferência por movimento reduzido, a rotação automática não começa.
- Uma faixa **abaixo** da arte central mostra nome artístico e, **somente quando autorizado**, país ou região autodeclarado. Nenhum dado é deduzido de IP, perfil ou localização. Artista e região aparecem como texto, nunca HTML executável.
- A moldura usa apenas um detalhe neon em azul, vermelho ou verde, indicado pelo artista, ou `random` (sorteado uma vez por obra ao carregar a página). A imagem não recebe filtros, recortes nem alterações de arquivo: usa `object-fit: contain`. As laterais recebem efeito visual por CSS, sem modificar os originais.
- As obras aprovadas também aparecem na seção da galeria como cartões estáticos, para que a página não diga incorretamente que não há fanarts quando a vitrine estiver ativa.

## Estado atual: nenhuma fanart adicionada

O array `approvedFanarts` em `fanarts-showcase.js` está **vazio**. O quadro `ARTE` e o estado vazio original permanecem exatamente como antes. A captura de Mona Lisa usada na conversa foi somente referência visual e **não foi incluída como fanart**. Também não foram criados artistas ou regiões fictícios.

O campo de escolha de cor é adicionado à prévia do formulário, mas permanece desativado junto com todos os outros campos. Escolher ali ainda não cadastra nem envia nada; um envio real precisará de fluxo autorizado e moderação antes da publicação.

## Como incluir uma obra futuramente

1. Receba a obra por meio consentido; confirme que a pessoa tem direito de autorizar sua exibição na Cyber-Us. Obtenha autorização explícita para imagem, nome de exibição e eventual região; ofereça opção de não publicar região e um caminho para retirar a obra.
2. Coloque o **arquivo autorizado** em `assets/fanarts/`, sem modificar nem recomprimir a arte recebida sem o consentimento do artista. Confirme que o nome do arquivo usa apenas letras, números, `_`, `-` e `/`, e extensão `.png`, `.jpg`, `.jpeg` ou `.webp`.
3. Adicione **manualmente** uma entrada ao array `approvedFanarts`:

```js
{
  image: 'assets/fanarts/arquivo-autorizado.png',
  artist: 'Nome artístico autorizado',
  region: 'Região autodeclarada (apenas se autorizada)',
  showRegion: false,
  accent: 'random', // blue | red | green | random
  approved: true
}
```

Troque `showRegion` para `true` somente após consentimento específico para exibir esse dado. A marca `approved: true` é um registro editorial manual, **não** um controle de segurança do servidor. Não colocar obras pendentes, privadas ou sem autorização no repositório público, mesmo marcadas `approved: false`.

## Verificações antes de qualquer publicação

- Com **zero** entradas aprovadas: quadro e galeria vazia originais visíveis, sem imagens falsas, e formulário totalmente desativado.
- Com **uma, duas e pelo menos três** imagens locais autorizadas para testes: avaliar ordem, laterais, crédito, região opcional, ciclo sem repetição consecutiva, falta de imagem e card da galeria.
- Conferir alternância de idioma PT/EN, inclusive pausa e opções de cor; zoom, mobile e teclado; preferência por movimento reduzido, hover/foco, aba oculta e contraste nas três cores.
- Confirmar permissão de exibição para cada obra, metadados publicáveis e eventual processo de remoção. Revisar o site visualmente antes de integrar à `main`.

**Não mesclar/publicar este PR sem autorização específica do autor.** O PR #3, imagens da HQ e seus dados permanecem intocados.
