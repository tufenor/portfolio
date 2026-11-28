# Casa Brava — painel de operação (estudo de interface)

Protótipo independente de um painel responsivo para acompanhar lotes, produção, estoque, pedidos e clientes de uma fábrica de bebidas. Criado para demonstrar um primeiro recorte de interface para o anúncio público **“Controle e operação de fábrica de drinks” (99Freelas 801591)**.

## O que é possível explorar

- Navegação entre visão geral, produção, estoque, pedidos, clientes e relatórios.
- Indicadores, programação de lotes, níveis de estoque e estados de expedição com dados inteiramente fictícios.
- Busca de pedidos, exportação de CSV e inclusão local de pedido de demonstração.
- Edição local do nome da unidade e da meta de produção; o responsável consegue trocar os textos editando `app.js` ou pela interface de demonstração.
- Layout adaptável para celular, tablet e desktop; foco visível, navegação por teclado, aviso de demonstração e movimento reduzido.

## Limites do protótipo

“Casa Brava”, nomes, produtos, clientes, quantidades, prazos e indicadores são fictícios. A interface não é de um cliente nem está contratada. Não há backend, autenticação, banco de dados, integração de API, controle de lote legal/sanitário, comunicação com fornecedores ou atualização em tempo real. As alterações ficam no `localStorage` do navegador. A exportação CSV usa apenas os dados exibidos no exemplo.

O anúncio pede um sistema mais amplo e integração com as APIs do cliente. Esta demonstração comprova apenas uma proposta visual de interface; a integração deve ser estimada depois de conhecer a documentação, os endpoints, os papéis de acesso e o modelo de dados existentes.

## Executar

Abra `index.html` em um navegador moderno. Não há build nem dependências de pacote. As fontes Google usam fontes locais do sistema como fallback.

