# Exclusão e edição — outubro de 2026

O titular confirmou a política: manter comentários e fanarts com crédito anonimizado. A comunidade oferece a opção PT/EN após login; exige palavra de confirmação e autenticação nos últimos dez minutos. Integrantes atuais da equipe precisam transferir responsabilidades antes de excluir a conta.

`close-account` verifica o token no servidor, consulta a função de equipe, remove somente o avatar do titular e chama Auth soft deletion. O trigger anonimiza perfil e créditos, apaga notificações/preferências e sessões; conserva conteúdo e identificadores técnicos. Contas excluídas são bloqueadas nas verificações de escrita. Não se aceita um UUID fornecido pelo navegador. A chave de serviço fica exclusivamente na função Supabase.

As migrações versionadas são o histórico de implantação. Os arquivos em `sql/` são referência consolidada, não migrações adicionais. A função inclui `index.ts`, `handler.mjs` e `deno.json`, com verificação JWT habilitada.

Testes: `tests/account-closure.test.mjs` valida autenticação, confirmação, equipe, falhas e identidade do titular; `tests/account-closure.browser.mjs` valida interface sem excluir usuários; `tests/account-closure.sql` usa dados temporários e ROLLBACK para confirmar preservação, anonimização e bloqueio de escrita. Nenhuma conta real foi excluída nesta validação. `tests/owner-comment-editing.sql` verifica autoria, concorrência, histórico e permissões com ROLLBACK.

A newsletter tem descadastro separado. Informações já inseridas em textos/imagens permanecem nesses conteúdos; a interface e as regras explicam a retirada antes da exclusão. A política não promete remover registros técnicos privados ou auditoria de moderação.
