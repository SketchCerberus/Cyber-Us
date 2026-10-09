# Painel do Criador — critérios de lançamento

**Estado: desenvolvimento; não aplicar SQL nem publicar na main sem validar os itens abaixo.**

## Migrações na ordem
1. sql/creator-publishing.sql
2. sql/creator-storage.sql
3. sql/creator-discussion-extensions.sql (fixação e notificações: ainda faltam interface e gatilhos)

## Testes obrigatórios
- Usuário anônimo e conta comum não conseguem gravar publicações, acessar rascunhos ou enviar imagens.
- Cargo creator verificado em community_private.staff consegue criar rascunho e enviar JPG/PNG/WebP.
- Dois idiomas para o mesmo capítulo/episódio aparecem corretamente.
- Antes de publish_at, usuário anônimo não consegue listar ou assinar imagem privada.
- Depois de publish_at, catálogo e leitor mostram o conteúdo sem login.
- Testar mudança de fuso horário (Brasília), horário de verão histórico, upload interrompido, duplicatas e erro de rede.
- Confirmar que notas e comentários são tratados como texto e nunca executam HTML.
- Testar que comentários e votos de episódio agendado falham antes de publish_at e funcionam depois.
- Testar cenário de uma versão publicada e outra ainda em rascunho.
- O código de badge/fixação foi integrado ao community.js; validar RLS, comportamento em paginação e moderação. A infraestrutura de notificações existente já cobre respostas, sem segunda caixa de entrada.
- Testar segurança do Storage, lint e testes Node do repositório.
- Fazer revisão visual PT/EN em celular e desktop.

## Limitações atuais
- Fixação tem SQL e interface propostos, mas ainda sem migração aplicada ou testes reais.
- A página dinâmica agora inclui o painel de discussão/votos existente; falta teste real e validação das permissões.
- A edição de publicações está limitada à nota do autor.
- As migrações não foram executadas no Supabase de produção.
- Não foi feito teste de ponta a ponta em produção.
