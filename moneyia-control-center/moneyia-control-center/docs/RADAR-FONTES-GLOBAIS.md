# Radar global — catálogo de fontes

`data/global-sources.json` é um catálogo de fontes públicas e plataformas que podem ser avaliadas pelo radar. Ele não é uma lista de vagas abertas: cada entrada está marcada como `catalog_only` por este relatório e precisa de consulta pública individual antes de virar descoberta.

## Contrato de uma fonte

- `id`, `name` e URL oficial HTTPS identificam a fonte.
- `kind` descreve o tipo de canal (marketplace, emprego remoto, bounty, produto digital, QA ou pesquisa).
- `regions`, `languages` e `currencies` são filtros de elegibilidade; não provam que o titular pode se cadastrar ou receber.
- `discovery` informa onde a descoberta pública pode ocorrer; `cost` registra uma pendência/risco, sem autorizar gasto.
- A consulta de uma vaga deve criar um item em `data/opportunities-*.json` ou no radar com URL individual, data, orçamento, verificação, política de IA, payout e próximo passo.

## Regras de operação

1. `catalog_only` nunca conta como oportunidade, proposta, contratação ou receita.
2. Deduplicar por URL canônica e, quando não houver URL individual, por plataforma + título normalizado. Preservar `sources`, `evidence` e `duplicateCount`.
3. Não converter moedas automaticamente para somar valor. Registrar a moeda anunciada e verificar rota de recebimento separadamente.
4. Idioma da página não prova residência, fluência, elegibilidade ou país do cliente.
5. Bounties de segurança, concursos e repositórios só entram na fila de aprovação com escopo e autorização claros; não testar alvos sem permissão.
6. Nenhuma fonte autoriza cadastro, login, compra de créditos ou candidatura em massa. A Mesa continua sendo o gate humano.

O ranking técnico do radar mantém o score de demanda/encaixe/payout/concorrência/frescor e pode aplicar preferências explícitas de idioma e moeda com `rankOpportunities(rows, { languages, currencies })`. Isso apenas ordena a fila: não converte valores, não confirma elegibilidade e não muda o estado de candidatura.

## Auditoria local

Executar sem rede e sem alterar dados:

```powershell
node tools/audit-global-sources.mjs
```

O comando valida quantidade mínima de 100 fontes, IDs e URLs canônicas únicas, HTTPS e campos obrigatórios. A data de consulta de oportunidades permanece no item da oportunidade; o catálogo não deve ser interpretado como revalidação de anúncios.
