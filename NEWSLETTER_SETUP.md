# Newsletter — PT/EN

A página newsletter.html usa dois formulários oficiais do Brevo e acompanha o seletor de idioma do site. newsletter-embed.js atualiza o iframe e o link de abertura externa somente quando o idioma muda.

## Configuração existente

- PT: formulário Transmissão de Cyber-Us; lista Transmissão de Cyber-Us; confirmação dupla original.
- EN: formulário Cyber-Us Transmission — English (6abdc37e1967dbb27a6a405c); lista exclusiva Cyber-Us Transmission — English; modelo ativo #5, Cyber-Us — Confirm subscription (English).
- Formulário, ajuda, botão, validação, erros, sucesso e e-mail de confirmação traduzidos. O link de confirmação mantém a variável oficial `{{ doubleoptin }}`.
- Inscritos só entram na lista após confirmar o e-mail. Novos envios em inglês devem usar a lista inglesa; nenhuma campanha é enviada pelo código do site.
- Trocar de idioma carrega o outro formulário; dados digitados no formulário anterior não são transferidos. Com JavaScript desativado permanece o formulário português com link externo.

## Verificação

Conferir o iframe e o link externo em ambos os idiomas, teclado, largura móvel, mensagens do formulário e vínculo da confirmação no painel. Não cadastrar e-mails reais sem autorização. A entrega e o clique de confirmação ainda dependem de um teste com destinatário autorizado.

O remetente existente foi mantido. Não houve alteração de domínio, credenciais, CAPTCHA, lista portuguesa, assinaturas existentes ou plano. Não inserir chaves de API no site ou repositório.
