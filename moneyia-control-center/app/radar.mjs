// Radar global local: descoberta pública, agregação, gates humanos e ranking.
// Não abre contas, não altera IP e não executa desafios anti-bot.

export const RUN_STATES = new Set(['running', 'paused', 'completed', 'failed']);
export const GATE_STATES = new Set(['pending', 'completed', 'expired']);

const fold = (value) => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const trackingParams = /^(utm_|ref$|source$|src$|campaign$|fbclid$|gclid$|mc_cid$|mc_eid$)/i;

export function canonicalUrl(raw) {
  try {
    const parsed = new URL(String(raw || '').trim());
    parsed.hash = '';
    parsed.hostname = parsed.hostname.toLowerCase();
    const params = [...parsed.searchParams.entries()]
      .filter(([key]) => !trackingParams.test(key))
      .sort(([a], [b]) => a.localeCompare(b));
    parsed.search = '';
    for (const [key, value] of params) parsed.searchParams.append(key, value);
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return String(raw || '').trim().replace(/[?#].*$/, '').replace(/\/$/, '').toLowerCase();
  }
}

export function detectBrowserGate(input = {}) {
  const text = fold(`${input.title || ''} ${input.status || ''} ${input.error || ''} ${input.body || ''}`);
  if (!text) return null;
  if (/(captcha|cloudflare|checking your browser|verificacao de seguranca|verificacao de segurança|nao e um robo|não é um robô|security check|access denied|challenge)/.test(text)) {
    return { type: 'challenge', action: 'resolver desafio de segurança no navegador' };
  }
  if (/(sessao expirada|sessão expirada|login required|sign in|entrar na conta|faca login|faça login|deslogad)/.test(text)) {
    return { type: 'login', action: 'fazer login na conta correta' };
  }
  if (/(confirmar email|confirmar e-mail|verify your email|verifique seu email|verifique seu e-mail)/.test(text)) {
    return { type: 'email_confirmation', action: 'confirmar o e-mail da conta' };
  }
  if (input.requiresIdentity === true || input.identityRequired === true || /(identity_pending|kyc_required|verificacao_de_identidade_pendente)/.test(text)) {
    return { type: 'identity', action: 'concluir a verificação de identidade na própria plataforma' };
  }
  return null;
}

function demandScore(row) {
  const observed = `${row.competition || ''} ${row.status || ''}`;
  const interested = Number(row.interested ?? row.interessados ?? (observed.match(/(\d+)\s*interessad/i)?.[1] || 0));
  const proposals = Number(row.proposals ?? row.propostas ?? (observed.match(/(\d+)\s*propost/i)?.[1] || 0));
  const explicit = Number(row.demandScore ?? row.demand ?? 0);
  if (Number.isFinite(explicit) && explicit > 0) return Math.min(40, Math.round(explicit));
  return Math.min(40, Math.round(Math.log10(Math.max(1, interested + proposals + 1)) * 12));
}

function fitScore(row) {
  const title = fold(row.title);
  const terms = ['landing', 'site', 'web', 'html', 'css', 'javascript', 'wordpress', 'elementor', 'shopify', 'ux', 'ui', 'responsiv', 'automacao', 'python', 'playwright', 'chatbot', 'ia', 'react', 'fastapi', 'instalacao', 'editor'];
  const hits = terms.filter((term) => title.includes(term)).length;
  return Math.min(25, hits * 5);
}

function payoutScore(row) {
  const payout = fold(row.payoutStatus || row.paymentStatus || row.receiving || '');
  const currency = fold(row.currency || row.proposalCurrency || '');
  if (/(verified|confirmad|publicad|suportad|disponivel|disponível)/.test(payout)) return 20;
  if (currency && currency !== 'unknown' && currency !== 'desconhecido') return 5;
  return 0;
}

function competitionScore(row) {
  const proposals = Number(row.proposals ?? row.propostas ?? 0);
  const interested = Number(row.interested ?? row.interessados ?? 0);
  const count = Math.max(proposals, interested);
  if (!count) return 10;
  if (count <= 10) return 10;
  if (count <= 40) return 7;
  if (count <= 100) return 4;
  return 1;
}

function freshnessScore(row) {
  const date = Date.parse(row.checked || row.observedAt || row.publishedAt || '');
  if (!Number.isFinite(date)) return 0;
  const ageHours = Math.max(0, (Date.now() - date) / 3_600_000);
  return ageHours <= 24 ? 5 : ageHours <= 72 ? 3 : ageHours <= 168 ? 1 : 0;
}

export function scoreOpportunity(row = {}) {
  const demand = demandScore(row);
  const fit = fitScore(row);
  const payout = payoutScore(row);
  const competition = competitionScore(row);
  const freshness = freshnessScore(row);
  return {
    demand,
    fit,
    payout,
    competition,
    freshness,
    total: demand + fit + payout + competition + freshness,
    tier: demand >= 25 && fit >= 10 && payout >= 10 ? 'qualified' : demand >= 15 && fit >= 10 ? 'exploratory' : 'watch'
  };
}

// Ordena a fila de aprovação sem transformar moeda nem presumir elegibilidade.
// Compatibilidade é apenas preferência operacional; a verificação humana continua obrigatória.
export function rankOpportunities(rows = [], preferences = {}) {
  const wantedLanguages = new Set((preferences.languages || ['pt', 'en', 'es']).map((value) => fold(value)));
  const wantedCurrencies = new Set((preferences.currencies || ['BRL', 'USD']).map((value) => fold(value)));
  return rows.map((row) => {
    const language = fold(row.language || row.idioma || 'unknown');
    const currency = fold(row.currency || row.proposalCurrency || 'unknown');
    const languageMatch = wantedLanguages.has(language) || language === 'global' ? 4 : 0;
    const currencyMatch = wantedCurrencies.has(currency) ? 3 : 0;
    const budgetKnown = row.budget && !/(unknown|desconhecido|consulta|nao informado|não informado)/i.test(String(row.budget)) ? 2 : 0;
    const verification = /official_page_read|page_confirmed|observed_public/i.test(String(row.verification || '')) ? 1 : 0;
    return { ...row, fitRank: Number(row.radarScore?.total || scoreOpportunity(row).total) + languageMatch + currencyMatch + budgetKnown + verification };
  }).sort((a, b) => b.fitRank - a.fitRank || String(b.observedAt || b.checked || '').localeCompare(String(a.observedAt || a.checked || '')));
}

export function normalizeOpportunity(row = {}, context = {}) {
  const url = String(row.url || row.opportunityUrl || row.link || '').trim();
  const score = scoreOpportunity(row);
  const gate = detectBrowserGate(row);
  return {
    ...row,
    id: String(row.id || `radar-${Buffer.from(canonicalUrl(url) || row.title || 'item').toString('base64url').slice(0, 24)}`).slice(0, 120),
    url,
    canonicalUrl: canonicalUrl(url),
    country: String(row.country || row.pais || context.country || 'unknown').slice(0, 80),
    language: String(row.language || row.idioma || context.language || 'unknown').slice(0, 40),
    currency: String(row.currency || row.proposalCurrency || context.currency || 'unknown').slice(0, 20),
    payoutStatus: String(row.payoutStatus || row.paymentStatus || 'unknown').slice(0, 80),
    aiPolicy: String(row.aiPolicy || row.policyIA || 'unknown').slice(0, 120),
    evidence: Array.isArray(row.evidence) ? row.evidence.slice(0, 10).map(String) : [],
    verification: gate ? 'human_gate_required' : String(row.verification || 'observed_public').slice(0, 50),
    gate: gate ? { ...gate, platform: row.platform || context.platform || 'unknown', url } : null,
    radarScore: score,
    observedAt: row.observedAt || row.checked || '',
    sourceShard: context.shardId || row.sourceShard || null,
    source: context.source || row.source || row.platform || 'unknown'
  };
}

export function mergeOpportunities(rows = []) {
  const map = new Map();
  for (const raw of rows) {
    const row = normalizeOpportunity(raw, { source: raw.source || raw.platform, shardId: raw.sourceShard });
    const key = row.canonicalUrl || `${fold(row.platform)}|${fold(row.title)}`;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, row);
      continue;
    }
    const existingDate = Date.parse(existing.observedAt || existing.checked || '') || 0;
    const newDate = Date.parse(row.observedAt || row.checked || '') || 0;
    map.set(key, {
      ...(newDate >= existingDate ? existing : row),
      ...Object.fromEntries(Object.entries(newDate >= existingDate ? row : existing).filter(([, value]) => value !== null && value !== undefined && value !== '')),
      evidence: [...new Set([...(existing.evidence || []), ...(row.evidence || [])])].slice(0, 10),
      sources: [...new Set([...(existing.sources || [existing.source]), ...(row.sources || [row.source])])].slice(0, 10),
      duplicateCount: Number(existing.duplicateCount || 1) + 1
    });
  }
  return [...map.values()].sort((a, b) => (b.radarScore?.total || 0) - (a.radarScore?.total || 0) || String(b.observedAt).localeCompare(String(a.observedAt)));
}

