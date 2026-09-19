# Comunidade em todos os episódios

O painel de comentários e votos é criado por `community-panel.js`. Cada página informa seu slug canônico em `data-community-episode` no `<main>`. `community.js` usa esse slug para consultar e gravar comentários e votos; português e inglês usam o mesmo registro. A moderação mostra os 100 comentários mais recentes de todos os episódios, com o slug de origem.

## Ativação no banco

Em 19/09/2026, a migration `register_remaining_episodes` (versão `20260919033545`) foi aplicada ao projeto `Cyber-Us Community` após autorização do autor. Ela inseriu os cinco slugs restantes, sem alterar o episódio 1. A consulta posterior confirmou os seis episódios com `community_enabled = true`; a leitura dos seis slugs com papel `anon` funcionou e RLS permaneceu ativa em `episodes`, `comments` e `reactions`. Nenhuma política RLS, função de moderação ou banimento precisa ser copiada por episódio.

Antes de publicar a interface, verifique no navegador, como visitante e com uma conta de teste autorizada: lista pública, comentário, voto/troca/remoção por episódio, PT/EN compartilhados, separação entre episódios, conta banida impedida de escrever, e painel de moderação com o slug correto. Esses fluxos de escrita e moderação ainda não foram executados. Testes que escrevem ou moderam afetam o banco real; use ambiente de desenvolvimento ou autorização específica antes de executá-los em produção.

## Novo episódio

1. Crie a página em `episodios/` com seu leitor e imagens PT/EN, seguindo a estrutura atual.
2. Adicione `../community.css`, `../reader.js`, `../community-panel.js`, a biblioteca Supabase, `../community-avatar.js` e `../community.js`, nessa ordem. Defina no `<main>` `data-community-episode="slug-canonico"`. O slug é o mesmo nas duas línguas.
3. Prepare uma nova migration que registre o slug, os dois títulos, a ordem e `community_enabled = true`. Revise e aplique no banco apropriado durante a implantação autorizada; confirme a linha por consulta.
4. Rode `node --test tests/community.test.mjs` e revise o episódio no navegador em PT/EN. Não duplique o painel nem a lógica de comentários na página.
