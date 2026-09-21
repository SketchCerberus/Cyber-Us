# Cyber-Us — implementação de envio de fanarts (RASCUNHO)

**Não mesclar na `main`, executar SQL de produção ou anunciar envios abertos sem aprovação do autor e testes.** Este branch modifica somente `fanarts.html`, adiciona `fanarts-submit.js` e prepara `supabase/fanart_submissions_draft.sql`. Os episódios, newsletter, contas, arte original e galeria editorial existente permanecem intocados. Não foram criados serviços pagos.

## Fluxo preparado

1. Página bilíngue preserva estrutura existente e mostra formulário desativado por padrão (fail-closed). `fanarts-submit.js` ativa os campos somente para conta autenticada, e-mail confirmado, não banida e API de envios acessível.
2. Artista informa nome, título, região opcional e consentimento separado para exibi-la, link HTTPS opcional, cor da moldura e confirma direitos de exibição limitada. Autoriza explicitamente reprocessar a imagem antes do envio.
3. O navegador valida assinaturas PNG/JPEG/WebP, decodifica a imagem, exige tamanho original/processado de até 5 MB e máximo de 4096 x 4096 pixels, reexporta via canvas (PNG ou WebP) para retirar metadados embutidos e envia o novo arquivo. Reexportação pode alterar compressão, nunca deve ocorrer sem consentimento.
4. API reserva registro com ID aleatório e status `pending`; upload vai para bucket `fanart-pending` **privado**, no caminho `user-id/uuid.ext`. O servidor limita 3 registros por usuário em 24 horas; RLS verifica proprietário, banimento, caminho e status. O bucket limita MIME/tamanho. Visitantes não têm acesso a arquivos pendentes; nenhum item entra na galeria automaticamente.
5. `fanarts-showcase.js` continua com lista vazia de obras publicadas. Moderação deve inspecionar, verificar direitos, testar arquivo recebido e só então publicar uma cópia segura/autorizada pelo fluxo editorial. Não publicar o arquivo bruto privado nem expor URL assinada à galeria. O painel atual de moderação de fanarts serve para localizar/banir contas, **não** aprovar essas novas obras.

## Configuração necessária antes do lançamento

- Revisar/aprovar regras da galeria, aviso de privacidade e canal para retirada/denúncias (incluindo exclusão de imagem, registro e região). O texto da página é uma informação inicial, não substitui uma política completa.
- Revisar SQL com responsável pelo banco, executar em ambiente de testes isolado (não no Supabase de produção), conferir funções existentes `public.is_banned()`, permissões por coluna, RLS e policy do storage. SQL ainda **não executado**.
- Criar interface administrativa autenticada para a fila de obras e aprovação/rejeição com log, ou definir procedimento estrito no painel Supabase; criar limpeza programada de uploads/registros órfãos e de obras rejeitadas. As quotas podem ser consumidas por envios falhos; limpeza administrativa é necessária.
- Conferir cotas e custos de Storage antes de liberar. O fluxo preparado não compra nada.
- Testar em HTTP/HTTPS (não em `file://`) com contas de teste: visitante, e-mail não confirmado, conta banida, proprietário, moderador; envio válido, arquivo disfarçado, grande, imagem corrompida, 4º envio/24h, links não HTTPS, consentimento regional, saída da conta no meio do envio e acesso direto à API.
- Confirmar via requisições diretas que `anon` e outros usuários não leem objetos pendentes, não forjam `status`, `created_at`, `user_id` nem salvam em caminho de terceiros. Confirmar que não existem policies permissivas de storage legadas que ampliem acesso ao bucket.
- Conferir aspecto PT/EN, teclado, celular, mensagem de falha, qualidade visual da conversão e solicitações de exclusão. Fazer revisão final e solicitar autorização específica para publicar/mesclar.

## Limitações honestas

Este branch **prepara o fluxo de envio**, mas ainda não fornece um sistema completo de publicação e retirada nem testes ponta a ponta. O formulário permanece bloqueado enquanto a tabela privada não estiver disponível ou a pessoa não estiver autenticada. A aplicação do SQL em produção não foi realizada. O processamento no navegador não substitui a inspeção de arquivos no servidor; o bucket privado e a revisão editorial são barreiras indispensáveis. Se o upload falhar depois da reserva, a aplicação tenta excluir o registro; na política de segurança proposta, essa exclusão pelo visitante não é permitida, portanto a limpeza fica a cargo de um administrador e a tentativa consome a quota.
