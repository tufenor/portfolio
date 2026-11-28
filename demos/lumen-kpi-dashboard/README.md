# Lumen — painel de gestão

Estudo conceitual de dashboard para acompanhar faturamento, margem, pedidos, ticket médio, metas, canais e produtos. Foi produzido como demonstração independente; não representa um cliente, contrato nem experiência comercial anterior.

## O que dá para explorar

- Layout adaptável para desktop, tablet e celular.
- Alternância entre períodos de 7, 30 e 90 dias.
- Importação local de CSV com colunas obrigatórias `data`, `receita`, `margem` e `pedidos`; aceita também `canal` e `produto` para detalhamento.
- Edição local dos indicadores e meta, persistida apenas no navegador.
- Exportação CSV do resumo visível.
- Gráfico de faturamento, progresso de meta, canais e produtos.
- Navegação por teclado, foco visível, diálogo acessível e suporte a movimento reduzido.

## Dados, edição e limites

Todos os nomes, valores, produtos e séries iniciais são fictícios. O painel roda no navegador; a importação CSV é processada em memória e o arquivo não é enviado a um servidor. A edição manual fica em armazenamento local do navegador. Não possui login, banco de dados, atualização automática, integração com e-commerce/CRM, sincronização em nuvem ou métricas de negócio reais. Para transformar em painel de cliente, as definições de KPI, fontes, período, permissões e critérios de validação precisam ser acordados primeiro.

Para alterar os valores padrão, edite `BASE`, `CHANNELS` e `PRODUCTS` em `app.js`. O botão **Editar dados** permite testar alterações locais em tempo de execução; **Restaurar exemplo** retorna aos valores do estudo. Para CSV, use `;` ou `,` como separador e datas `AAAA-MM-DD` ou `DD/MM/AAAA`.

## Execução

Abra `index.html` em navegador moderno. A página usa Google Fonts quando há conexão; os fallbacks locais mantêm o conteúdo legível sem rede.