export function createRadarRun(input = {}) {
  const shards = Math.max(1, Math.min(6, Number(input.shards || 6)));
  const now = new Date().toISOString();
  return {
    id: `RAD-${Date.now().toString(36).toUpperCase()}`,
    mode: String(input.mode || 'shadow').slice(0, 30),
    status: 'running',
    createdAt: now,
    updatedAt: now,
    policy: { publicWorkers: shards, authenticatedSessions: 'one_serial_per_platform', externalSubmission: false },
    shards: Array.from({ length: shards }, (_, index) => ({ id: `public-${index + 1}`, type: 'public', status: 'queued', source: null, lastRead: null, found: 0, errors: [], nextStep: 'aguardar fonte pública' })),
    aggregator: { status: 'queued', deduplicated: 0, normalized: 0, qualified: 0, exploratory: 0, watch: 0 },
    gateIds: [],
    resolvedGateKeys: [],
    resultIds: [],
    error: null
  };
}

export function updateRunFromResults(run, rows = []) {
  const now = new Date().toISOString();
  const normalized = mergeOpportunities(rows);
  const gates = normalized.filter((row) => row.gate).map((row) => row.gate);
  run.updatedAt = now;
  run.status = gates.length ? 'paused' : 'completed';
  run.aggregator = {
    status: 'completed',
    deduplicated: Math.max(0, rows.length - normalized.length),
    normalized: normalized.length,
    qualified: normalized.filter((row) => row.radarScore.tier === 'qualified').length,
    exploratory: normalized.filter((row) => row.radarScore.tier === 'exploratory').length,
    watch: normalized.filter((row) => row.radarScore.tier === 'watch').length
  };
  for (const shard of run.shards) {
    shard.lastRead = now;
    shard.nextStep = gates.length ? 'aguardar resolução da pendência humana' : 'aguardar próximo ciclo';
  }
  return { run, normalized, gates };
}

export function gateRecord(input = {}) {
  const gate = input.gate || detectBrowserGate(input) || { type: 'challenge', action: 'revisar a tela no navegador' };
  return {
    id: String(input.id || `GATE-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`).slice(0, 80),
    runId: String(input.runId || '').slice(0, 80),
    platform: String(input.platform || gate.platform || 'unknown').slice(0, 80),
    url: String(input.url || '').slice(0, 800),
    type: gate.type,
    action: gate.action,
    status: 'pending',
    sound: true,
    createdAt: new Date().toISOString(),
    completedAt: null,
    completedBy: null,
    evidence: null
  };
}

export function completeGate(gate, by = 'titular', evidence = '') {
  return { ...gate, status: 'completed', completedAt: new Date().toISOString(), completedBy: String(by).slice(0, 60), evidence: String(evidence || '').slice(0, 1000) || null };
}

export function sessionKey(platform) {
  return fold(platform).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'unknown';
}

export function canAcquireSession(sessions = [], platform, runId) {
  const key = sessionKey(platform);
  return !sessions.some((row) => row.platformKey === key && row.status === 'active' && row.runId !== runId);
}

