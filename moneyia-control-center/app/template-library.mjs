const portfolio = 'https://tufenor.github.io/portfolio';
const sources = 'https://github.com/tufenor/portfolio/tree/main';

export const templates = [
  {
    id: 'menu-studio',
    name: 'Menu Studio · cardápio digital',
    description: 'Cardápio responsivo em português e espanhol, com conteúdo separado em JSON.',
    exampleUrl: `${portfolio}/menu/`,
    sourceUrl: `${sources}/menu`,
    editable: ['Marca e idiomas', 'Categorias, itens e preços', 'Contato e informações da loja'],
    whenToUse: 'Cardápios, cafés e restaurantes que precisam publicar e atualizar preços sem mudar o código.',
    checks: 'Abrir as categorias e conferir valores, idioma, contraste e links no celular.'
  },
  {
    id: 'landing-servicos',
    name: 'Landing de serviços',
    description: 'Página responsiva de serviço com visualização local dos dados editados antes da publicação.',
    exampleUrl: `${portfolio}/modelos/landing-servicos/`,
    sourceUrl: `${sources}/modelos/landing-servicos`,
    editable: ['Identidade e imagem', 'Serviços e perguntas frequentes', 'Chamada para ação'],
    whenToUse: 'Página institucional ou campanha de um serviço com uma ação principal.',
    checks: 'Conferir CTA, conteúdo editado, navegação por teclado e larguras móveis. Revisar a origem das imagens.'
  },
  {
    id: 'proposta-studio-landing',
    name: 'Proposal Studio · landing/web',
    description: 'Demo editorial de landing responsiva, com narrativa visual, transições e blocos de conversão editáveis.',
    exampleUrl: `${portfolio}/modelos/proposta-studio/?modelo=landing`,
    sourceUrl: `${sources}/modelos/proposta-studio`,
    editable: ['Marca e proposta de valor', 'Seções e chamadas', 'Paleta, números ilustrativos e CTA'],
    whenToUse: 'Landing pages, sites institucionais e páginas de serviço que precisam de uma demonstração visual antes da contratação.',
    checks: 'Abrir em celular e desktop, conferir contraste, navegação e os rótulos de conteúdo ilustrativo.'
  },
  {
    id: 'proposta-studio-automacao',
    name: 'Proposal Studio · automação/IA',
    description: 'Demonstração de fluxo de entrada, processamento, revisão e saída para automação ou agente de IA.',
    exampleUrl: `${portfolio}/modelos/proposta-studio/?modelo=automacao`,
    sourceUrl: `${sources}/modelos/proposta-studio`,
    editable: ['Etapas do fluxo', 'Entradas e saídas', 'Critérios de revisão e métricas ilustrativas'],
    whenToUse: 'Automação, Python, APIs, agentes e produtos de IA que precisam explicar o primeiro marco de entrega.',
    checks: 'Conferir estados de falha, revisão humana, responsividade e clareza do primeiro marco.'
  },
  {
    id: 'proposta-studio-uxui',
    name: 'Proposal Studio · UX/UI',
    description: 'Case conceitual de interface com hierarquia, componentes, responsividade e entrega documentada.',
    exampleUrl: `${portfolio}/modelos/proposta-studio/?modelo=uxui`,
    sourceUrl: `${sources}/modelos/proposta-studio`,
    editable: ['Tela/problema principal', 'Componentes e jornadas', 'Cores, protótipo e critérios de QA'],
    whenToUse: 'Redesign, UX/UI, Figma, auditoria de interface ou correções de experiência mobile.',
    checks: 'Conferir hierarquia visual, estados, mobile, acessibilidade e escopo entregue.'
  },
  {
    id: 'pausa-handoff',
    name: 'Pausa · referência de UX e handoff',
    description: 'Guia e capturas públicas de um exercício de UI. O guia descreve como reproduzir as decisões de design.',
    exampleUrl: `${portfolio}/case/pausa-handoff.html`,
    sourceUrl: `${portfolio}/assets/pausa-handoff/guia.md`,
    editable: ['Paleta e tipografia', 'Componentes e hierarquia', 'Layout mobile'],
    whenToUse: 'Auditoria de interface, prototipação ou documentação para implementação.',
    checks: 'Comparar desktop e celular. Registrar componentes, estados, espaçamento e teste de teclado.'
  }
];

export function matchingTemplate(topic) {
  if (/cardapio|\bmenu digital\b/.test(topic)) return templates[0];
  if (/automat|\b(?:api|backend|n8n|python|playwright|chatbot|ia)\b/.test(topic)) return templates[3];
  if (/figma|handoff|wireframe|auditoria (?:ux|de interface)|\bux\b|\bui\b|interface/.test(topic)) return templates[4];
  if (/\blanding\b|site institucional|pagina de servico|\bsite\b|\bweb\b/.test(topic)) return templates[2];
  if (/\b(?:shopify|wordpress|elementor|woocommerce)\b|e-commerce/.test(topic)) return null;
  return null;
}
