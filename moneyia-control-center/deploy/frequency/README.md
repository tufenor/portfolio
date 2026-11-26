# MoneyIA no mesmo VPS do Frequency

Este pacote publica a Mesa em `https://moneyia.frequencygym.tech`, separada do
aplicativo e do banco do Frequency. O serviço usa HTTPS pelo Caddy e Basic Auth
no próprio MoneyIA. A porta 8899 não fica exposta na internet.

## Pré-requisitos

- acesso SSH ao VPS que hospeda o Frequency;
- DNS para criar `moneyia.frequencygym.tech` apontando para o mesmo IP;
- o Caddy do Frequency e o serviço `moneyia` na mesma rede Docker;
- valores de `MONEYIA_APP_USER` e `MONEYIA_APP_PASSWORD` definidos no ambiente
  do VPS, nunca neste repositório.

## Publicação

1. Copie o repositório para `/opt/moneyia` sem incluir `.env`, tokens, chaves,
   documentos ou dados bancários.
2. Faça backup do estado remoto antes da primeira cópia:
   `/opt/moneyia-backups/<data>/data`.
3. Adicione `compose.moneyia.yml` ao compose de produção do Frequency (ou
   execute-o como projeto separado na rede externa do Caddy).
4. Inclua `Caddyfile.moneyia.snippet` no Caddyfile existente.
5. Crie o registro DNS `A moneyia <IP_DO_VPS>` e aguarde a propagação.
6. Recrie somente o serviço MoneyIA e valide:

   - `https://moneyia.frequencygym.tech/` pede Basic Auth;
   - `/api/health` responde `ok:true` depois da autenticação;
   - `/api/state` mostra os dados da fila sem expor a porta 8899;
   - o Frequency principal continua respondendo em `/app`;
   - a fila, aprovações e tarefas persistem após reiniciar o container.

O deploy não publica candidaturas, não configura KYC e não envia mensagens.
Ele apenas torna a Mesa acessível remotamente com autenticação. O estado local
deve ser revisado antes de ser copiado para o VPS, pois `data/` contém o funil
privado da operação.

## Verificação pós-deploy

Use `curl -u "$MONEYIA_APP_USER:$MONEYIA_APP_PASSWORD"` somente no VPS ou em
uma máquina confiável. Não coloque a senha na URL, no Git ou no chat.
