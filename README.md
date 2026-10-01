# Cyber-Us — site oficial

Site estático bilíngue publicado em https://sketchcerberus.github.io/Cyber-Us/.

## Páginas e serviços

- Início, catálogo, seis páginas de leitura (PT/EN), extras e sobre o projeto.
- Leitor com descrição visual e transcrição da página em ambos os idiomas.
- Fanarts: galeria pública, filtros, envio por conta verificada, revisão, comentários e votos.
- Comunidade e moderação dependem do Supabase e das políticas documentadas em COMMUNITY_SETUP.md e FANARTS_SETUP.md.
- Newsletter usa formulário incorporado do Brevo; o formulário atual é português. A página inglesa explica como assinar.
- Apoio pelo Ko-fi e leitura externa no Tapas/WEBTOON. Os links apontam para as publicações oficiais.

## Verificação local

Requer Node.js. Execute `node scripts/preview.mjs` e abra http://localhost:4173/Cyber-Us/index.html.
Execute `node --test tests/*.test.mjs` para validar os fluxos existentes e as regressões.
O servidor local não publica o site e não permite acessar arquivos internos do projeto.

## Manutenção

Confira SITE_STATUS.md para prioridades editoriais e integrações pendentes.
Use Oeté e Malware na interface. A tag histórica Óete permanece como chave de armazenamento para compatibilidade com o banco; sua apresentação e busca usam Oeté.
A transcrição preserva o texto publicado, inclusive grafias antigas nas imagens. Os originais JPEG permanecem disponíveis; o leitor usa WebP sem perda quando o arquivo é menor.

O cliente de autenticação compartilhado está em supabase-client.js. Novos módulos devem usar `window.CyberUsGetClient()` após carregar o SDK; não criar clientes adicionais.

Os metadados públicos e sitemap.xml referenciam o endereço oficial. Atualize o sitemap quando publicar páginas. robots.txt está no subdiretório do projeto; buscadores aplicam regras robots no domínio raiz. Páginas de conta e moderação têm noindex individual.

Publicação continua pelo fluxo existente do GitHub Pages. Revise as alterações antes de integrá-las na branch publicada.
