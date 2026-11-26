# moneyIA — Mesa de aprovações

Aplicação local para o titular aprovar demandas do Codex, DeepSeek e ChatGPT, acompanhar tarefas e ver oportunidades recentes.

## Rodar

```powershell
node app/server.mjs
```

Abrir: http://127.0.0.1:8899

O servidor escuta apenas em `127.0.0.1`. Não exponha essa porta na rede.

## O que a tela faz

- Lista aprovações pendentes com origem, tipo, alvo, custo e arquivos.
- Aprovar/rejeitar grava a decisão em `data/aprovacoes.json`.
- Cria tarefas e muda o status em `data/tarefas.json`.
- Mostra as pendências humanas e as oportunidades recentes.
- Mostra cada proposta enviada e sua conferência de leitura na página individual. O agente confere ao iniciar o servidor e a cada 30 minutos, usando o Chrome de trabalho já aberto na porta 9333. O botão **Conferir** refaz uma proposta; **Conferir todas agora** refaz a fila. A evidência fica em `data/proposal-checks.json` e não altera `data/finance.json`.
- **Não executa** a ação aprovada. O agente responsável lê a decisão e age depois, dentro do escopo descrito.

## API para os agentes

Criar uma demanda:

```powershell
curl.exe -X POST http://127.0.0.1:8899/api/aprovacoes `
  -H "content-type: application/json" `
  -d "{\"source\":\"chatgpt\",\"title\":\"Publicar demo\",\"description\":\"Publicar no Pages\",\"actionType\":\"publicacao\",\"target\":\"tufenor/portfolio\",\"cost\":\"R$ 0\",\"files\":[\"site/demo/infoproduto-799111.html\"]}"
```

Listar estado:

```powershell
curl.exe http://127.0.0.1:8899/api/state
```

Criar tarefa:

```powershell
curl.exe -X POST http://127.0.0.1:8899/api/tarefas `
  -H "content-type: application/json" `
  -d "{\"title\":\"Revisar proposta\",\"assignee\":\"codex\",\"priority\":\"alta\"}"
```

## Expor em subdomínio

O subdomínio `moneyia.frequencygym.tech` **ainda não existe no DNS**. O domínio usa nameservers da Hostinger (`pixel.dns-parking.com` / `byte.dns-parking.com`), e o site principal está em outro servidor (`179.236.229.146`), não neste PC.

Para publicar com segurança, o caminho mais curto é **Cloudflare Tunnel**:

1. Instalar `cloudflared` no PC.
2. Autenticar na conta Cloudflare que controla o domínio (ou mover o DNS para Cloudflare).
3. Criar um tunnel para `http://127.0.0.1:8899`.
4. Criar o CNAME `moneyia` apontando para o tunnel.
5. Subir o app com autenticação:

```powershell
$env:MONEYIA_APP_HOST="127.0.0.1"
$env:MONEYIA_APP_USER="gabriel"
$env:MONEYIA_APP_PASSWORD="uma-senha-forte"
node app/server.mjs
```

O app agora exige **Basic Auth** quando `MONEYIA_APP_USER` e `MONEYIA_APP_PASSWORD` estão definidos. Sem essas variáveis, ele só aceita requisições de `127.0.0.1` e recusa qualquer acesso externo.

Não exponha a porta 8899 diretamente na internet. A API aprova ações; sem TLS e autenticação, qualquer pessoa na rede poderia decidir por você.

### Roteamento explícito da fila de propostas

As rotas `POST /api/proposal-dispatch/:id/retry` e `POST /api/proposal-dispatch/:id/forward` aceitam opcionalmente `{"providerId":"jarvis"}` (ou outro provedor configurado). Com `providerId`, a Mesa tenta somente esse agente e mostra a falha para nova decisão; sem o campo, usa a ordem de redundância configurada. Nenhum desses endpoints confirma envio externo: isso exige evidência verificável da plataforma em `/api/proposal-dispatch/:id/evidence`.

Alternativa: criar o registro no painel da Hostinger (hPanel → DNS) e apontar para um servidor com proxy reverso e certificado. Isso exige acesso ao DNS ou SSH do servidor principal, que eu não tenho.

## Versão mobile e híbrida

A mesma base funciona em três camadas:

