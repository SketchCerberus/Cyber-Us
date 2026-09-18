# Cyber-Us Community — preparação para publicação

Este código continua no PR #3 **em rascunho**. Não integrar à `main` nem abrir cadastros ao público antes das verificações abaixo. A branch foi sincronizada com o leitor publicado: os seis episódios bilíngues e os 12 JPEGs originais foram preservados. Só o episódio 1 tem interface de comunidade. Consulte COMMUNITY_PREVIEW.md para a prévia local gratuita.

## Implementado

- Supabase Free: projeto `Cyber-Us Community`, referência `znenamrszhjsiztllcit`, região São Paulo (`sa-east-1`).
- Tabelas: `public.profiles`, `public.episodes`, `public.comments`, `public.reactions`; dados de equipe, banimentos e logs no esquema privado `community_private`.
- Episódio `episodio-01` registrado com comunidade habilitada. Os votos e comentários são comuns às duas traduções do episódio.
- `community.js`: URL e chave **publishable** do Supabase, apropriadas para o navegador. Nunca incluir chave `secret`, `service_role`, tokens privados nem senha do banco no GitHub.
- RLS, permissões por coluna, validação de votos, moderação e limites de comentários são aplicados no banco, não apenas pela interface.
- Cloudflare Turnstile **integrado ao frontend**: três desafios independentes em cadastro, login e recuperação, tokens enviados ao Supabase Auth e reiniciados após cada tentativa. Quando falta a site key ou o script não carrega, os formulários são bloqueados. Isso **não ativa proteção no servidor** automaticamente: é preciso configurar o segredo no Supabase.

## 1. Configurar os endereços do Auth no painel Supabase

No projeto, em **Authentication → URL Configuration**:

- Site URL: `https://sketchcerberus.github.io/Cyber-Us/`
- Redirect permitido exato: `https://sketchcerberus.github.io/Cyber-Us/comunidade.html`

Não habilite curingas amplos em produção. Para testes locais, inclua temporariamente o endereço local específico. Em **Authentication → Providers → Email**, confira a confirmação de e-mail e desative login anônimo caso esteja ligado. Confirme a entrega de e-mails de cadastro e recuperação: o envio padrão possui limites; SMTP próprio pode exigir avaliar custos separadamente.

## 2. Finalizar Cloudflare Turnstile (obrigatório antes do lançamento)

1. No painel [Cloudflare Turnstile](https://dash.cloudflare.com/?to=/:account/turnstile), abra o widget já existente. Preserve seu hostname de produção; para a prévia local, siga COMMUNITY_PREVIEW.md.
2. A **Site Key pública já está preenchida** no meta `cyber-us-turnstile-site-key` de `comunidade.html` e foi preservada. Não substitua por uma chave de teste.
3. No projeto Supabase → **Authentication → Settings → Bot and Abuse Protection** (o nome do menu pode variar), habilite CAPTCHA, selecione **Cloudflare Turnstile** e informe a **Secret Key privada** diretamente no painel. **NUNCA cole a Secret Key no repositório, no HTML, em issues, em screenshots ou nesta conversa.**
4. Garanta que a Site Key do HTML e a Secret Key do Supabase pertençam ao MESMO widget. As chamadas `signUp`, `signInWithPassword` e `resetPasswordForEmail` já recebem `captchaToken` do desafio correto. A verificação real do token ocorre no Supabase, e não pode ser substituída por uma checagem só no JavaScript.
5. Faça testes de cadastro, login, senha incorreta, recuperação de senha e recarregamento dos desafios. Simule token ausente/expirado e confirme bloqueio. Um Turnstile de produção não funciona a partir de `file://`; use um servidor HTTP local com domínio permitido ou, após aprovação, teste na URL publicada. Se usar chaves de teste, não deixe as chaves de teste no lançamento.

Documentação: https://supabase.com/docs/guides/auth/auth-captcha e https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/ .

**Estado atual:** Site Key presente; 1 administrador confirmado por consulta somente leitura. O autor relatou configuração de CAPTCHA/URLs no painel, mas seus valores privados e o fluxo completo não foram verificados. Veja COMMUNITY_PREVIEW.md para verificações e pendências; não faça merge antes do aceite.

## 3. Preparar a conta proprietária e a moderação

Depois da liberação dos formulários para testes, crie sua própria conta e confirme o e-mail. No painel Supabase → **Authentication → Users**, encontre a conta correta e confira o UUID pessoalmente; nunca escolha o primeiro usuário por suposição. No SQL Editor, autenticado como proprietário do projeto, substitua o placeholder por esse UUID verificado:

```sql
insert into community_private.staff (user_id, role)
values ('COLE_AQUI_O_UUID_DA_SUA_CONTA'::uuid, 'admin')
on conflict (user_id) do update set role = excluded.role;
```

Atribuir permissões de administrador é uma operação privilegiada: não incluir esse SQL com UUID fixo no código do site nem aceitar um `user_id` informado pelo visitante. Após atribuir, saia/entre novamente e verifique o painel. **Já existe 1 administrador atribuído; não repita esta operação sem necessidade.**

### Banimentos

A equipe pode ocultar, restaurar e remover comentários, banir autores por 1–3.650 dias ou permanentemente (motivo obrigatório) e revogar o banimento. Banidos não escrevem comentários, não votam nem alteram o perfil; comentários visíveis anteriores são ocultados. A leitura da HQ e o login continuam possíveis. Comentários ocultados não retornam automaticamente após revogação. O banco registra ações e suas justificativas. O painel mostra até 100 comentários recentes do episódio 1 e 100 banimentos ativos.

## 4. Privacidade, regras e validação

Antes de liberar usuários, publique política de privacidade (finalidade dos dados, serviço utilizado, retenção, exclusão de conta e contato), regras comunitárias e canal para contestar banimentos. Defina rotina de exportação/backup e verifique cotas de uso do Supabase Free. Não habilitar contas públicas até decidir um fluxo seguro para exclusão de conta.

Checklist de aceite:

- Visitantes veem apenas comentários públicos e contadores reais; não conseguem publicar ou votar.
- Conta com e-mail confirmado edita apenas seus dados públicos, publica comentários, vota uma vez por episódio, troca/remove voto, sai e recupera senha.
- O comentário `<script>alert(1)</script>` aparece como texto, nunca executa HTML; a interface usa `textContent`.
- Comentários acima de 2.000 caracteres, segundo comentário em menos de 30 segundos e 11º comentário em uma hora são rejeitados no banco.
- Moderador oculta/restaura comentário, bane temporária/permanentemente, confirma impedimento de escrita por chamadas diretas à API, revoga ban e verifica que comentários ocultos não são lidos por visitantes.
- Testar os três formulários com CAPTCHA real habilitado no Supabase, e-mails e redirecionamento, PT/EN, navegação por teclado, mobile e recomendações em **Supabase → Database → Advisors**.

## Publicação

O GitHub Pages e a página inicial não foram modificados. A integração na `main` só deve acontecer após configuração de Auth/CAPTCHA, testes e autorização explícita do autor. Também não foi criado qualquer serviço pago.
