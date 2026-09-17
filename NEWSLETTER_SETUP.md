# Cyber-Us — newsletter: estrutura e próximos passos

Esta ramificação foi criada da `main` para **trabalhar só no esqueleto do site**. Ela é independente do PR #3 (comunidade e CAPTCHA), que continua em espera. Não integrar à `main` sem aprovação do autor.

## Entregue

- `index.html` e `style.css`: seção e chamada para a newsletter na página inicial, com link na navegação e no rodapé.
- `newsletter.html` e `newsletter.css`: página bilíngue PT/EN, responsiva, apresentando episódios, bastidores e notícias do projeto.
- Formulário de e-mail é **apenas uma prévia visual**, com campo e botão desativados e aviso explícito. Não há `action`, endpoint, gravação local, lista de inscritos, envio de e-mail nem confirmação falsa de cadastro.
- Nenhuma chave secreta, token, e-mail de leitor ou dado pessoal é armazenado neste código.

## Decisões antes de ativar inscrições

1. Escolher um provedor de newsletter com lista de contatos, ferramenta de envio e cancelamento de inscrição (por exemplo, Resend, Brevo ou outro após avaliação de limites e custos atuais). O projeto Supabase da comunidade não é, por si só, um serviço de entrega de newsletters.
2. Configurar um endereço/remetente autorizado e validar a entrega. Não inserir chave de API privada no HTML, JavaScript público ou repositório; usar integração segura no provedor ou endpoint server-side com validação e limites.
3. Implementar consentimento **específico e não pré-marcado** para a newsletter, política de privacidade antes da coleta, data/origem/versão do consentimento conforme necessário, confirmação do e-mail (double opt-in) e mecanismo funcional de cancelamento em cada mensagem. Não inscrever automaticamente contas da comunidade.
4. Permitir preferência de idioma PT ou EN no momento da inscrição e enviar apenas o conteúdo selecionado. Decidir frequência e conteúdo editorial antes de anunciá-los.
5. Aplicar proteção contra spam e abuso de cadastro; testar e-mails de confirmação, ausência de duplicidade, descadastro, erros, acessibilidade e mobile.
6. Só depois de conectar o serviço e concluir os testes substituir a prévia desativada por formulário funcional e solicitar aprovação explícita para publicar.

## Aceite da estrutura atual

- O link `#newsletter` aponta à seção da página inicial; a chamada abre `newsletter.html` por caminho relativo compatível com GitHub Pages em `/Cyber-Us/`.
- Página dedicada oferece troca PT/EN com `reader.js`, incluindo título, descrição, conteúdo, aviso e rótulos. O input desabilitado não coleta endereços.
- Layout responsivo sem dependência de backend ou bibliotecas externas; não interfere no leitor vertical das tiras nem no PR #3.