1. **PWA** — `manifest.webmanifest` + `sw.js` + ícones. No desktop/localhost, o botão **Instalar** aparece no topo. Em celular, a instalabilidade exige HTTPS ou um domínio seguro; abrir `http://IP-DO-PC:8899` na Wi-Fi não basta para o service worker.
2. **Fila offline** — o último estado fica em `localStorage`; aprovações, rejeições e tarefas feitas sem rede entram em `moneyia-outbox-v1` e são reenviadas quando a conexão volta (ou pelo botão ⇅). Aprovações já decididas no servidor viram conflito e não são reaplicadas.
3. **Ponte local** — `app/bridge-agent.mjs` é o intermediário da Mesa. A fila e os rascunhos continuam no servidor mesmo quando ChatGPT, DeepSeek ou Gemini param. Em **Fila da IA**, use **Continuar localmente** para gerar um rascunho auditável e criar uma tarefa de revisão; **Tentar IA** repete o dispatch quando uma ponte externa estiver disponível. Consulte `GET /api/bridge/status` para o estado da continuidade.
4. **Propostas aprovadas** — a fila de aprovações prontas mostra o texto e a demo pública. **Aprovar e encaminhar** grava a decisão, cria `PD-xxx` em `data/proposal-dispatch.json` e uma tarefa para `deepseek`. O agente consulta `GET /api/proposal-dispatch?status=despachada_ao_agente`, assume uma tarefa com `POST /api/proposal-dispatch/:id/claim` e, somente depois de conferir a plataforma e devolver prova real, registra `POST /api/proposal-dispatch/:id/evidence` com `{ "evidence": "..." }`. O painel nunca transforma uma aprovação em “enviado” sem essa evidência.
   - Se um webhook do agente for configurado depois da aprovação, `POST /api/proposal-dispatch/:id/forward` reencaminha a fila sem alterar `sent`; o trabalhador externo ainda precisa conferir a plataforma e registrar a evidência. Quando apenas o Ollama local responde, o estado fica `aguardando_evidencia`: ele prepara o checklist, mas não é tratado como remetente externo nem entra em retry infinito.
5. **APK nativo** — o companion JARVIS tem a tela `MoneyIaScreen`, com consulta do resumo, aprovações e formulários para responder perguntas dos agentes. O APK debug é gerado em `github-improvements/jarvis/mobile-android/app/build/outputs/apk/debug/app-debug.apk`; a instalação e a abertura precisam ser verificadas no aparelho real.

6. **Fallback JARVIS para despachos** — quando `MONEYIA_AGENT_WEBHOOK_URL` não está configurado, o servidor encaminha aprovações de candidatura para `http://127.0.0.1:8080/api/moneyia/fallback` (ou para `MONEYIA_JARVIS_DISPATCH_URL`). O JARVIS devolve um checklist e a tarefa pode ser assumida com `POST /api/proposal-dispatch/:id/claim` usando `{ "agent": "jarvis" }`. Isso mantém o estado como execução local: o fallback não clica, não publica e não envia candidatura por si só; somente `/evidence` com prova da plataforma conclui o despacho como enviado confirmado.
7. **Preparação automática do Radar** — `POST /api/aprovacoes/auto-prepare` classifica as oportunidades verificadas, elimina duplicatas e cria até 30 pacotes por ciclo na Mesa. O trabalhador `tools/ia-bridge-worker.mjs` repete essa leitura a cada 30 minutos. O titular vê a demo, o preço e o texto prontos e usa **Aprovar e encaminhar**; a aprovação cria o despacho e a tarefa do agente, sem marcar envio externo antes de evidência.
8. **Redundância de agentes** — um despacho tenta os agentes disponíveis em ordem de preferência (ChatGPT, DeepSeek, Gemini, Ollama e JARVIS). Se a primeira ponte falhar, o próximo agente é tentado automaticamente; a Mesa também oferece **Tentar próximo agente** para despachos com erro. Isso encaminha o checklist ao agente, mas não transforma o resultado em candidatura enviada sem evidência na plataforma.
9. **Gmail somente leitura** — `GET /api/emails` mostra a última análise e `POST /api/emails/ingest` recebe mensagens pesquisadas pelo conector Gmail. O classificador separa possíveis aceites/respostas, novos projetos, mudanças de estado, segurança e ruído promocional; novas oportunidades viram tarefas de revisão com o link quando o corpo do e-mail o contém. Nenhuma mensagem é enviada, arquivada ou marcada como lida.
   - Com o Chrome de trabalho aberto no Gmail, `node tools/gmail-sync.mjs` coleta até 80 linhas visíveis via CDP 9333 e importa a análise. Se o Gmail não estiver aberto, o comando encerra sem alterar nada.
   - Para acompanhar continuamente, `node tools/email-watch.mjs --interval=30` repete a leitura a cada 30 minutos; `--once` executa um único ciclo. O verificador é somente leitura e deixa claro quando o Gmail precisa ser aberto.

