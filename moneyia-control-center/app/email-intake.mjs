import { createHash } from 'node:crypto';
const fold = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const stableId = (email, subject, from, emailTs) => String(email.id || email.message_id || '').trim().slice(0, 120)
  || `derived:${createHash('sha256').update(`${fold(from)}|${fold(subject)}|${String(emailTs || '')}`).digest('hex').slice(0, 24)}`;

const sourceFor = (from = '') => {
  const value = fold(from);
  const address = (value.match(/<([^<>]+)>\s*$/)?.[1] || value).trim();
  if (/^[^@<>\s]+@(?:[a-z0-9-]+\.)*payhip\.com$/.test(address)) return 'Payhip';
  if (value.includes('mercadopago.com.br') || value.includes('mercadolivre.com.br') || /(^|[<\s])mercado\s*pago([>\s]|$)/.test(value)) return 'Mercado Pago';
  if (value.includes('99freelas')) return '99Freelas';
  if (value.includes('workana')) return 'Workana';
  if (value.includes('upwork')) return 'Upwork';
  if (value.includes('freelancer')) return 'Freelancer';
  if (value.includes('ypai')) return 'YPAI';
  return 'Gmail';
};

export function gmailTaskMessageId(value) {
  const raw=String(value ?? '').trim().replace(/^gmail:/i,'');
  return /^[a-f\d]{16,18}$/i.test(raw)?raw.toLowerCase():'';
}

