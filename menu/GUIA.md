# Menu Studio — guia rápido

## O que é
Página de menu digital de uma página, configurada por um único arquivo `data/config.json`.

## Como abrir
1. Publique a pasta em qualquer hospedagem estática (Netlify, Vercel, Cloudflare Pages) ou rode um servidor local:
   `npx serve .` ou `python -m http.server 8000`
2. Abra o endereço. O menu carrega sozinho.

Sem servidor, o navegador bloqueia a leitura do JSON. Nesse caso, a página pede para você selecionar o `config.json` manualmente — funciona, mas não é o modo recomendado.

## Como personalizar (10 minutos)
Abra `data/config.json` e edite:

- `brand.name` — nome do negócio
- `contact` — `mode` pode ser `whatsapp`, `email`, `url` ou `disabled`
  - whatsapp: preencha `whatsappNumber` com DDI + DDD + número, só dígitos
- `locales.pt` e `locales.es` — textos de capa, seção "a casa", horário e endereço
- `categories` — as categorias do menu
- `items` — cada item com nome, descrição, ingredientes, etiqueta e preço em cada idioma

Preços são números (ex.: `9`), sem símbolo e sem vírgula.

## Se não vender em espanhol
Pode deixar o espanhol como está ou remover o seletor de idioma em `index.html`
(procure `id="language"`). Remover o seletor não quebra o resto.

## Publicar no domínio do cliente
- Netlify Drop: arraste a pasta, publique, aponte o domínio.
- Cloudflare Pages ou Vercel: mesmo princípio.
- HTTPS é gratuito nas três.

## Limites
- Não processa pedidos nem pagamentos.
- Não tem painel administrativo; toda edição é no `config.json`.
- Uma página. Cardápio com muitas categorias continua funcionando, mas o layout é de página única.
