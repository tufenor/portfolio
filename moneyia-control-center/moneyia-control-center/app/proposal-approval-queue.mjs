// Regras determinísticas da fila de propostas prontas.
// Este módulo prepara a decisão local; não simula envio em plataforma.

const sentStates = /proposta[_ ]enviada|contratad|perdida|arquiv|nao[_ ]enviad/i;
const closedStates = /fechad|encerrad|em andamento|aguardando garantia/i;

export function isProposalReady(opportunity = {}) {
  const proposal = String(opportunity.proposal || '').trim();
  const demo = String(opportunity.demoUrl || '').trim();
  const appStatus = String(opportunity.applicationStatus || '').trim();
  const status = String(opportunity.status || '').trim();
  if (!proposal || !demo) return false;
  if (sentStates.test(appStatus) || sentStates.test(status)) return false;
  if (closedStates.test(status)) return false;
  return appStatus === 'proposal_prepared' || appStatus === 'qualified_proposal_ready' || appStatus === 'qualified_pending_decision';
}

function amountLabel(opportunity) {
  const amount = Number(opportunity.proposalAmount);
  if (!Number.isFinite(amount) || amount <= 0) return 'a definir após os insumos';
  return `${opportunity.proposalCurrency === 'USD' ? 'US$' : 'R$'} ${amount.toLocaleString('pt-BR')}`;
}

export function buildProposalApproval(opportunity = {}) {
  const amount = amountLabel(opportunity);
  return {
    source: 'moneyIA-radar',
    title: `Enviar proposta ${opportunity.platform || 'plataforma'} — ${opportunity.title || opportunity.id}`.slice(0, 160),
    description: `Proposta pronta para revisão. demo pública: ${opportunity.demoUrl}. Preço-âncora: ${amount}. A página, disponibilidade e eventuais custos devem ser conferidos antes do envio; a aprovação libera o agente responsável para preparar o próximo passo, sem afirmar envio externo.`,
    actionType: 'candidatura',
    target: `${opportunity.platform || 'plataforma'} · ${opportunity.id}`,
    cost: 'R$ 0; eventual crédito/conexão somente se já disponível',
    files: [opportunity.demoUrl, `opportunity:${opportunity.id}`],
    opportunityId: opportunity.id,
    opportunityUrl: opportunity.url,
    proposalText: opportunity.proposal,
    demoUrl: opportunity.demoUrl,
    amount,
    status: 'pendente'
  };
}

export function buildDispatchJob(approval = {}) {
  return {
    id: `dispatch-${approval.id || approval.opportunityId || 'pending'}`,
    opportunityId: approval.opportunityId || null,
    approvalId: approval.id || null,
    status: 'aguardando_agente',
    sent: false,
    provider: 'deepseek',
    createdAt: new Date().toISOString(),
    note: 'Aprovação local registrada; envio externo só muda para confirmado após resposta verificável da plataforma.'
  };
}
