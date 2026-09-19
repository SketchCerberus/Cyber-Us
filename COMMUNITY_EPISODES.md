# Comunidade em todos os episódios

O painel de comentários e votos é criado por `community-panel.js`. Cada página informa seu slug canônico em `data-community-episode` no `<main>`. `community.js` usa esse slug para consultar e gravar comentários e votos; português e inglês usam o mesmo registro. A moderação mostra os 100 comentários mais recentes de todos os episódios, com o slug de origem.

## Ativação no banco

O banco de produção foi consultado apenas para leitura nesta tarefa. Em 19/09/2026, havia somente `episodio-01` em `public.episodes`. A migration `supabase/migrations/20260919_register_remaining_episodes.sql` precisa ser revisada e aplicada no projeto correto antes de disponibilizar os outros painéis. Ela insere os cinco slugs restantes, sem alterar um slug já existente. Nenhuma política RLS, função de moderação ou banimento precisa ser copiada por episódio.

Após aplicar a migration, confirme com uma consulta somente leitura que os seis slugs têm `community_enabled = true` e títulos/ordem corretos. Verifique no navegador, como visitante e com uma conta de teste autorizada: lista pública, comentário, voto/troca/remoção por episódio, PT/EN compartilhados, separação entre episódios, conta banida impedida de escrever, e painel de moderação com o slug correto. Testes que escrevem ou moderam afetam o banco real; use ambiente de desenvolvimento ou autorização específica antes de executá-los em produção.

## Novo episódio

1. Crie a página em `episodios/` com seu leitor e imagens PT/EN, seguindo a estrutura atual.
2. Adicione `../community.css`, `../reader.js`, `../community-panel.js`, a biblioteca Supabase, `../community-avatar.js` e `../community.js`, nessa ordem. Defina no `<main>` `data-community-episode="slug-canonico"`. O slug é o mesmo nas duas línguas.
3. Prepare uma nova migration que registre o slug, os dois títulos, a ordem e `community_enabled = true`. Revise e aplique no banco apropriado durante a implantação autorizada; confirme a linha por consulta.
4. Rode `node --test tests/community.test.mjs` e revise o episódio no navegador em PT/EN. Não duplique o painel nem a lógica de comentários na página.