10. **Radar global em modo seguro** — `POST /api/radar/runs` inicia uma leitura em sombra com até seis trabalhadores
públicos e um agregador local. `GET /api/radar/runs/:id` acompanha a execução, `GET /api/opportunities` permite filtrar
por país, idioma, moeda, payout e demanda, e `POST /api/radar/runs/:id/results` recebe resultados de uma fonte pública.
URLs são normalizadas e deduplicadas; cada item recebe score de demanda, encaixe, payout, concorrência e frescor.
O radar não troca IP, não usa proxy rotativo, não abre múltiplos logins e não resolve CAPTCHA/challenge.
   - `GET /api/browser/gates` lista login, confirmação de e-mail, KYC ou desafio detectado.
   - `POST /api/browser/gates/:id/complete` registra que o titular concluiu a etapa no navegador.
   - Gates pendentes iguais são deduplicados na interface por tipo e URL canônica; o histórico permanece preservado em `data/radar-gates.json`.
   - `POST /api/radar/runs/:id/resume` retoma a execução no mesmo run; uma sessão autenticada por plataforma é
     controlada serialmente por `POST /api/radar/sessions/acquire` e `/release`.
   - A Mesa sinaliza gates novos com alerta sonoro/vibração quando o navegador permitir e mantém as oportunidades em
     modo descoberta/qualificação; nenhum envio externo é inferido.
   - **Criar fila de envio** chama `POST /api/radar/send-queue` e prepara até 30 aprovações com demo, preço e texto
     para revisão visual. A aprovação individual cria o despacho do agente; somente evidência verificável da plataforma
     pode mudar o estado para envio confirmado.

O celular não enxerga `127.0.0.1:8899` do PC. Para uso real no telefone, o servidor precisa escutar na rede local (com token) ou a PWA precisa ser publicada em HTTPS. Isso ainda não está habilitado por segurança.

Para publicar a Mesa no mesmo VPS do Frequency, sem misturar os bancos, use o pacote `deploy/frequency/`. Ele prepara o subdomínio `moneyia.frequencygym.tech` atrás do Caddy e exige Basic Auth; a publicação efetiva depende do SSH/DNS do VPS.

## Enviar oportunidade para a IA

Cada oportunidade tem o botão **Enviar para IA**. O painel escolhe por padrão o **ChatGPT pago** e envia o prompt diretamente pela ponte configurada; o agente/provedor usado fica registrado em `data/ia-inbox.json`.

- **ChatGPT (preferido):** defina `MONEYIA_CHATGPT_DISPATCH_URL` (e, se precisar, `MONEYIA_AI_WEBHOOK_TOKEN`).
- **Fallback:** configure `MONEYIA_DEEPSEEK_DISPATCH_URL` ou `MONEYIA_GEMINI_DISPATCH_URL`. O seletor só considera uma IA disponível quando a ponte correspondente está configurada.
- **Fallback local automático:** se nenhum webhook externo estiver configurado, a Mesa consulta o Ollama local em `http://127.0.0.1:11434/api/tags`, escolhe `qwen3.5:4b` quando instalado (ou o primeiro modelo disponível) e envia o prompt a `/api/chat`. O retorno 2xx e o texto do modelo ficam registrados em `data/ia-inbox.json`.
- **Último fallback:** `MONEYIA_JARVIS_DISPATCH_URL` e `MONEYIA_JARVIS_HEALTH_URL` podem apontar para um conector do JARVIS; por padrão a ponte usa `http://127.0.0.1:8080/api/moneyia/fallback` e verifica `/api/saude` antes de encaminhar. Se o JARVIS não responder, o botão **Continuar localmente** mantém a fila sem fingir que ele respondeu.
- **Legado:** `MONEYIA_AI_WEBHOOK_URL` continua aceito como ponte do ChatGPT.
- **Sem ponte:** a oportunidade fica como `aguardando_ponte`, sem fingir que foi enviada. O seletor mostra os agentes e o estado da cota/conexão; não é necessário copiar prompt.

