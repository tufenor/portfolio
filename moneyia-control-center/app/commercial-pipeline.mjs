const steps = {
  contato_individual: 'Conferir o histórico da conversa e a forma de receber antes de executar a mensagem aprovada. Registrar o resultado com evidência.',
  listagem_produto: 'Confirmar o processador de pagamento elegível e testar a compra antes de disponibilizar o checkout.',
  publicacao_portfolio: 'Conferir a demo pública e preparar a publicação aprovada no canal indicado. Registrar o link se houver confirmação.'
};

export function commercialTask(approval) {
  const step = steps[approval.actionType];
  if (!step || approval.status !== 'aprovada') return null;
  return {
    operationKey: `commercial:${approval.id}`,
    title: `${approval.id} · ${approval.title}`,
    description: `Decisão aprovada na Mesa. ${step} Consulte o pacote vinculado à aprovação para o conteúdo e o canal.`,
    source: 'moneyIA-comercial',
    assignee: 'deepseek',
    priority: 'alta'
  };
}

function publicLink(value) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' && !url.username && !url.password) return url.href;
  } catch {}
  return undefined;
}

function project(approval, id, stage, nextAction) {
  return {
    id,
    title: approval.title,
    stage,
    nextAction,
    amount: approval.amount || undefined,
    url: publicLink(approval.opportunityUrl),
    demoUrl: publicLink(approval.demoUrl)
  };
}

export function commercialPipeline(finance, approvals, dispatches, tasks) {
  const byId = new Map(approvals.map((row) => [row.id, row]));
  const taskByOperation = new Map(tasks.map((row) => [row.operationKey, row]));
  const pending = [];
  const approved = [];
  for (const row of approvals) {
    const step = steps[row.actionType];
    if (row.status === 'pendente' && (step || row.actionType === 'candidatura')) {
      pending.push(project(row, row.id, 'Aguardando decisão', 'Revisar o pacote na Mesa de aprovações.'));
    }
    if (step && row.status === 'aprovada') {
      const task = taskByOperation.get(`commercial:${row.id}`);
      if (!task || !['concluida', 'cancelada'].includes(task.status)) {
        approved.push(project(row, row.id, task ? 'Encaminhada na Mesa' : 'Aprovada · encaminhamento pendente', step));
      }
    }
  }

  const dispatched = [];
  const sent = new Set();
  for (const row of dispatches) {
    if (row.status === 'enviado_confirmado' && row.sent === true && String(row.externalEvidence || '').trim()) {
      sent.add(row.opportunityId || row.approvalId || row.id);
      continue;
    }
    const approval = byId.get(row.approvalId);
    if (!approval) continue;
    const failed = row.status === 'falha_agente';
    dispatched.push(project(approval, row.id, failed ? 'Agente indisponível' : 'Envio pendente de evidência',
      failed
        ? 'Usar a conferência da Mesa para verificar a plataforma antes de tentar outro envio.'
        : 'Conferir o histórico da conta e registrar o resultado na Mesa.'));
  }
  const amount = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
  return {
    historicalSent: amount(finance.proposalsSentConfirmed),
    confirmedDispatches: sent.size,
    contracts: amount(finance.contractsConfirmed),
    received: Object.fromEntries(['BRL', 'BOB', 'USD'].map((code) => [code, amount(finance.confirmedReceived?.[code])])),
    queue: [...pending, ...approved, ...dispatched]
  };
}
