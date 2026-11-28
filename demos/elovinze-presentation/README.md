# ELOVINZE — estudo de página de apresentação

Conceito independente baseado no escopo público do anúncio 99Freelas 801624. **Não é site oficial, trabalho contratado ou aprovação da ELOVINZE.** Marca e necessidade comercial foram citadas apenas para identificar a vaga; todo o restante é demonstração.

## Abrir

- `index.html`: página de apresentação responsiva.
- `card-preview.html`: fluxo conceitual de cartão digital, com destinos locais de demonstração. Nenhum formulário ou mensagem é enviado.
- `content.js`: textos, imagens e link do cartão ficam concentrados para facilitar substituições por conteúdo autorizado.

## Antes de uma entrega real

1. Substituir as imagens de referência por fotos da coleção com autorização de uso e atualizar o texto alternativo correspondente.
2. Confirmar texto institucional, catálogo vigente, público, contato e endereço real do cartão digital.
3. Atualizar `cardUrl` em `content.js` para abrir o cartão existente, sem recriá-lo; o link público da prévia continua apontando ao cartão demonstrativo.
4. Remover o aviso de estudo independente somente após autorização do cliente e aprovação final.
5. Definir hospedagem e domínio com o cliente; nenhum domínio, analytics, formulário, pixel ou integração de atendimento está incluído nesta prévia. O texto, imagens e URL do cartão são editáveis no `content.js`.

## Imagens de referência

Fotos servidas pelo Unsplash; a prévia mantém rótulos visíveis para substituição por material oficial:

- [sammy swae — estúdio de moda](https://unsplash.com/photos/a-woman-in-a-pinstripe-blazer-stands-by-clothing-rack-QA5Z9_oiR-M)
- [Vitaly Gariev — boutique e arara](https://unsplash.com/photos/woman-looks-at-clothing-on-a-rack-RDyW27_lK_g)
- [Polina Kuzovkova — roupas em arara](https://unsplash.com/photos/clothes-hanging-on-a-rack-in-a-boutique-pt3EBzQcxP0)
- [Romario Roges — ambiente de moda](https://unsplash.com/photos/a-woman-standing-in-front-of-a-rack-of-clothes-7EgaS5q3_eg)

## Referências de implementação

As decisões de layout usam navegação semântica, foco visível, botão de menu acessível, links claros, imagem alternativa, dimensões reservadas, lazy loading e respeito a `prefers-reduced-motion`, alinhadas às orientações de [Web Interface Guidelines da Vercel](https://github.com/vercel-labs/agent-skills/blob/main/skills/web-design-guidelines/SKILL.md).