export function gmailTaskIndex(tasks) {
  const result=new Map();
  for (const t of tasks) {
    const note=String(t.description || '');
    const raw=note.match(/^\[email-id:([^\]]+)\]/i)?.[1] || note.match(/^email-intake:([^\r\n]+)/i)?.[1];
    const id=gmailTaskMessageId(raw);
    if (!id) continue;
    const kind=note.match(/^\[email-id:[^\]]+\]\s*\[kind:([a-z_]+)\]/i)?.[1] || '*';
    const kinds=result.get(id) || new Set();
    kinds.add(kind); result.set(id,kinds);
  }
  return result;
}
export function classifyEmail(email = {}) {
  const subject = String(email.subject || email.display_title || '').trim();
  const snippet = String(email.snippet || '').trim();
  const text = fold(`${subject} ${snippet}`);
  const source = sourceFor(email.from_ || email.from || '');
  const body = String(email.body || email.content || email.html || '');
  const paymentContext = fold(`${subject} ${snippet} ${body}`);
  const opportunityUrl = (body.match(/https?:\/\/www\.(?:99freelas\.com\.br|workana\.com|upwork\.com)[^\s"'<)]+/i) || [null])[0];
  let kind = 'other';
  let priority = 'baixa';
  let reason = 'Sem sinal comercial claro.';

  if (email.test_fixture === true) {
    kind = 'noise';
    reason = 'Marcador de mensagem simulada detectado no corpo; não é transação ou recebimento.';
  } else if (/\bola@comunicacao\.inter\.co\b/i.test(String(email.from_ || email.from || ''))
      && fold(subject) === 'seguranca nas compras da black friday'
      && /dicas|proteja-se|black friday/.test(fold(snippet))) {
    kind = 'noise';
    reason = 'Aviso geral de prevenção; não é alerta de atividade na conta.';
  } else if (source === 'Payhip') {
    const sellerSale = /\b(new sale|you made a sale|you have a new sale|you sold|nova venda|voce fez uma venda)\b/.test(text);
    const reversal = /\b(refund|refunded|chargeback|cancelad[ao]|reembolso)\b/.test(text);
    if (sellerSale && /\bmenu studio\b/.test(text) && !reversal) {
      kind = 'product_sale_signal';
      priority = 'alta';
      reason = 'Possível pedido do Menu Studio. Conferir no Payhip se houve cobrança ou cupom e conciliar com o processador.';
    }
  } else if (/(outra proposta foi aceita|outro profissional foi contratado|outro freelancer foi contratado|another proposal was accepted|another freelancer was hired)/.test(text)) {
    kind = 'proposal_status';
    priority = 'media';
    reason = 'Aviso de contratação de outra pessoa; não é aceite do titular.';
  } else if (/(proposta aceita|proposta foi aceita|voce foi contratado|contratacao confirmada|contrato iniciado|proposal accepted|you.?re hired|contract started|awarded|cliente escolheu|cliente enviou uma mensagem|nova mensagem do cliente|mensagem do cliente)/.test(text)) {
    kind = 'acceptance_or_client_reply';
    priority = 'alta';
    reason = 'Possível aceite, contratação ou resposta direta do cliente; conferir a página autenticada.';
  } else if (/(voce recebeu um pagamento|pagamento recebido|payment received|payment credited|funds received|you have received payment|pagamento foi creditado)/.test(text)) {
    const knownMoneyIARoute = ['99Freelas', 'Workana', 'Upwork', 'Freelancer', 'YPAI'].includes(source);
    // Generic mentions of MoneyIA are not a transaction reference. The inbox
    // stores a privacy-safe unattributed-payment snippet that itself mentions
    // MoneyIA; counting that text as evidence would promote it on the next sync.
    // Require a product/proposal identifier unless the sender is a marketplace.
    const hasMoneyIAReference = /\b(menu studio|apr-\d{2,}|brl-99-\d{4,})\b/.test(paymentContext);
    if (knownMoneyIARoute || hasMoneyIAReference) {
      kind = 'payment_received';
      priority = 'alta';
      reason = 'Possível recebimento com referência a um canal ou projeto MoneyIA; confirmar origem, moeda e disponibilidade antes de contabilizar receita.';
    } else {
      kind = 'payment_unattributed';
      priority = 'media';
      reason = 'O aviso menciona um pagamento, mas não identifica plataforma ou projeto MoneyIA. Atribuir manualmente; não contabilizar como receita do projeto antes da confirmação.';
    }
  } else if (/(cancelad|conexao reembolsad|projeto foi cancelado|proposal declined|not selected)/.test(text)) {
    kind = 'proposal_status';
    priority = 'media';
    reason = 'Mudança de estado da proposta; não é aceite.';
  } else if (/(novos? projetos?|new projects?|projeto que pode ser do seu interesse|job alert|new job|oportunidade de trabalho)/.test(text)) {
    kind = 'new_opportunity';
    priority = 'media';
    reason = 'Alerta de nova oportunidade enviado por um portal.';
  } else if (/(application .*received|aplicacao .*recebida|continue your .*profile|perfil.*continuar)/.test(text)) {
    kind = 'application_status';
    priority = 'media';
    reason = 'Atualização de cadastro/aplicação; não é contratação.';
  } else if (/(unknown device|senha|password|login|seguranca|security alert)/.test(text)) {
    kind = 'account_security';
    priority = 'alta';
    reason = 'Alerta de segurança de conta; revisar manualmente.';
  } else if (/(academy|webinar|oferta especial|promocao|black friday|desconto)/.test(text)) {
    kind = 'noise';
    reason = 'Marketing ou conteúdo promocional do portal.';
  }

  return {
    id: stableId(email, subject, email.from_ || email.from || '', email.email_ts || email.emailTs || null),
    threadId: String(email.thread_id || email.threadId || '').slice(0, 120),
    from: String(email.from_ || email.from || '').slice(0, 240),
    to: Array.isArray(email.to) ? email.to.slice(0, 10).map(String) : [],
    subject: subject.slice(0, 240),
    snippet: (kind === 'payment_unattributed' ? 'Aviso de pagamento sem referência identificada ao MoneyIA; atribuição pendente.' : snippet).slice(0, 1000),
    labels: Array.isArray(email.labels) ? email.labels.slice(0, 20).map(String) : [],
    emailTs: email.email_ts || email.emailTs || null,
    displayUrl: String(email.display_url || email.displayUrl || '').slice(0, 800),
    opportunityUrl: String(email.opportunityUrl || opportunityUrl || '').slice(0, 800),
    source,
    testFixture: email.test_fixture === true,
    kind,
    priority,
    reason,
    status: 'new'
  };
}

export function analyzeEmails(emails = []) {
  const rows = emails.map(classifyEmail).filter((row) => row.id || row.subject);
  const byId = new Map(rows.map((row) => [row.id || `${row.from}|${row.subject}|${row.emailTs}`, row]));
  const unique = [...byId.values()].sort((a, b) => String(b.emailTs || '').localeCompare(String(a.emailTs || '')));
  return {
    scannedAt: new Date().toISOString(),
    total: unique.length,
    counts: unique.reduce((acc, row) => { acc[row.kind] = (acc[row.kind] || 0) + 1; return acc; }, {}),
    emails: unique
  };
}


