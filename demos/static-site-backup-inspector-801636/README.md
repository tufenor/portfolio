# Static Site Backup Inspector — oportunidade 801636

Ferramenta demonstrativa em Python, sem dependências externas, para inspecionar uma pasta HTML estática ou ZIP de backup antes de restaurar o site em outro pacote de hospedagem.

## O que verifica

- Existência de um `index.html` na raiz.
- Arquivos HTML existentes no pacote.
- Referências locais em HTML (`href`/`src`) e `url(...)` em folhas CSS, para imagens, scripts, páginas e fontes de mídia.
- Links locais que apontam para arquivos ausentes.
- Caminhos perigosos em ZIP (absolutos ou com `..`), limite de 2.500 arquivos e máximo de 100 MB descompactados. O ZIP é lido sem extração e nada no pacote original é alterado.

## Uso

```bash
python inspect_backup.py examples/restored-site
python inspect_backup.py caminho/do-backup.zip --output relatorio.json
```

Código de saída 0 indica que há `index.html` e nenhuma referência local ausente. Um resultado diferente informa o item que precisa ser conferido; a ferramenta não modifica nem publica os arquivos.

## Casos demonstrativos

- `examples/restored-site/`: exemplo limpo, totalmente fictício.
- `examples/broken-site/`: inclui uma imagem referenciada que não existe, para demonstrar a detecção.

## Escopo do projeto real

O anúncio não inclui os arquivos do cliente, o painel do provedor nem o domínio; a correção e a publicação não podem ser verificadas sem o backup original, acesso/descrição do novo pacote e critério de aceite. Esta ferramenta é um diagnóstico independente, não um relato de entrega ao cliente.

