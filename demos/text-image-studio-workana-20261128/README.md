# Pausa Studio — demonstração de composição social

Protótipo público independente criado para demonstrar um fluxo enxuto de inserção e otimização visual de texto em imagens. Marca e conteúdo são fictícios.

## O que funciona

- edição imediata do texto e do nome da marca;
- formatos Story (9:16), Retrato (4:5) e Quadrado (1:1);
- alinhamento e três paletas;
- upload local de imagem e exportação PNG no navegador;
- sugestões de texto predefinidas, identificadas como locais (sem modelo de IA conectado).

## Como editar

Abra `index.html` e altere a marca, textos, paletas e proporções. Para uma integração real, definir modelo/provedor, limites de uso, revisão e tratamento de dados antes de conectar qualquer API.

## Privacidade e imagem

A foto local escolhida permanece no navegador durante a demonstração; não há formulário, backend ou envio de conteúdo. A foto de exemplo é de [Ela De Pure no Unsplash](https://unsplash.com/photos/four-facial-serum-bottles-on-table-_VvyAsNyUdc), sob a licença Unsplash. A exportação da foto de exemplo depende da política CORS do provedor; uma imagem carregada pelo usuário pode ser exportada sem essa dependência.

## Limites

Esta página demonstra layout, composição, edição e exportação. Não implementa geração de texto por IA, análise visual, autenticação, armazenamento ou processamento de lotes.

