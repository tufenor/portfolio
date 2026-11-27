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
  if (/\b(?:shopify|wordpress|elementor|woocommerce|api|backend|n8n)\b|e-commerce/.test(topic)) return null;
  if (/\blanding\b|site institucional|pagina de servico/.test(topic)) return templates[1];
  if (/figma|handoff|wireframe|auditoria (?:ux|de interface)/.test(topic)) return templates[2];
  return null;
}
