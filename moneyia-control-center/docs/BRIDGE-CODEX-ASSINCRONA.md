# Ponte assíncrona Codex ↔ Mesa

## Como funciona

O Agendador do Windows continua cuidando do ciclo Python da Mesa e da leitura permitida do feed. A automação local recorrente do Codex usa a assinatura ChatGPT do titular, exporta até 30 análises pendentes pela API local, produz respostas e as importa pelo endpoint da Mesa. Nenhuma chave da API OpenAI é necessária para usar a assinatura do ChatGPT.

```powershell
python tools/moneyia_automation.py codex-bridge-export --queue-limit 30
# O worker analisa cada item e grava um array JSON temporário em data/codex-bridge-responses.json.
python tools/moneyia_automation.py codex-bridge-import --responses-file data/codex-bridge-responses.json
```

O importador só aceita IDs presentes na última exportação, limita cada lote a 30 respostas e cada resposta a 10.000 caracteres. Respostas repetidas são idempotentes; não criam tarefa duplicada nem substituem a primeira resposta. Após importação bem-sucedida, o arquivo temporário é removido. O estado do worker fica em `data/codex-bridge-status.json`, e a Mesa expõe `/api/codex-bridge/status`.

## Estados e disponibilidade

- A fila local persiste enquanto o agente está indisponível.
- A ponte mostra o GPT do Codex como agente assíncrono, não como endpoint HTTP em tempo real.
- Um ciclo sem itens fica `idle`; um lote importado fica `processed`; uma falha de conexão preserva pendências e registra erro.
- O estado do Codex perde validade após uma hora sem ciclo.
- O Ollama só é contado como disponível quando há memória livre suficiente e uma inferência curta retorna texto. A mera presença do modelo em `/api/tags` não basta.
- O JARVIS continua sendo verificado separadamente; o worker Codex não mascara a indisponibilidade dele.

## Verificação manual

```powershell
node --check app/server.mjs
node --check app/ai-router.mjs
python -m py_compile tools/automation/codex_bridge.py tools/moneyia_automation.py
python tools/moneyia_automation.py codex-bridge-export --queue-limit 1
```

A API local deve estar em `http://127.0.0.1:8899`. `codex-bridge-export` lê até 30 itens; `codex-bridge-import` só grava respostas para IDs que acabaram de ser exportados. Envio de proposta e comunicação com cliente não fazem parte da ponte.

## Escolha técnica

Foi consultada a documentação Vercel de workflows duráveis: ela recomenda etapas persistentes, espera sem consumo e retries com idempotency keys. Esse padrão foi aplicado à fila local por estado persistente e importação idempotente, sem migrar a Mesa para Vercel nem criar custo de hospedagem. A busca correspondente no repositório público `vercel/workflow` não trouxe skill de integração mais adequada ao worker local atual.
