# Tags de fanarts

O formulário publica as tags permitidas junto com a submissão. A galeria consulta obras publicadas no Supabase, em lotes de 100, e oferece Carregar mais.

Busca por artista, título e tags ignora caixa e acentos. Várias tags selecionadas devem coincidir; os filtros permanecem ao carregar mais obras. A busca cobre as obras já carregadas. O estado vazio e falhas de carregamento têm mensagens próprias.

A interface traduz os rótulos PT/EN. A chave de banco `Óete` é exibida como `Oeté` e ambas as grafias são reconhecidas na busca, para preservar obras antigas e as restrições existentes do banco. Malware é a grafia oficial.

Os testes em tests/fanarts-tags.test.mjs cobrem a grafia, traduções, paginação, filtros combinados, estados vazios e falhas. Nunca inventar artistas ou obras para preencher a galeria.
