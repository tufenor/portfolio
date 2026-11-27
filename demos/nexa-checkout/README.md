# Nexa — checkout, acesso e painel

Estudo autoral de interface para um produto fictício de pagamentos. Não é trabalho de cliente, não usa transações reais e não processa credenciais ou pagamentos.

## Demonstração

Abra `index.html` em um navegador ou acesse a publicação pública no GitHub Pages. A navegação superior alterna entre três estados do produto: checkout, acesso e painel administrativo.

## Decisões de interface

- Resumo do valor e da renovação aparece antes da confirmação.
- Métodos de pagamento têm estados selecionados e ação de demonstração explícita.
- A tela de acesso reduz ruído e sinaliza os caminhos de recuperação/criação de conta.
- O painel separa métricas ilustrativas, período e atividade recente.
- Layout adapta-se a telas estreitas, navegação por teclado, foco visível e preferência por movimento reduzido.

## Implementação

HTML, CSS e JavaScript sem backend, dependências, rastreamento, armazenamento ou envio de formulário. Os valores e nomes do painel são fictícios. A carga tipográfica é opcional; o sistema mantém fallback local.

## Limites

Este material demonstra composição visual e interações de protótipo em código. Não representa arquivo Figma, integração de pagamentos, autenticação, análise real de conversão ou experiência em produção para cliente.
