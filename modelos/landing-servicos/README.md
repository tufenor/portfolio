# Modelo de landing para serviços

Modelo estático, fictício e sem dependências externas. `config.json` é a fonte explícita do conteúdo: edite `brand`, `eyebrow`, `title`, `intro`, `ctaLabel`, `services` (lista de `number`, `title`, `text`), `faq` (lista de `question`, `answer`) e `contactNote`. Opcionalmente, `ctaUrl` aceita somente URLs `http`/`https` validadas; o template não usa formulário externo.

Abra `index.html` por um servidor local para permitir o `fetch` de `config.json`. A prévia importa a configuração e renderiza com `textContent`; se o JSON estiver inválido ou incompleto, mantém o conteúdo seguro de fallback. Isso é uma prévia editável, distinta de uma publicação de produção após aprovação do conteúdo.

QA: revisar em 320, 768, 1024 e 1440 px; navegar somente por teclado; testar foco, FAQ, formulário local e configuração inválida; conferir contraste e `prefers-reduced-motion`. Nenhum contato, dado pessoal, segredo, métrica ou promessa de cliente está incluído.
