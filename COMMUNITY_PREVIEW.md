# Prévia gratuita do PR #3

Esta prévia roda somente no computador do autor. Não publica site, não altera GitHub Pages e não exige serviço contratado. A branch autorizada é `feature/community-auth-comments-reactions-moderation`; o PR continua em rascunho e sem integração na main.

## Abrir novamente

Com Node.js instalado, abra um terminal na pasta do repositório, nessa branch, e execute:

```sh
node scripts/preview.mjs
```

Abra `http://localhost:4173/Cyber-Us/comunidade.html`. O catálogo fica em `http://localhost:4173/Cyber-Us/catalogo.html`. Encerre com Ctrl+C. A porta 4173 precisa estar livre. O servidor escuta apenas em 127.0.0.1, não expõe a rede local, não lista diretórios e bloqueia arquivos internos. Não use `file://`. O endereço não funciona em outro computador/celular e deixa de funcionar quando o servidor é encerrado.

**Isolamento:** arquivos, origem do navegador e armazenamento de sessão locais; o backend continua sendo o projeto Supabase existente `znenamrszhjsiztllcit`. Cadastro, perfil, comentários, votos e moderação reais afetam esse banco. Não é uma cópia isolada do banco. Nenhuma conta ou conteúdo de teste foi criado nesta revisão.

## Autor: permitir o endereço para testes reais

1. No painel Cloudflare, entre em **Turnstile**, abra o widget cuja Site Key corresponde ao meta `cyber-us-turnstile-site-key` de `comunidade.html`, escolha **Settings → Hostname Management → Add hostname**, adicione somente `localhost` e salve. Sem `http://`, porta ou caminho. Preserve os hostnames existentes e a chave já inserida. A Cloudflare permite localhost, embora recomende separar widgets de desenvolvimento e produção. Aqui a inclusão deve ser temporária; retire-a após os testes. Não troque o segredo do widget no Supabase por uma chave de teste.
2. No [Supabase → Authentication → URL Configuration](https://supabase.com/dashboard/project/znenamrszhjsiztllcit/auth/url-configuration), em **Redirect URLs → Add URL**, adicione exatamente `http://localhost:4173/Cyber-Us/comunidade.html` e salve. Preserve a **Site URL** e todos os redirects de produção. Não use curingas. Use sempre `localhost`, e não `127.0.0.1`, na barra do navegador.
3. Em **Authentication → Bot and Abuse Protection**, confira pessoalmente que CAPTCHA está ligado, com provedor Turnstile e o segredo do mesmo widget. Não copie/exiba o segredo no chat ou repositório. Não há necessidade de rotacionar ou mudar configurações já corretas.
4. Abra a prévia em Chrome/Edge comum. Complete pessoalmente o CAPTCHA e use sua conta de testes. Para cadastro/recuperação, abra o e-mail no mesmo navegador/perfil em que iniciou a solicitação: o fluxo PKCE depende do verificador salvo nessa origem. Confirme que o retorno fica em `localhost:4173/Cyber-Us/comunidade.html`, inclusive ao trocar a senha.
5. Se o e-mail voltar à produção, confira primeiro a entrada exata de Redirect URLs e o template de e-mail. Templates personalizados podem fixar SiteURL em vez do link de confirmação/redirect solicitado. Não mude templates de produção sem revisar o impacto. O SMTP padrão do Supabase tem restrições de destinatários e limites: se bloquear entrega, registre a limitação e use um endereço autorizado para teste; não contrate SMTP.

As configurações dos painéis acima **não foram alteradas nesta revisão**. CAPTCHA real e e-mails ainda dependem dessa conferência pelo autor.

## Validação e limitações

Executar os testes locais: `node --test tests/community.test.mjs`.

- Confirmado: 12 JPEGs idênticos à main por hash Git; leitor, CSS do leitor, página inicial e episódios 2–5/Marco 0 preservados. No episódio 1, o trecho original do leitor permanece intacto e a comunidade é adicionada após sua navegação.
- Confirmado: scripts válidos, links locais, troca das imagens PT/EN dos seis episódios, redirects relativos à origem/base da prévia, CAPTCHA sem chave/script bloqueado, tokens separados por formulário e invalidação/reset.
- Navegador: conta e episódio 1 acessíveis; imagem inglesa carregada; comentários públicos e contadores consultados, sem escrita. Visitante não pode votar e não vê formulário de comentário.
- Corrigido: uso de `turnstile.ready()` incompatível com o script `defer`; widgets agora inicializam após a execução ordenada do script e a exibição dos formulários. O navegador automatizado recebeu erro Turnstile `300030`; isso **não comprova** hostname autorizado nem sucesso de CAPTCHA. Testar manualmente em navegador comum.
- Banco, somente leitura: 1 administrador e 1 registro do episódio 1; RLS nas 7 tabelas; função de banimentos bloqueia ausência de UID e exige membro da equipe; execução anônima do wrapper negada. Essas verificações não substituem os testes reais de permissões.
- Advisors: aviso do wrapper SECURITY DEFINER, informações sobre três tabelas privadas sem policies e proteção contra senhas vazadas desabilitada. A guarda interna de equipe foi conferida; não foram alteradas permissões ou opções pagas. Revisar conforme [aviso do wrapper](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [RLS sem policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) e [segurança de senhas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
- Pendentes com contas reais: cadastro/confirmar e-mail, login/logout, recuperação, perfil, publicar comentário, alternar/remover voto, limites de comentários, duas contas verificando autoria, moderação/banimento e bloqueio por API direta. Pendentes também privacidade, regras e exclusão de conta antes de abrir a comunidade.
- As duas migrações deste PR não recriam o banco do zero: o esquema base já existia no Supabase. Não aplicá-las isoladamente em projeto vazio. Nenhuma migração foi executada nesta revisão.

## Se futuramente precisar de link remoto

Não há URL pública de prévia criada nesta revisão. Após autorização específica de publicação de prévia, usar hospedagem gratuita separada com hostname HTTPS estável, sem apontar GitHub Pages para esta branch. Permitir apenas o hostname exato no Turnstile e o caminho `/comunidade.html` correspondente em Redirect URLs. `community.js` resolve o callback pela URL do próprio script, preservando prefixos como `/Cyber-Us/`. A main e a Site URL de produção não precisam mudar.

Referências: [Turnstile e hostnames](https://developers.cloudflare.com/turnstile/additional-configuration/hostname-management/), [testes locais e limitações de automação](https://developers.cloudflare.com/turnstile/troubleshooting/testing/), [redirects Supabase](https://supabase.com/docs/guides/auth/redirect-urls), [CAPTCHA Supabase](https://supabase.com/docs/guides/auth/auth-captcha).
