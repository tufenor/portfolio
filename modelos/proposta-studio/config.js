/*
 * Troque textos, cores e listas aqui. O URL aceita ?modelo=landing,
 * ?modelo=automacao ou ?modelo=uxui — útil para ligar uma proposta ao conceito
 * correspondente sem criar uma cópia do código.
 */
window.StudioConfigs = {
  landing: {
    label: 'Landing & web',
    accent: '#d87845',
    accentSoft: '#f5d6c4',
    image: 'https://images.unsplash.com/photo-1558655146-9f40138edfeb?auto=format&fit=crop&w=1600&q=85',
    imageAlt: 'Mesa de trabalho com interfaces e materiais de design',
    focus: 'para uma página que deixa o próximo passo óbvio.',
    summary: 'Um conceito editorial para transformar uma oferta dispersa em uma página rápida, clara e pronta para edição posterior.',
    scopeShort: 'Página responsiva com uma jornada principal',
    workStyle: 'Estrutura, conteúdo, teste mobile e guia',
    editableNote: 'Textos, imagens, CTAs e seções documentados',
    canvasKicker: 'PÁGINA QUE CONDUZ',
    canvasTitle: 'Mensagem, prova e ação na ordem certa',
    canvasDetail: 'A hierarquia vem antes da decoração: a pessoa entende onde está e o que fazer em poucos segundos.',
    route: [
      ['01', 'Recorte do objetivo', 'Organizar oferta, público e uma ação principal antes de abrir o editor.'],
      ['02', 'Direção visual', 'Definir ritmo, contraste e imagens que servem ao conteúdo — não apenas preenchem espaço.'],
      ['03', 'Construção responsiva', 'Montar blocos reutilizáveis e testar navegação, leitura e CTA em telas pequenas.'],
      ['04', 'Entrega que continua', 'Publicar com código, estrutura de edição e uma checagem final de links.']
    ],
    showcase: 'A prévia combina uma primeira dobra objetiva, módulos de confiança e um CTA presente sem competir com o conteúdo.',
    checks: ['Leitura confortável em celular', 'Chamadas para ação com destino explícito', 'Seções e conteúdo fáceis de reorganizar'],
    preview: { url: 'oferta.exemplo', badge: 'PÁGINA PRINCIPAL', title: 'Uma mensagem que chega inteira.', subtitle: 'O visitante entende o serviço, encontra prova e escolhe o próximo passo.', rows: ['Oferta em uma frase', 'Benefício que cabe na rotina', 'CTA com contexto'] },
    edits: ['Textos da oferta', 'Foto principal e galeria', 'Botões e links', 'Serviços e faixas de preço'],
    brief: ['Nome, oferta e ação principal', 'Logo, fotos autorizadas ou referência visual', 'Textos existentes, mesmo que incompletos', 'Destino de cada botão e prazo desejado']
  },
  automacao: {
    label: 'Automação & IA',
    accent: '#42a17c',
    accentSoft: '#cfeadc',
    image: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1600&q=85',
    imageAlt: 'Detalhe abstrato de circuito e processamento',
    focus: 'para um processo que deixa de depender de copiar e colar.',
    summary: 'Um conceito de produto para visualizar entradas, regras, revisão e saída antes de prometer uma automação inteira.',
    scopeShort: 'Um fluxo com início, tratamento e resultado',
    workStyle: 'Protótipo, validação e tratamento de falha',
    editableNote: 'Campos, regras e mensagens descritos',
    canvasKicker: 'FLUXO COM VISIBILIDADE',
    canvasTitle: 'Entrada, decisão e saída sem caixa-preta',
    canvasDetail: 'Cada etapa deixa uma trilha: o que entrou, o que foi transformado e o que precisa de revisão.',
    route: [
      ['01', 'Mapear a entrada', 'Escolher uma fonte autorizada e um formato de dado que possa ser conferido.'],
      ['02', 'Desenhar a regra', 'Especificar transformação, exceção e momento em que uma pessoa precisa decidir.'],
      ['03', 'Prototipar em pequena escala', 'Executar com dados de teste e registrar como o fluxo reage quando algo falha.'],
      ['04', 'Entregar operação', 'Organizar instrução, logs e próximos ajustes sem esconder a parte humana.']
    ],
    showcase: 'O artefato mostra o processo como uma linha de produção legível: a IA acelera a parte repetitiva e a revisão continua identificável.',
    checks: ['Entrada e saída demonstráveis', 'Falha visível, não silenciosa', 'Registro simples para revisão posterior'],
    preview: { url: 'fluxo.exemplo', badge: 'AUTOMAÇÃO 01', title: 'Processar sem perder o controle.', subtitle: 'Cada item sai com contexto, status e responsável por revisar.', rows: ['Entrada autorizada', 'Regra + revisão', 'Saída registrada'] },
    edits: ['Campos de entrada', 'Regras de decisão', 'Mensagem de exceção', 'Formato do resultado'],
    brief: ['Exemplo sanitizado da entrada atual', 'Resultado esperado e casos de exceção', 'Quem revisa e em que momento', 'Sistemas envolvidos e acessos disponíveis']
  },
  uxui: {
    label: 'UX & interface',
    accent: '#9e5f87',
    accentSoft: '#efd9e6',
    image: 'https://images.unsplash.com/photo-1561070791-2526d30994b5?auto=format&fit=crop&w=1600&q=85',
    imageAlt: 'Mesa de trabalho com referências visuais e materiais de interface',
    focus: 'para uma interface que reduz hesitação.',
    summary: 'Um conceito de melhoria visual que começa pelo caminho da pessoa usuária: informação certa, no momento certo, sem perder a identidade do produto.',
    scopeShort: 'Um fluxo prioritário redesenhado e testado',
    workStyle: 'Diagnóstico, protótipo, teste e handoff',
    editableNote: 'Componentes e estados nomeados para continuidade',
    canvasKicker: 'INTERFACE COM RITMO',
    canvasTitle: 'Menos ruído para a próxima decisão',
    canvasDetail: 'O visual não é uma camada final: ele organiza leitura, hierarquia e confiança durante cada escolha.',
    route: [
      ['01', 'Ler o fluxo atual', 'Identificar o ponto de confusão e a tarefa que realmente precisa ficar mais simples.'],
      ['02', 'Definir hierarquia', 'Trabalhar prioridade, densidade, estados e linguagem antes de polir cada detalhe.'],
      ['03', 'Prototipar comportamento', 'Validar o fluxo em telas reais, com foco em escolha, erro e retorno visual.'],
      ['04', 'Handoff consistente', 'Entregar componentes, critérios e observações para manutenção futura.']
    ],
    showcase: 'A tela de referência usa contraste, espaçamento e estados nomeados para que a interface pareça parte de um sistema — não uma coleção de cartões.',
    checks: ['Hierarquia que se mantém no mobile', 'Estados de sucesso, espera e erro previstos', 'Componentes que podem evoluir sem redesenho total'],
    preview: { url: 'produto.exemplo', badge: 'FLUXO PRIORITÁRIO', title: 'Escolhas rápidas, contexto preservado.', subtitle: 'A pessoa vê o que importa agora e entende o efeito do próximo clique.', rows: ['Contexto visível', 'Ação principal clara', 'Estado e retorno'] },
    edits: ['Rótulos e microcopy', 'Ordem dos blocos', 'Componentes e estados', 'Tokens de cor e espaço'],
    brief: ['Tela ou fluxo que causa mais atrito', 'Objetivo da pessoa usuária', 'Identidade ou restrições existentes', 'Acesso a protótipo, produto ou captura atual']
  }
};
