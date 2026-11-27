// Geração determinística de pacotes locais para a Mesa.
// Não envia formulários: transforma anúncios verificáveis em aprovações que o titular decide.

const fold = (value) => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

const demoFor = (opportunity) => {
  const title = fold(opportunity.title);
  if (/automat|python|playwright|chatbot|inteligencia artificial|\bia\b|n8n|api/.test(title)) return 'https://tufenor.github.io/portfolio/modelos/proposta-studio/?modelo=automacao';
  if (/\bux\b|\bui\b|figma|interface|design/.test(title)) return 'https://tufenor.github.io/portfolio/modelos/proposta-studio/?modelo=uxui';
  if (title.includes('shopify')) return 'https://tufenor.github.io/portfolio/demo/shopify-bebe.html';
  if (title.includes('tarot')) return 'https://tufenor.github.io/portfolio/demo/tarot-landing.html';
  if (title.includes('advog') || title.includes('jur')) return 'https://tufenor.github.io/portfolio/demo/landing-advogado.html';
  if (title.includes('wordpress') || title.includes('elementor')) return 'https://tufenor.github.io/portfolio/demo/cafe-aurora.html';
  if (title.includes('landing') || title.includes('site') || title.includes('web')) return 'https://tufenor.github.io/portfolio/modelos/proposta-studio/?modelo=landing';
  return 'https://tufenor.github.io/portfolio/projeto/';
};

const priceFor = (opportunity) => {
  if (Number.isFinite(Number(opportunity.proposalAmount))) {
    const prefix = String(opportunity.proposalCurrency || opportunity.currency).toUpperCase() === 'USD' ? 'US$' : 'R$';
    return `${prefix} ${Number(opportunity.proposalAmount).toLocaleString('pt-BR')}`;
  }
  const currency = String(opportunity.proposalCurrency || opportunity.currency || '').toUpperCase();
  if (currency === 'USD') {
    const budgetMatch = String(opportunity.budget || '').match(/(?:US\$|\$)?\s*([0-9]+(?:[.,][0-9]+)?)/);
    return budgetMatch ? `US$ ${budgetMatch[1]}` : 'US$ 200';
  }
  const title = fold(opportunity.title);
  if (title.includes('landing') || title.includes('site') || title.includes('web')) return 'R$ 690';
  if (title.includes('wordpress') || title.includes('elementor')) return 'R$ 750';
  if (title.includes('ui') || title.includes('ux') || title.includes('design')) return 'R$ 600';
  if (title.includes('automacao') || title.includes('ia') || title.includes('python') || title.includes('chatbot')) return 'R$ 900';
  return 'a definir após insumos';
};

const excludedTitle = /(avaliador|revisor|anotador|participant|coleta de dados|instrutor|bugcrowd|hackerone|bounty|vendedor|comissionad|alinhamento linguistico|especialista em lingua|avaliacoes de audio|analista de qualidade|programacao fluente|parceiro comercial|treinamento freelance|treinamento de ia)/i;
const serviceTitle = /(landing|site|web|wordpress|elementor|shopify|html|css|ux|ui|responsiv|automac|python|playwright|chatbot|inteligencia artificial|\bia\b|react|fastapi|instalacao|editor)/i;
const closedState = /(fechad|encerrad|cancelad|contratad|cliente escolheu|em andamento|proposta[_ ]enviad|interesse[_ ]enviad|aceit)/i;
const preparedState = /(proposta[_ ]preparad|qualified_|aguardando_aprovacao|aprovada)/i;

export function isOpportunityEligible(opportunity) {
  if (!opportunity || !opportunity.id || !opportunity.url || !opportunity.title) return { ok: false, reason: 'dados insuficientes' };
  if (opportunity.verification !== 'page_confirmed' && opportunity.verification !== 'page_confirmed_indexed') return { ok: false, reason: 'página individual não confirmada' };
  const state = `${opportunity.status || ''} ${opportunity.applicationStatus || ''}`;
  if (closedState.test(state)) return { ok: false, reason: 'já encerrada ou com candidatura registrada' };
  if (preparedState.test(String(opportunity.applicationStatus || ''))) return { ok: false, reason: 'já está em outro estado de preparação' };
  const normalizedTitle = fold(opportunity.title);
  if (excludedTitle.test(normalizedTitle)) return { ok: false, reason: 'exige atividade pessoal ou prova específica' };
  if (!serviceTitle.test(normalizedTitle)) return { ok: false, reason: 'fora do catálogo inicial de serviços' };
  return { ok: true };
}

export function buildProposalPacket(opportunity) {
  const demoUrl = String(opportunity.demoUrl || '').trim() || demoFor(opportunity);
  const amount = priceFor(opportunity);
  const existing = String(opportunity.proposal || '').trim();
  const deliverable = String(opportunity.deliverable || '').trim() || 'um primeiro marco pequeno, demonstrável e testado';
  const proposalText = existing && !existing.includes('[nenhum link público ainda;')
    ? existing
    : `Olá. Li o escopo público de “${opportunity.title}”. Posso começar por um marco delimitado: ${deliverable} Entrego uma demonstração relacionada, código/artefato organizado e um guia curto de edição ou operação. A demo pública é uma referência técnica, não um case deste cliente: ${demoUrl}. Preço-âncora: ${amount}, condicionado aos insumos, acessos e critérios de aceite. Prazo e integrações ficam fechados depois de confirmar o material, a plataforma e o primeiro fluxo. Se esse recorte fizer sentido, envio o plano do primeiro marco e as perguntas objetivas para começar.`;
  return { proposalText, demoUrl, amount };
}

export function rankOpportunities(rows) {
  const rank = (value) => /^(p?1|alta|alto)$/i.test(String(value || '')) ? 1 : /^(p?2|media|medio)$/i.test(String(value || '')) ? 2 : 3;
  return [...rows].sort((a, b) => {
    const byPriority = rank(a.priority) - rank(b.priority);
    if (byPriority) return byPriority;
    return String(b.checked || '').localeCompare(String(a.checked || ''));
  });
}

