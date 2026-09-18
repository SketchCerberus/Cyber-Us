# Cyber-Us // Fanarts — estrutura e requisitos para lançamento

Esta branch implementa **somente o esqueleto visual** da galeria. Não publicar nem integrar à `main` sem autorização explícita. A implementação é independente do PR #3 (comunidade), que permanece em pausa, e não altera Supabase, newsletter, armazenamento ou serviços pagos.

## O que está pronto

- Página `fanarts.html` + `fanarts.css` bilíngue PT/EN e responsiva, com estado vazio verdadeiro, sem obras, artistas ou países fictícios. Os três quadros numerados são decoração de espaços futuros, não amostras reais.
- Chamada e link `fanarts.html` na página inicial, na navegação e no rodapé (alterações em `index.html` e `style.css`). Links relativos funcionam no GitHub Pages em `/Cyber-Us/`.
- Prévia de formulário **inteiramente desativada**: nome artístico, título, país/região opcional, autorização específica para exibir país, arquivo, link do artista e declaração de permissão da arte. Nenhum formulário é enviado, nenhum arquivo é carregado nem qualquer dado é armazenado.
- Idiomas via `reader.js` na página da galeria, usando os mesmos atributos PT/EN das páginas existentes. A página inicial conserva seu `script.js`.

## País ou região: escolha do próprio artista

- Campo opcional, nunca obrigatório para enviar arte. A opção padrão deve ser **“Prefiro não informar”**; só renderizar publicamente o país/região após escolha afirmativa e consentimento separado para exibição.
- Representa **localidade autodeclarada**, não nacionalidade, etnia ou verificação de origem. Não derivar automaticamente de IP, geolocalização, perfil de terceiros ou e-mail. Não coletar cidade, endereço, coordenadas ou IP para esse recurso.
- Quando implementado, usar lista completa e acessível de países/regiões, com identificadores padronizados e nomes traduzidos PT/EN. Permitir edição, retirada da opção pública e remoção mediante pedido. Sem bandeira automática ou placar de países.
- Não revelar por padrão o país de pessoas que já possuem contas na comunidade; a escolha deve ser feita especificamente para cada arte ou por configuração explicitamente confirmada pelo artista.

## Antes de aceitar arquivos e publicar fanarts

1. Revisar regras de conteúdo e direitos autorais: obra original ou com autorização; esclarecer licença limitada de exibição no site sem transferência de propriedade; crédito, política para IA se desejada, remoção, denúncia e recurso.
2. Publicar aviso de privacidade claro: campos públicos, uso dos arquivos, retenção, acesso e exclusão. Definir processo de apagar arte e desvincular país quando solicitado.
3. Vincular ao login real da comunidade **somente quando PR #3 estiver aprovado e seguro**; checar banimentos e papéis no servidor, não apenas no navegador. Não abrir endpoint público de envio anônimo por engano.
4. Criar armazenamento privado de envios pendentes, moderação obrigatória antes de expor imagem ou metadados; política de leitura que divulga apenas obras aprovadas. Evitar URLs previsíveis que contornem a revisão.
5. Validar tamanho, dimensões e tipo real do arquivo no servidor, limitar formatos e frequência, remover metadados EXIF e gerar versões seguras para exibição. Implementar limites antiabuso, quotas e política de limpeza de arquivos rejeitados.
6. Exibir título, nome de artista e link externo de forma segura; escapar texto e validar URLs HTTPS. Denúncias, retirada por direitos autorais, exclusão e logs de moderação não devem divulgar dados privados.
7. Testar PT/EN, acessibilidade, leitura por teclado, celular, consentimento de país, envios rejeitados, tentativas de acesso a obras pendentes, denúncias, bloqueio de usuários banidos e recuperação de falhas.
8. Checar limites e custos do armazenamento e de qualquer processamento adicional antes de contratar serviços; pedir aprovação expressa para gastos e para fazer o merge.

## Critérios de aceite do esqueleto atual

- O link da home abre `fanarts.html`; o link para o catálogo retorna corretamente.
- Todos os textos importantes mudam PT/EN sem destruir elementos internos do HTML.
- A galeria informa honestamente que não há obras, e o formulário não envia nada. Campo de país e consentimento de exibição são opcionais e desativados.
- Nenhuma arte ou origem foi inventada, nem foi efetuada alteração no PR #3, banco de dados ou site publicado.
