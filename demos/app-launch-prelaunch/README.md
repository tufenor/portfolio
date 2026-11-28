# NOVA — demonstração de pré-lançamento

Estudo conceitual independente para uma landing page de lançamento de aplicativo. A marca, a proposta do aplicativo e os dados exibidos são fictícios; isto não é um projeto contratado nem um case do cliente Workana.

## O que a demonstração mostra

- Página responsiva para celular e desktop.
- Área para apresentação em vídeo do aplicativo.
- Formulário de pré-cadastro com nome, e-mail, WhatsApp opcional e consentimento.
- Conteúdo principal editável em `content.js`.
- Animações discretas, navegação por teclado, menu móvel e respeito à preferência por movimento reduzido.

O formulário valida os campos no navegador e exibe uma confirmação demonstrativa. Ele não transmite, registra ou armazena dados. Para uma versão real, é preciso alinhar o destino autorizado dos dados, o aviso de privacidade, o vídeo, o conteúdo final, as credenciais do provedor e o domínio/hospedagem.

## Como adaptar o conteúdo

Edite `brand`, `eyebrow`, `heroLead`, `heroEmphasis` e `heroDescription` em `content.js`. Os demais textos estão no HTML. Antes de publicar uma versão real, substitua a identidade fictícia e confirme os dados do produto, a política de privacidade e as permissões das imagens.

## Imagens

Fotografias de referência servidas pelo Unsplash; os créditos aparecem na página. Substitua por fotos autorizadas pelo responsável do aplicativo quando o material estiver disponível.

## Arquivos

- `index.html`: conteúdo e marcação acessível.
- `styles.css`: layout responsivo.
- `content.js`: campos principais editáveis.
- `app.js`: menu, animações, modal de apresentação e simulação do formulário.
