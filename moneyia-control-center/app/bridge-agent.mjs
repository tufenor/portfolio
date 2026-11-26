// Ponte local do moneyIA.
// Mantém a Mesa útil quando nenhum provedor de IA está conectado: a fila fica
// persistida no servidor e cada item pode receber um rascunho local revisável.

export function pendingIaItems(items = []) {
  return items.filter((item) => item.status !== 'respondida');
}

export function bridgeSnapshot(providers = [], iaItems = [], proposalDispatch = []) {
  const configured = providers.filter((p) => p.habilitado && p.endpointConfigured);
  const usable = configured.filter((p) => p.cotaDisponivel === true);
  const waitingProposals = proposalDispatch.filter((item) => !item.sent && item.status !== 'enviado_confirmado');
  const confirmedProposals = proposalDispatch.filter((item) => item.status === 'enviado_confirmado' || item.sent);
  return {
    id: 'ponte-local-moneyia',
    label: 'Ponte local',
    mode: 'local-first',
    status: 'operacional',
    localQueue: true,
    manualContinuation: true,
    aiOptional: true,
    lastHeartbeat: new Date().toISOString(),
    queue: {
      pending: pendingIaItems(iaItems).length,
      answered: iaItems.filter((item) => item.status === 'respondida').length
    },
    proposalQueue: {
      pending: waitingProposals.length,
      confirmed: confirmedProposals.length,
      total: proposalDispatch.length
    },
    providers: {
      configured: configured.length,
      usable: usable.length,
      preferred: providers.find((p) => p.id === 'chatgpt')?.label || 'ChatGPT pago',
      redundancy: providers.filter((p) => p.habilitado).map((p) => ({
        id: p.id,
        label: p.label,
        configured: p.endpointConfigured === true,
        usable: p.cotaDisponivel === true && p.endpointConfigured === true,
        health: p.health || (p.endpointConfigured ? 'configured_unverified' : 'not_configured')
      }))
    },
    continuity: `A Mesa continua com cache e fila local mesmo sem IA. ${waitingProposals.length} proposta(s) aguardam o agente responsável.`
  };
}

export function localFallback(item = {}) {
  const title = String(item.title || 'Oportunidade sem título').trim();
  const platform = String(item.platform || 'plataforma não informada').trim();
  const budget = String(item.budget || 'desconhecido').trim();
  return [
    'RASCUNHO DA PONTE LOCAL — revisão humana antes de qualquer envio',
    '',
    `Oportunidade: ${title}`,
    `Plataforma: ${platform}`,
    `Orçamento observado: ${budget}`,
    '',
    '1. Encaixe: a Mesa pode preparar uma primeira análise de escopo, demo sanitizada e proposta condicional para entregas web, UX/UI, automação ou revisão de código que estejam descritas na página.',
    '2. Riscos: a página pode estar desatualizada, exigir acesso, experiência ou ferramenta que não estão comprovados. Não afirmar contratação, resultado comercial, posição no Google ou experiência não documentada.',
    '3. Preço e prazo: manter valor-âncora somente como estimativa; fechar preço e prazo após receber escopo, acessos e critérios de aceite.',
    '4. Próximo passo: abrir a URL, conferir estado atual e revisar este rascunho. A ponte local não envia candidatura nem confirma contrato.',
    '5. Prova pública: usar apenas demos e código públicos realmente disponíveis no portfólio; registrar qualquer lacuna.',
    '',
    'Origem: ponte local moneyIA. Este texto substitui temporariamente a IA e cria uma tarefa de revisão na Mesa.'
  ].join('\n');
}