Para manter a análise contínua sem clicar item por item, execute `node tools/ia-bridge-worker.mjs`. Ele retira uma oportunidade pendente por ciclo e usa a mesma seleção automática da Mesa; `node tools/ia-bridge-worker.mjs --once` faz somente um item.

Formato do webhook: `POST` JSON `{ "type": "oportunidade_moneyia", "provider": "chatgpt", "item": { ... } }`. Resposta HTTP 2xx é a única evidência que muda o estado para `enviada`.

## Interação titular ↔ agentes

Agentes podem criar perguntas estruturadas para o painel/APK:

```powershell
curl.exe -X POST http://127.0.0.1:8899/api/agent-questions `
  -H "content-type: application/json" `
  -d '{"agent":"Aurora","title":"Qual nome do cliente?","prompt":"Informe o nome para preencher a proposta.","type":"text","field":"client_name","required":true}'
```

Tipos aceitos: `text`, `multiline`, `number`, `amount`, `code`, `choice`, `json` e `secret`. A fila pode ser lida em `GET /api/agent-questions` ou pelo estado geral em `GET /api/state`. O titular responde em:

```powershell
curl.exe -X POST http://127.0.0.1:8899/api/agent-questions/Q-001/answer `
  -H "content-type: application/json" -d '{"answer":"Titos Style","by":"titular"}'
```

Respostas normais ficam auditáveis na fila para o agente responsável. Respostas `secret` nunca são gravadas no JSON: para encaminhá-las, configure `MONEYIA_AGENT_WEBHOOK_URL` e, opcionalmente, `MONEYIA_AGENT_WEBHOOK_TOKEN`; sem webhook o servidor retorna `409` e descarta o conteúdo. Isso permite pedir nome, valor, código ou dados sem inserir credenciais no projeto.

O ChatGPT não é chamado diretamente: não há API/credencial configurada. O webhook é a ponte para um conector seu (Make, n8n, serviço próprio ou API oficial).

## Bot Telegram

O código está em `app/telegram-bot.mjs`. Ele **não cria a conta do bot**: isso é feito pelo titular no BotFather, com a conta Telegram dele.

1. No Telegram, abra `@BotFather`, envie `/newbot` e escolha um nome. Guarde o token.
2. Defina as variáveis no terminal (não no arquivo):

```powershell
$env:TELEGRAM_BOT_TOKEN="cole-o-token-aqui"
$env:TELEGRAM_CHAT_ID="seu-chat-id"
node app/telegram-bot.mjs
```

3. Se ainda não souber o chat id, rode só com o token, envie `/start` para o bot e ele responde com o id. Depois reinicie com `TELEGRAM_CHAT_ID`.

Atalho seguro no Windows: `scripts\start-telegram-bot.cmd` lê o token com entrada oculta e não grava em arquivo. Sem `TELEGRAM_CHAT_ID`, o bot só responde `/start` e `/id` para você descobrir o chat.

Comandos:

- `/status`
- `/aprovacoes`
- `/aprovar APR-002`
- `/rejeitar APR-002`
- `/tarefas`
- `/nova Texto da tarefa`
- `/oportunidades`
- `/id`

O bot só aceita decisões do chat configurado em `TELEGRAM_CHAT_ID`. Aprovar pelo Telegram grava a decisão com `decidedBy: telegram`.

## Arquivos

- `data/aprovacoes.json` — demandas e decisões.
- `data/tarefas.json` — fila de tarefas.
- `data/telegram-seen.json` — controle de notificações de aprovação.
- `data/telegram-seen-opps.json` — controle de notificações de oportunidades.

Nunca coloque o token do Telegram em arquivo versionado. Use variável de ambiente.
