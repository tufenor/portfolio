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
- detecção de gates de login/verificação sem tentar resolvê-los;
- pacote de publicação remota separado para um VPS com Caddy/HTTPS.

## O que foi deliberadamente removido

Os dados privados da operação não fazem parte deste snapshot: e-mails, URLs de
clientes, propostas reais, histórico financeiro, tokens, cookies, credenciais,
documentos, números de conta e arquivos de sessão foram excluídos. O portfólio
contém apenas casos e demos sanitizados.

## Executar localmente

```powershell
node app/server.mjs
```

Abra `http://127.0.0.1:8899`. Sem `MONEYIA_APP_USER` e
`MONEYIA_APP_PASSWORD`, o servidor aceita somente loopback. Para acesso remoto,
use `deploy/frequency/` e configure as credenciais no ambiente do servidor, não
no Git.

## Evidência

Uma resposta de IA ou uma tarefa criada não é prova de envio externo. A Mesa só
marca uma candidatura como confirmada quando recebe evidência verificável da
plataforma. Este snapshot não contém candidaturas nem receita.

Case público: https://tufenor.github.io/portfolio/case/moneyia-jarvis-bridge-2026-11-26.html
