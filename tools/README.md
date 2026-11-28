# Auditor público de demos MoneyIA

Ferramenta Python independente para conferir páginas de demonstração publicadas e os recursos locais que elas referenciam.

## Uso

No checkout do projeto MoneyIA:

```powershell
python tools/portfolio_public_audit.py --source data/demos.json --output data/public-demo-audit.json
```

Para verificar URLs específicas:

```powershell
python tools/portfolio_public_audit.py --url https://tufenor.github.io/portfolio/demos/cafe-plaza-specialty-coffee-cafe/
```

O relatório registra horário, status HTTP das páginas e ativos locais, e a contagem de falhas. O verificador usa somente leitura HTTP no host público do portfólio; não envia formulários nem acessa contas. Arquivos de terceiros e interações executadas no navegador ficam fora do escopo.
