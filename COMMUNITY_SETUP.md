# Cyber-Us Community — configuração antes da publicação

Esta implementação permanece em um pull request de revisão. **Não integrar na `main` antes das verificações abaixo.** Nenhuma imagem da HQ foi adicionada. A comunidade está conectada apenas à página de demonstração do episódio 1; outros episódios só receberão comentários quando suas páginas existirem.

## O que já está preparado

- Supabase Free: projeto `Cyber-Us Community`, referência `znenamrszhjsiztllcit`, região São Paulo (`sa-east-1`).
- Tabelas existentes: `public.profiles`, `public.episodes`, `public.comments`, `public.reactions`; tabelas privadas: `community_private.staff`, `community_private.bans`, `community_private.moderation_log`.
- O episódio `episodio-01` está registrado com comunidade habilitada no banco. Comentários e votos são por episódio, compartilhados entre PT e EN.
- `community.js` contém **somente** a URL e a chave *publishable* do Supabase, que é destinada ao navegador. NUNCA incluir a chave `secret`, `service_role`, tokens privados ou senha de banco no GitHub.
- RLS e permissões do banco são obrigatórias, não apenas botões ocultos. Usuários não podem escolher papel de moderador no cadastro. Moderadores exigem registro em `community_private.staff`, feito somente por pessoa autorizada no painel SQL do Supabase.

## Etapas obrigatórias no painel Supabase (não configuradas por esta integração)

1. No projeto, em **Authentication → URL Configuration**, definir Site URL como `https://sketchcerberus.github.io/Cyber-Us/` e permitir EXATAMENTE o redirect `https://sketchcerberus.github.io/Cyber-Us/comunidade.html`. Testes locais exigem URLs locais temporárias específicas; não usar um curinga aberto em produção.
2. Em **Authentication → Providers → Email**, confirmar que a confirmação de e-mail está habilitada. Desativar autenticação anônima, caso tenha sido ativada. Verificar limites de envio de e-mails: para um lançamento público, pode ser necessário configurar um remetente SMTP próprio, com custos/limites analisados separadamente.
3. **Antibots: PENDENTE.** Antes de abrir o cadastro ao público, obter chaves para Cloudflare Turnstile ou hCaptcha, integrar o widget aos formulários de cadastro, login e recuperação e passar `captchaToken` ao Supabase Auth; só então habilitar o CAPTCHA nas configurações do Supabase. Ativar apenas o CAPTCHA do servidor sem adaptar os formulários impede logins e cadastros. Instruções: https://supabase.com/docs/guides/auth/auth-captcha . O intervalo de 30 segundos e o limite de 10 comentários/hora no banco ajudam, mas NÃO substituem a proteção do cadastro.
4. Estabelecer regras públicas da comunidade, política de privacidade (dados pessoais, moderação, retenção e exclusão de conta), canal de recurso contra banimentos e rotina de backup/exportação. Testar fluxos de acessibilidade, recuperação de senha, entrega de e-mails e uso em celular.

## Como conceder sua conta de administrador sem risco

1. Depois de publicar **somente quando autorizado**, abra `comunidade.html`, crie sua própria conta e confirme o e-mail. **Não forneça sua senha nem tokens a ninguém.**
2. No painel Supabase → Authentication → Users, copie o **ID UUID da conta correta** e confira a identidade. Não escolha um ID pela posição na lista.
3. No SQL Editor do projeto, substitua `COLE_AQUI_O_UUID_DA_SUA_CONTA` pelo UUID verificado e execute como proprietário do projeto:

```sql
insert into community_private.staff (user_id, role)
values ('COLE_AQUI_O_UUID_DA_SUA_CONTA'::uuid, 'admin')
on conflict (user_id) do update set role = excluded.role;
```

4. Saia e entre novamente na conta. O painel de moderação aparece em `comunidade.html`. A proteção REAL está nas funções e tabelas do banco. Esta operação **não foi realizada**: não há administrador atribuído ainda.

## Comportamento do banimento

- O administrador pode ocultar/restaurar/remover comentários e banir autores encontrados no painel, usando motivo de 5 a 500 caracteres e prazo de 1 a 3.650 dias ou prazo permanente.
- Usuário banido não pode criar comentários, votar ou alterar seu perfil. Seus comentários visíveis são ocultados na hora. O banimento NÃO impede ler a HQ pública nem efetuar login no Supabase; essa distinção é proposital.
- O administrador pode revogar banimentos; comentários ocultados não reaparecem automaticamente. O banco registra ações com motivo. A lista de banimentos é visível apenas a membros da equipe autorizados.
- O painel exibe até 100 comentários recentes do episódio 1 e até 100 banimentos ativos; paginação e relatórios mais completos são evoluções futuras.

## Testes de aceite antes do merge

- Visitante vê apenas comentários públicos e contadores reais, sem poder enviar votos ou comentários.
- Conta confirmada consegue editar somente o próprio nome público e nome de usuário, publicar comentário, votar uma vez por episódio, trocar ou remover voto, fazer logout e recuperar senha.
- A mensagem `<script>alert(1)</script>` aparece somente como TEXTO, nunca é executada; comentários são exibidos com `textContent`.
- Segundo comentário em menos de 30 segundos e 11º comentário em uma hora são rejeitados no banco; conteúdo com mais de 2.000 caracteres é rejeitado.
- Equipe: ocultar/restaurar comentário, banir usuário temporária/permanentemente, confirmar bloqueio de escrita mesmo enviando requisições diretamente à API, revogar banimento e confirmar que a lista de comentários ocultos não fica pública.
- Verificar o idioma PT/EN, celular, e-mail de verificação/recuperação e a lista de recomendações em **Supabase → Database → Advisors**.

## Publicação

A integração com o GitHub Pages só ocorrerá após revisão, configuração antifraude e autorização expressa para integrar o pull request. O banco já contém o registro do episódio 1, mas a página oficial atual permanece inalterada até o merge.
