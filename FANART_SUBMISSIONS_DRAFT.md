# Cyber-Us — fanarts: envio inicial e moderação manual

## O que foi implementado

- `fanarts.html` agora carrega `fanarts-submit.js` e `fanarts-my-submissions.js`; oferece formulário bilíngue de envio, acompanhamento de status e pedido de retirada pela conta que enviou.
- `fanarts-regras.html` apresenta as regras de uso, direitos de exibição limitada e aviso de privacidade. Região é opcional e exige consentimento separado para ser exibida.
- Supabase: migrações `20260921162205_fanart_submissions_private_queue.sql` e `20260921162320_fanart_owner_withdrawal_requests.sql` foram aplicadas em produção em 21/09/2026. O bucket `fanart-pending` é PRIVADO (5 MB, PNG/JPEG/WebP). Nenhuma política permite leitura dos arquivos pendentes para visitantes.
- RLS permite que cada conta veja suas próprias submissões, envie com email confirmado, não banida e até 3 registros a cada 24 horas; protege `status` e `created_at` contra falsificação. A pessoa pode marcar sua própria obra pendente/aprovada como `withdrawal_requested`, nunca aprová-la.
- Imagens são decodificadas e reexportadas no navegador após consentimento; máximo 4096 x 4096. O bucket restringe MIME e tamanho, mas validação de conteúdo no servidor ainda não é completa: a moderação deve tratar arquivos recebidos como não confiáveis.
- Nenhuma obra é publicada automaticamente. A galeria continua vazia até receber arte real autorizada e aprovada.

## Administração: rotina obrigatória enquanto a publicação for manual

1. Abra o projeto `Cyber-Us Community` no Supabase Dashboard (nunca use chave service_role no GitHub ou no site). Em Database → SQL Editor, consulte a fila **sem incluir imagem em resultados públicos**:

```sql
select f.id, f.user_id, f.artist_name, f.title, f.region, f.show_region,
       f.artist_link, f.accent, f.image_path, f.created_at, f.status,
       (o.id is not null) as file_present
from public.fanart_submissions f
left join storage.objects o on o.bucket_id = 'fanart-pending' and o.name = f.image_path
where f.status in ('withdrawal_requested', 'pending')
order by (f.status = 'withdrawal_requested') desc, f.created_at asc;
```

2. **Retirada é prioritária.** Para `withdrawal_requested`, remova eventuais imagens publicadas do repositório e entradas da galeria, remova o arquivo privado via **Storage API ou Dashboard** (não dê `DELETE` diretamente em `storage.objects`), e só depois remova o registro ou finalize o pedido. Não marque a retirada como concluída antes de retirar as cópias.
3. Para `pending`, confira `file_present`; sem arquivo, não aprove: peça reenvio/limpe a reserva manualmente. Com arquivo, examine com cautela, confira autoria e conformidade com as regras, consentimento de exibição e campos publicáveis. Não use URLs públicas ou assinadas para mostrar pendências à galeria.
4. Para rejeitar, remova o arquivo do bucket privado pelo Dashboard/API e marque o registro como `rejected` (ou remova o registro caso adequado à política de retenção). Para aprovar, publique uma cópia revisada e autorizada no repositório público via processo editorial, confira crédito e região condicional, e altere `status` para `approved` **somente depois que a publicação real estiver pronta**. Não confunda o campo de status com um controle de segurança para arquivos públicos.
5. Revisite a fila com frequência e limpe arquivos pendentes sem registro, reservas sem upload e rejeições. Arquivos de Storage devem ser removidos pela API/Dashboard; apagar somente metadados via SQL não apaga bytes armazenados.
6. Moderação no site (`moderation-fanarts.js`) ainda serve para localizar/banir contas, não possui painel visual de revisão de imagens. Até essa interface existir, a revisão pelo Supabase Dashboard é manual.

## Limitações e verificações

- SQL aplicado e verificadas políticas RLS, bucket privado e permissões por coluna. Sem credenciais de uma conta de teste da comunidade, não foi possível realizar um envio real nem testar o fluxo ponta a ponta no navegador. Teste antes de divulgar amplamente a funcionalidade.
- O servidor limita MIME e bytes, mas não confirma cabeçalho/dimensões reais por conta própria; o navegador tenta isso antes de enviar. O moderador deve validar arquivos de forma segura antes de torná-los públicos.
- O upload pode falhar depois de criar uma reserva; essa reserva consome quota e precisa de limpeza administrativa. Não conceder `DELETE` direto aos usuários sem manter o contador antiabuso separado.
- Pedidos de retirada exigem ação manual da moderação; não há exclusão automática nem prazo garantido. Aviso de privacidade informa isso explicitamente.
- Monitorar o espaço gratuito no Supabase Storage; nenhuma assinatura ou serviço pago foi contratado por esta mudança.
- Testes futuros: email não confirmado, banimento, concorrência, upload inválido, upload interrompido, 4º envio em 24h, RLS com duas contas, ausência de leitura anônima, retirada de obra publicada, idiomas, teclado e celular.
