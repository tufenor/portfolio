# Editabilidade das demos

Toda entrega comercial deve separar conteúdo de layout. O responsável precisa conseguir alterar, sem refazer o design:

- nome, descrição e chamada principal;
- serviços, preços, horários e perguntas frequentes;
- imagens e textos alternativos;
- links de WhatsApp, formulário, reserva ou checkout;
- cores e dados básicos da marca.

## Formato de entrega

Para um site estático, o primeiro marco inclui um arquivo de conteúdo (`conteudo.json` ou equivalente), nomes de campos claros e um guia curto com exemplos. Quando o cliente precisar editar pelo navegador, o escopo deve incluir um painel/admin ou CMS; isso é um marco separado até confirmar hospedagem, autenticação e fluxo de publicação.

Não considerar `localStorage` como publicação compartilhada: ele altera apenas o navegador que fez a edição. A edição pública precisa ser validada no ambiente real antes de ser prometida.
