# Pausa — guia de entrega

Pausa é a marca fictícia do cardápio demonstrativo Menu Studio. A capa leva ao menu. Busca e categorias conduzem à consulta de itens, descrições e preços. O seletor altera o conjunto de textos e a moeda de demonstração.

## Identidade

| Papel | Claro | Escuro |
|---|---|---|
| Papel | #F6F3EB | #191F1B |
| Superfície | #FFFDF7 | #242D26 |
| Texto | #253128 | #F3F0E6 |
| Ação | #304D37 | #C5D7A9 |
| Foco | #A64E33 | #EDB092 |

Georgia nos títulos e uma fonte sem serifa no texto corrido. A ilustração da xícara e os ícones de categorias ficam em SVG. Exporte imagens para o tamanho em que serão exibidas e preserve as descrições de imagens relevantes.

## Implementação de referência

- Demonstração em [HTML](../../menu/).
- Estilos e regras responsivas em [styles.css](../../menu/styles.css).
- Interação em [app.js](../../menu/app.js).
- Ilustração de capa em [coffee-scene.svg](../../menu/assets/coffee-scene.svg).
- Definições dos ícones em [menu-icons.svg](../../menu/assets/menu-icons.svg).
- Conteúdo fictício em [data/config.json](../../menu/data/config.json).

## Critérios de entrega

1. No celular, posicionar texto e ação antes da ilustração. No desktop, manter a relação entre as duas colunas.
2. Testar menu, busca, idioma e tema por teclado e toque. O filtro ativo e o resultado vazio precisam ter indicação textual.
3. Conferir o tamanho dos textos com exemplos longos em português e espanhol. Manter o nome e preço legíveis, mesmo quando o item quebra linha.
4. Inserir os conteúdos aprovados, revisar ingredientes e preços e ligar o canal de contato do negócio. A configuração fictícia vem com contato desativado.
5. Validar o link final e os arquivos entregues em celular e desktop.
