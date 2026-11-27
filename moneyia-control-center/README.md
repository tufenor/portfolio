# MoneyIA — Control Center (código público sanitizado)

Este diretório é uma cópia pública e reduzida do núcleo do MoneyIA: uma Mesa
local para organizar oportunidades, demos, aprovações, agentes, pendências
humanas e evidência de entrega.

## O que está incluído

- servidor Node sem dependências externas obrigatórias;
- interface responsiva para aprovações, tarefas, Radar e agentes;
- fila persistente com estados separados para descoberta, proposta, despacho e
  evidência externa;
- fallback local e roteamento explícito de provedores;
- ingestão de alertas com chave idempotente para não criar tarefas repetidas para a mesma mensagem;
- detecção de gates de login/verificação sem tentar resolvê-los;
- pacote de publicação remota separado para um VPS com Caddy/HTTPS.

## O que foi deliberadamente removido

Os dados privados da operação não fazem parte deste snapshot: e-mails, URLs de
clientes, propostas reais, histórico financeiro, tokens, cookies, credenciais,
documentos, números de conta e arquivos de sessão foram excluídos. O portfólio
contém apenas casos e demos sanitizados.

## Executar localmente

O front React/TypeScript fica em `app/frontend/src/`; os arquivos compilados
ficam em `app/public/assets/`. Para reconstruir a interface:

```powershell
cd app/frontend
npm ci
npm run build
cd ../..
```

Para abrir a Mesa:

```powershell
node app/server.mjs
```

As rotinas Python consultam a saúde da Mesa, consolidam o feed público e podem
preparar até 30 pacotes por ciclo para revisão visual. No Windows, o ciclo roda
a cada 30 minutos pelo Agendador de Tarefas e pode consultar o Gmail em modo
somente leitura. Ele não envia propostas. Use
`python tools/moneyia_automation.py cycle --with-email --prepare-queue --queue-limit 30`
para executar a rotina; `python tools/collect_public_opportunities.py` atualiza
o cache público do Remotive, que é distribuído com atraso.

A ponte assíncrona `codex-bridge-export` / `codex-bridge-import` conecta a fila
local ao worker GPT-5.6 Luna agendado no Codex. A assinatura do ChatGPT é usada
pela automação do Codex; nenhuma chave de API é exigida. O importador só aceita
IDs do lote exportado, limita o lote a 30, trata repetição sem duplicar tarefas
e remove o arquivo temporário após sucesso. Veja `docs/BRIDGE-CODEX-ASSINCRONA.md`.

Abra `http://127.0.0.1:8899`. Sem `MONEYIA_APP_USER` e
`MONEYIA_APP_PASSWORD`, o servidor aceita somente loopback. Para acesso remoto,
use `deploy/frequency/` e configure as credenciais no ambiente do servidor, não
no Git.

Este snapshot inicia com filas vazias. Rotinas operacionais que dependem de
dados privados ou scripts não publicados precisam ser ligadas a fontes próprias
antes de executar seus botões; o código público serve como demonstração da
arquitetura e da interface, não como uma conta pronta para trabalhar.

## Evidência

Uma resposta de IA ou uma tarefa criada não é prova de envio externo. A Mesa só
marca uma candidatura como confirmada quando recebe evidência verificável da
plataforma. Este snapshot não contém candidaturas nem receita.

Case público: https://tufenor.github.io/portfolio/case/moneyia-jarvis-bridge-2026-11-26.html
Case de automação Python: https://tufenor.github.io/portfolio/case/moneyia-python-cycle-2026-11-27.html
Case da ponte assíncrona: https://tufenor.github.io/portfolio/case/moneyia-codex-bridge-2026-11-27.html
Case de triagem de pagamentos por e-mail: https://tufenor.github.io/portfolio/case/moneyia-email-attribution-2026-11-27.html
