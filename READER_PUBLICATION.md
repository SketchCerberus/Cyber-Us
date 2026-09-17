# Cyber-Us — publicação do leitor oficial

## Ordem e idiomas

A ordem autorizada pelo autor é **1 → 2 → 3 → 4 → 5 → Marco 0**, com português e inglês para cada parte. Marco 0 é uma parte própria, colocada depois do episódio 5. O leitor preserva a escolha de idioma e troca a imagem real, não apenas a interface.

## Bloqueio para merge: 12 imagens pendentes

O conector GitHub disponível permite alterar arquivos UTF-8, mas não anexar diretamente os JPEGs binários enviados na conversa. O autor recebeu o pacote `Cyber-Us-imagens-para-GitHub.zip`, que contém os **12 JPEGs originais**, sem cortes ou recompressão, nos caminhos exatos abaixo:

- `assets/episodes/ep01/{pt,en}/001.jpg`
- `assets/episodes/ep02/{pt,en}/001.jpg`
- `assets/episodes/ep03/{pt,en}/001.jpg`
- `assets/episodes/ep04/{pt,en}/001.jpg`
- `assets/episodes/ep05/{pt,en}/001.jpg`
- `assets/episodes/marco-zero/{pt,en}/001.jpg`

**Não integrar este PR à `main` até que todos os 12 arquivos estejam realmente na branch e as duas versões de cada leitor sejam verificadas.** Os links do catálogo estão preparados mas seriam quebrados antes desse upload.

### Upload na branch deste PR

1. Baixar o pacote de imagens enviado no chat e extrair no computador.
2. Abrir a branch `feature/official-reader-episodes-1-5-ground-zero` no repositório `SketchCerberus/Cyber-Us` (não `main`).
3. Usar **Add file → Upload files** para enviar as imagens mantendo a estrutura `assets/episodes/...`. Se o upload web não preservar subpastas, usar Git local para copiar `assets/episodes` na raiz do clone da branch e executar `git add assets/episodes`, `git commit` e `git push`.
4. Avisar na conversa após o envio; então verificar presença, integridade básica, idioma, navegação, aparência em celular e atualizar status do PR antes da integração já autorizada.

## Limites do escopo

Este PR só trata do leitor e dos links de leitura da homepage. Não altera newsletter, Ko-fi, fanarts, PR #3 da comunidade nem PR #7 Sobre nós. Não contrata serviços. As imagens são as obras fornecidas pelo autor; não criar conteúdo adicional.
