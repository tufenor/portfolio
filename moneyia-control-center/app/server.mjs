// Painel local de aprovações e tarefas do moneyIA.
// Uso: node app/server.mjs
// URL: http://127.0.0.1:8899
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sentProposals, readChecks, verifyProposals } from './proposal-verifier.mjs';
import {
  readApprovals, readTasks, readIa, createApproval, updateApproval, decideApproval,
  createTask, updateTask, createIaItem, setIaResponse, setIaDelivery, summarize,
  readAgentQuestions, createAgentQuestion, answerAgentQuestion,
  readProposalDispatch, createProposalDispatch, updateProposalDispatch, readEmailInbox, writeEmailInbox, readEmailWatchStatus,
  readRadarRuns, readRadarGates, readRadarOpportunities, readRadarSessions,
  writeRadarRuns, writeRadarGates, writeRadarOpportunities, writeRadarSessions,
  readDispatchScheduler, writeDispatchScheduler
} from './store.mjs';
import { bridgeSnapshot, localFallback } from './bridge-agent.mjs';
import { buildProposalPacket, isOpportunityEligible, rankOpportunities } from './opportunity-packets.mjs';
import { analyzeEmails } from './email-intake.mjs';
import { createRadarRun, updateRunFromResults, mergeOpportunities, gateRecord, completeGate, detectBrowserGate, sessionKey, canAcquireSession, canonicalUrl } from './radar.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = join(root, 'app', 'public');
const port = Number(process.env.MONEYIA_APP_PORT || 8899);
const host = process.env.MONEYIA_APP_HOST || '127.0.0.1';
const appUser = process.env.MONEYIA_APP_USER || '';
const appPass = process.env.MONEYIA_APP_PASSWORD || '';
const authEnabled = Boolean(appUser && appPass);
const fold = (value) => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

function isLoopback(addr = '') {
  return addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1';
}

function authorized(req) {
  if (!authEnabled) return isLoopback(req.socket.remoteAddress);
  const header = req.headers.authorization || '';
  if (!header.startsWith('Basic ')) return false;
  const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
  const idx = decoded.indexOf(':');
  if (idx < 0) return false;
  return decoded.slice(0, idx) === appUser && decoded.slice(idx + 1) === appPass;
}

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

function sendJson(res, code, value) {
  const body = JSON.stringify(value);
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > 1_000_000) { reject(new Error('body grande demais')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { reject(new Error('JSON inválido')); }
    });
    req.on('error', reject);
  });
}

const readJson = async (name, fallback) => {
  try { return JSON.parse(await readFile(join(root, 'data', name), 'utf8')); } catch { return fallback; }
};

const providerEnv = {
  chatgpt: 'MONEYIA_CHATGPT_DISPATCH_URL',
  deepseek: 'MONEYIA_DEEPSEEK_DISPATCH_URL',
  gemini: 'MONEYIA_GEMINI_DISPATCH_URL',
  ollama: 'MONEYIA_OLLAMA_URL',
  jarvis: 'MONEYIA_JARVIS_DISPATCH_URL'
};

async function ollamaProbe() {
  const base = process.env.MONEYIA_OLLAMA_URL || 'http://127.0.0.1:11434/api/chat';
  const tags = base.replace(/\/api\/chat\/?$/, '/api/tags');
  try {
    const response = await fetch(tags, { signal: AbortSignal.timeout(4000) });
    if (!response.ok) return { endpointConfigured: false, cotaDisponivel: false, modelo: null };
    const body = await response.json().catch(() => ({}));
    const models = Array.isArray(body.models) ? body.models.map((m) => String(m.name || '')).filter(Boolean) : [];
    const preferred = process.env.MONEYIA_OLLAMA_MODEL || 'qwen3.5:4b';
    return {
      endpointConfigured: true,
      cotaDisponivel: models.length > 0,
      modelo: models.includes(preferred) ? preferred : (models[0] || null)
    };
  } catch {
    return { endpointConfigured: false, cotaDisponivel: false, modelo: null };
  }
}

async function jarvisProbe() {
  const endpoint = process.env.MONEYIA_JARVIS_DISPATCH_URL || 'http://127.0.0.1:8080/api/moneyia/fallback';
  const health = process.env.MONEYIA_JARVIS_HEALTH_URL || 'http://127.0.0.1:8080/api/saude';
  try {
    const response = await fetch(health, { signal: AbortSignal.timeout(2000) });
    return { endpointConfigured: response.ok, cotaDisponivel: response.ok, endpoint };
  } catch {
    return { endpointConfigured: false, cotaDisponivel: false, endpoint };
  }
}

async function readAiProviders() {
  const providers = await readJson('ia-providers.json', []);
  const ollama = await ollamaProbe();
  const jarvis = await jarvisProbe();
  return providers
    .map((p) => ({
      ...p,
      ...(p.id === 'ollama' ? ollama : {}),
      ...(p.id === 'jarvis' ? jarvis : {}),
      endpointConfigured: p.id === 'ollama'
        ? ollama.endpointConfigured
        : p.id === 'jarvis'
          ? jarvis.endpointConfigured
        : Boolean(process.env[providerEnv[p.id] || ''] || (p.id === 'chatgpt' && process.env.MONEYIA_AI_WEBHOOK_URL))
      ,health: p.id === 'ollama'
        ? (ollama.endpointConfigured ? (ollama.cotaDisponivel ? 'healthy' : 'reachable_no_model') : 'offline')
        : p.id === 'jarvis'
          ? (jarvis.endpointConfigured ? 'healthy' : 'offline')
          : (Boolean(process.env[providerEnv[p.id] || ''] || (p.id === 'chatgpt' && process.env.MONEYIA_AI_WEBHOOK_URL)) ? 'configured_unverified' : 'not_configured')
    }))
    .sort((a, b) => Number(a.preferencia || 99) - Number(b.preferencia || 99));
}

async function chooseAiProvider(requested) {
  const providers = await readAiProviders();
  const usable = (p) => p?.habilitado && p.endpointConfigured && p.cotaDisponivel === true;
  const wanted = providers.find((p) => p.id === requested && p.habilitado);
  if (usable(wanted)) return { provider: wanted, providers };
  const available = providers.find(usable);
  return { provider: available || wanted || providers.find((p) => p.id === 'chatgpt') || null, providers };
}

async function findOpportunity(id) {
  const [brl, usd, global] = await Promise.all([
    readJson('opportunities-brl.json', []), readJson('opportunities-usd.json', []),
    readJson('global-opportunities-2026-11-26.json', [])
  ]);
  return [...brl, ...usd, ...global].find((o) => o.id === id) || null;
}

async function readAllOpportunities() {
  const [brl, usd, global, radar] = await Promise.all([
    readJson('opportunities-brl.json', []),
    readJson('opportunities-usd.json', []),
    readJson('global-opportunities-2026-11-26.json', []),
    readRadarOpportunities()
  ]);
  return mergeOpportunities([...brl, ...usd, ...global, ...radar]);
}

async function shadowRadarRun(run) {
  const [brl, usd, global] = await Promise.all([
    readJson('opportunities-brl.json', []),
    readJson('opportunities-usd.json', []),
    readJson('global-opportunities-2026-11-26.json', [])
  ]);
  const rows = [...brl, ...usd, ...global].map((row, index) => ({
    ...row,
    source: row.platform || 'catalogo-local',
    sourceShard: `public-${(index % run.shards.length) + 1}`,
    observedAt: row.checked || row.observedAt || new Date().toISOString()
  }));
  // Os shards públicos são independentes; a agregação só acontece depois que
  // todos retornam. Nesta primeira versão em sombra, a fonte é o catálogo
  // local já verificado, mas o contrato é o mesmo usado por coletores futuros.
  const buckets = run.shards.map(() => []);
  rows.forEach((row, index) => buckets[index % run.shards.length].push(row));
  await Promise.all(run.shards.map(async (shard, index) => {
    shard.status = 'running';
    shard.source = [...new Set(buckets[index].map((row) => row.platform || 'catalogo-local'))].slice(0, 8).join(', ');
    await Promise.resolve();
    shard.found = buckets[index].length;
    shard.status = 'completed';
  }));
  const result = updateRunFromResults(run, rows);
  const previousGates = await readRadarGates();
  const gates = result.gates.map((gate) => gateRecord({ runId: run.id, platform: gate.platform, url: gate.url, gate }));
  const dedupedGates = [...previousGates];
  for (const gate of gates) {
    const gateKey = `${gate.type}|${canonicalUrl(gate.url)}`;
    if (run.resolvedGateKeys?.includes(gateKey)) continue;
    const existing = dedupedGates.filter((item) => canonicalUrl(item.url) === canonicalUrl(gate.url) && item.type === gate.type && item.status === 'pending');
    // Um portal pode reaparecer em várias varreduras. Mantemos somente um gate
    // pendente por URL/tipo e deixamos os antigos como histórico superseded.
    for (const duplicate of existing) {
      duplicate.status = 'superseded';
      duplicate.supersededBy = gate.id;
      duplicate.supersededAt = new Date().toISOString();
    }
    dedupedGates.push(gate);
  }
  run.gateIds = dedupedGates.filter((gate) => gate.runId === run.id && gate.status === 'pending').map((gate) => gate.id);
  run.resultIds = result.normalized.map((row) => row.id);
  run.status = run.gateIds.length ? 'paused' : 'completed';
  await writeRadarOpportunities(result.normalized);
  const runs = await readRadarRuns();
  const index = runs.findIndex((item) => item.id === run.id);
  if (index >= 0) runs[index] = run; else runs.push(run);
  await writeRadarRuns(runs);
  await writeRadarGates(dedupedGates);
  return { run, opportunities: result.normalized, gates: dedupedGates.filter((gate) => gate.runId === run.id) };
}

async function startRadarRun(input = {}) {
  const run = createRadarRun(input);
  const runs = await readRadarRuns();
  runs.push(run);
  await writeRadarRuns(runs);
  try {
    return await shadowRadarRun(run);
  } catch (error) {
    run.status = 'failed';
    run.updatedAt = new Date().toISOString();
    run.error = String(error.message || error).slice(0, 1000);
    const current = await readRadarRuns();
    const index = current.findIndex((item) => item.id === run.id);
    if (index >= 0) current[index] = run; else current.push(run);
    await writeRadarRuns(current);
    throw error;
  }
}

async function prepareRadarSendQueue(requestedLimit = 30) {
  const limit = Number.isFinite(Number(requestedLimit)) ? Math.max(1, Math.min(30, Math.floor(Number(requestedLimit)))) : 30;
  const [opportunities, approvals] = await Promise.all([readAllOpportunities(), readApprovals()]);
  const existingIds = new Set(approvals.map((row) => row.opportunityId).filter(Boolean));
  const candidates = opportunities
    .filter((opportunity) => !existingIds.has(opportunity.id) && isOpportunityEligible(opportunity).ok)
    .sort((a, b) => (b.radarScore?.total || 0) - (a.radarScore?.total || 0));
  const created = [];
  for (const opportunity of candidates.slice(0, limit)) {
    const packet = buildProposalPacket(opportunity);
    const row = await createApproval({
      source: 'moneyIA-radar-send-queue',
      title: `Revisar e enviar proposta — ${opportunity.platform || 'plataforma'} · ${opportunity.title}`.slice(0, 160),
      description: `Fila visual de envio. Revise a página, a demo, o preço e o texto antes de aprovar. O agente só poderá preencher a plataforma depois da aprovação e da revalidação da sessão. Score Radar: ${opportunity.radarScore?.total || 0}.`,
      actionType: 'candidatura',
      target: `${opportunity.platform || 'plataforma'} · ${opportunity.id}`,
      cost: 'R$ 0; eventual crédito/conexão somente se já disponível',
      files: [packet.demoUrl, `opportunity:${opportunity.id}`],
      opportunityId: opportunity.id,
      opportunityUrl: opportunity.url,
      proposalText: packet.proposalText,
      demoUrl: packet.demoUrl,
      amount: packet.amount
    });
    created.push({ id: row.id, opportunityId: opportunity.id, title: opportunity.title, amount: packet.amount, demoUrl: packet.demoUrl });
    existingIds.add(opportunity.id);
  }
  return { created, createdCount: created.length, limit, remainingEligible: Math.max(0, candidates.length - created.length), mode: 'visual_review' };
}

function iaPrompt(o) {
  return [
    'Projeto moneyIA — analisar oportunidade.',
    '',
    `Título: ${o.title}`,
    `Plataforma: ${o.platform}`,
    `URL: ${o.url}`,
    `Orçamento: ${o.budget || 'desconhecido'}`,
    `Prioridade: ${o.priority || 'não definida'}`,
    `Estado verificado: ${o.status || 'não registrado'}`,
    `Verificação: ${o.verification || 'não registrada'}`,
    '',
    'Responda em português, curto e direto:',
    '1. Encaixe real no que o moneyIA consegue entregar.',
    '2. Riscos e o que não pode ser prometido.',
    '3. Preço-âncora e prazo condicionado a insumos.',
    '4. Próximo passo seguro (incluindo se vale ou não proposta).',
    '5. Se falta prova pública, diga qual e não invente experiência.',
    '',
    'Regras: sem promessa de renda, sem posição no Google, sem criar conta/KYC, sem disparo automático de WhatsApp.'
  ].join('\n');
}

async function sendToAiWebhook(item, requestedProvider) {
  const selected = await chooseAiProvider(requestedProvider || 'chatgpt');
  const preferred = selected.provider;
  // A preferência é apenas a primeira tentativa. Uma ponte configurada pode
  // estar fora do ar, por isso a fila precisa continuar com o próximo agente.
  // Não fazemos fallback silencioso quando o operador pediu um provedor
  // específico: o chamador pode repetir sem providerId para usar a cascata.
  const candidates = requestedProvider
    ? [preferred].filter(Boolean)
    : selected.providers.filter((p) => p.habilitado && p.endpointConfigured && p.cotaDisponivel === true);
  const attempts = [];
  if (!candidates.length) return {
    status: 'aguardando_ponte', webhookStatus: null, providerId: preferred?.id || null,
    providerLabel: preferred?.label || 'Nenhum agente configurado', providers: selected.providers, attempts
  };

  for (const provider of candidates) {
   if (provider?.id === 'ollama') {
    const url = process.env.MONEYIA_OLLAMA_URL || 'http://127.0.0.1:11434/api/chat';
    const model = provider.modelo || process.env.MONEYIA_OLLAMA_MODEL || 'qwen3.5:4b';
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        signal: AbortSignal.timeout(180000),
        body: JSON.stringify({
          model,
          stream: false,
          think: false,
          messages: [{ role: 'user', content: item.prompt }],
          options: { temperature: 0.2, num_predict: 600 }
        })
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { attempts.push(`${provider.id}: HTTP ${res.status}`); continue; }
      return {
        status: 'despachada',
        webhookStatus: res.status,
        providerId: provider.id,
        providerLabel: `${provider.label} (${model})`,
        providers: selected.providers,
        response: typeof body.message?.content === 'string' ? body.message.content : null
      };
    } catch (error) {
      attempts.push(`${provider.id}: ${error.message}`);
      continue;
    }
  }
  const url = provider ? (
    process.env[providerEnv[provider.id]]
    || (provider.id === 'jarvis' ? 'http://127.0.0.1:8080/api/moneyia/fallback' : '')
    || (provider.id === 'chatgpt' ? process.env.MONEYIA_AI_WEBHOOK_URL : '')
  ) : '';
  if (!provider || !url) { attempts.push(`${provider?.id || 'unknown'}: sem endpoint`); continue; }
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(process.env.MONEYIA_AI_WEBHOOK_TOKEN ? { authorization: `Bearer ${process.env.MONEYIA_AI_WEBHOOK_TOKEN}` } : {})
      },
      signal: AbortSignal.timeout(Number(process.env.MONEYIA_AI_DISPATCH_TIMEOUT_MS || 10000)),
      body: JSON.stringify({ type: 'oportunidade_moneyia', provider: provider.id, item })
    });
    if (!res.ok) { attempts.push(`${provider.id}: HTTP ${res.status}`); continue; }
    const body = await res.json().catch(() => ({}));
    return { status: 'despachada', webhookStatus: res.status, providerId: provider.id, providerLabel: provider.label, providers: selected.providers, response: typeof body.response === 'string' ? body.response : null, attempts };
  } catch (error) {
    attempts.push(`${provider.id}: ${error.message}`);
    continue;
  }
  }
  return { status: 'falha_dispatch', webhookStatus: attempts.join(' | '), providerId: candidates.at(-1)?.id || null, providerLabel: 'Nenhum agente respondeu', providers: selected.providers, attempts };
}

async function sendAgentAnswerWebhook(question, answer) {
  const url = process.env.MONEYIA_AGENT_WEBHOOK_URL;
  if (!url) return { status: 'local', webhookStatus: null };
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(process.env.MONEYIA_AGENT_WEBHOOK_TOKEN ? { authorization: `Bearer ${process.env.MONEYIA_AGENT_WEBHOOK_TOKEN}` } : {})
      },
      body: JSON.stringify({
        type: 'moneyia_titular_answer',
        question: { id: question.id, agent: question.agent, title: question.title, field: question.field, type: question.type },
        answer
      })
    });
    return { status: res.ok ? 'webhook' : 'falha_webhook', webhookStatus: res.status };
  } catch (error) {
    return { status: 'falha_webhook', webhookStatus: error.message };
  }
}

async function sendProposalDispatchWebhook(approval, dispatch, requestedProviderId = '') {
  const prompt = [
    'Atue como agente de apoio ao despacho do moneyIA.',
    `Despacho: ${dispatch.id} | plataforma/projeto: ${approval.target || approval.title}.`,
    `URL original: ${approval.opportunityUrl || 'não informada'}.`,
    `Proposta preparada: ${approval.proposalText || 'ver aprovação na Mesa'}.`,
    `Demo pública: ${approval.demoUrl || 'não informada'}.`,
    `Valor: ${approval.amount || 'não informado'}.`,
    'Organize o próximo passo operacional, confira o que precisa ser verificado na página autenticada e devolva um checklist curto para o agente. Não declare envio externo, contratação ou recebimento sem evidência da plataforma.'
  ].join('\n');
  const attempts = [];
  const configuredUrl = process.env.MONEYIA_AGENT_WEBHOOK_URL;
  const providers = await readAiProviders();
  const candidates = [];
  if (configuredUrl) candidates.push({ id: 'webhook', label: 'Agente configurado', endpointConfigured: true, cotaDisponivel: true, preferencia: 0, url: configuredUrl });
  for (const provider of providers) {
    if (!provider.habilitado || provider.endpointConfigured !== true || provider.cotaDisponivel !== true) continue;
    if (['chatgpt', 'deepseek', 'gemini', 'ollama', 'jarvis'].includes(provider.id)) candidates.push(provider);
  }
  candidates.sort((a, b) => {
    const aRequested = requestedProviderId && a.id === requestedProviderId ? 0 : 1;
    const bRequested = requestedProviderId && b.id === requestedProviderId ? 0 : 1;
    return aRequested - bRequested || Number(a.preferencia || 99) - Number(b.preferencia || 99);
  });
  // An explicit provider selection is a deliberate operator choice. Do not
  // silently fall through to a different model in that case; the caller can
  // retry without providerId to use the normal redundancy order.
  if (requestedProviderId) {
    const requested = candidates.filter((provider) => provider.id === requestedProviderId);
    if (requested.length) candidates.splice(0, candidates.length, ...requested);
  }
  if (!candidates.length) return { status: 'aguardando_agente', webhookStatus: 'nenhum agente disponível', providerId: null, providerLabel: 'Fila local' };
  for (const provider of candidates) {
    try {
      const url = provider.url || (provider.id === 'ollama'
        ? (process.env.MONEYIA_OLLAMA_URL || 'http://127.0.0.1:11434/api/chat')
        : provider.id === 'jarvis'
          ? (process.env.MONEYIA_JARVIS_DISPATCH_URL || 'http://127.0.0.1:8080/api/moneyia/fallback')
          : process.env[providerEnv[provider.id]]);
      if (!url) { attempts.push(`${provider.id}: sem endpoint`); continue; }
      const isOllama = provider.id === 'ollama';
      const isJarvis = provider.id === 'jarvis';
      const model = provider.modelo || process.env.MONEYIA_OLLAMA_MODEL || 'qwen3.5:4b';
      const payload = isOllama
        ? { model, stream: false, think: false, messages: [{ role: 'user', content: prompt }], options: { temperature: 0.2, num_predict: 700 } }
        : isJarvis
          ? { prompt, item: { type: 'moneyia_proposal_approved', approval, dispatch } }
          : { type: 'moneyia_proposal_approved', approval, dispatch, instruction: 'Preparar o envio na plataforma indicada e retornar evidência verificável; não afirmar envio sem confirmação da página.' };
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(process.env.MONEYIA_AI_WEBHOOK_TOKEN ? { authorization: `Bearer ${process.env.MONEYIA_AI_WEBHOOK_TOKEN}` } : {}) },
        signal: AbortSignal.timeout(isOllama
          ? Number(process.env.MONEYIA_OLLAMA_DISPATCH_TIMEOUT_MS || 10000)
          : Number(process.env.MONEYIA_AI_DISPATCH_TIMEOUT_MS || 8000)),
        body: JSON.stringify(payload)
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { attempts.push(`${provider.id}: HTTP ${res.status}`); continue; }
      // Ollama is a local reasoning fallback. It can prepare the checklist,
      // but it cannot prove that a proposal was submitted on an external site.
      // Keep the dispatch visible for the browser/human step instead of
      // pretending that a local model is an external sender.
      if (isOllama) {
        return {
          status: 'aguardando_evidencia',
          webhookStatus: res.status,
          providerId: provider.id,
          providerLabel: `${provider.label} (${model})`,
          response: typeof body.response === 'string' ? body.response : (typeof body.message?.content === 'string' ? body.message.content : null),
          attempts,
          requiresExternalEvidence: true
        };
      }
      return {
        status: 'despachada_ao_agente',
        webhookStatus: res.status,
        providerId: provider.id,
        providerLabel: isOllama ? `${provider.label} (${model})` : provider.label,
        response: typeof body.response === 'string' ? body.response : (typeof body.message?.content === 'string' ? body.message.content : null),
        attempts
      };
    } catch (error) {
      attempts.push(`${provider.id}: ${error.message}`);
    }
  }
  return { status: 'falha_agente', webhookStatus: attempts.join(' | '), providerId: candidates.at(-1)?.id || null, providerLabel: 'Nenhum agente respondeu', attempts };
}

let dispatchSchedulerInFlight = false;

function dispatchPlatform(approval = {}) {
  const text = String(approval.target || approval.platform || approval.plataforma || approval.source || '').trim();
  return (text.split(/\s*[·|—-]\s*/)[0] || 'desconhecida').slice(0, 80);
}

async function runDispatchScheduler(force = false) {
  if (dispatchSchedulerInFlight) return { status: 'busy' };
  const config = await readDispatchScheduler();
  if (!config.enabled && !force) return { status: 'disabled', config };
  if (!force && config.nextAt && Date.parse(config.nextAt) > Date.now()) return { status: 'waiting', config };
  const [dispatches, approvals] = await Promise.all([readProposalDispatch(), readApprovals()]);
  const approvalById = new Map(approvals.map((row) => [row.id, row]));
  let pending = [];
  // New approvals take precedence over failed agent retries so one broken
  // bridge cannot block the entire one-at-a-time queue.
  const nextApproval = approvals
    .filter((row) => row.status === 'pendente' && row.actionType === 'candidatura')
    .sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')))
    .find((row) => row.opportunityId);
  if (nextApproval) {
    const approved = await decideApproval(nextApproval.id, 'aprovar', 'fila-automatica', 'Encaminhamento automático um-a-um; intervalo de 5 minutos.');
    const created = await createProposalDispatch({ opportunityId: approved.opportunityId, approvalId: approved.id, provider: 'deepseek' });
    pending = [{ row: created, approval: approved }];
  } else {
    pending = dispatches
      .filter((row) => !row.sent && row.status === 'aguardando_agente')
      .map((row) => ({ row, approval: approvalById.get(row.approvalId) }))
      .filter((item) => item.approval)
      .sort((a, b) => String(a.row.createdAt || '').localeCompare(String(b.row.createdAt || '')));
  }
  if (!pending.length) {
    const done = { ...config, nextAt: null, inFlight: false, lastRunAt: new Date().toISOString() };
    await writeDispatchScheduler(done);
    return { status: 'empty', config: done };
  }
  const candidate = pending.find((item) => dispatchPlatform(item.approval) !== config.lastPlatform) || pending[0];
  dispatchSchedulerInFlight = true;
  const running = { ...config, inFlight: true, lastRunAt: new Date().toISOString() };
  await writeDispatchScheduler(running);
  try {
    const delivery = await sendProposalDispatchWebhook(candidate.approval, candidate.row);
    const updated = await updateProposalDispatch(candidate.row.id, {
      status: delivery.status,
      provider: delivery.providerId || candidate.row.provider,
      agent: delivery.providerId || candidate.row.agent,
      note: `Encaminhamento automático interno (${delivery.providerLabel || delivery.status}); sem confirmação externa.`
    });
    const next = {
      ...running,
      enabled: true,
      inFlight: false,
      nextAt: new Date(Date.now() + Math.max(60000, Number(config.intervalMs || 300000))).toISOString(),
      lastDispatchId: candidate.row.id,
      lastPlatform: dispatchPlatform(candidate.approval),
      processedCount: Number(config.processedCount || 0) + 1
    };
    await writeDispatchScheduler(next);
    return { status: 'processed', dispatch: updated, delivery, config: next };
  } catch (error) {
    const next = { ...running, inFlight: false, nextAt: new Date(Date.now() + Math.max(60000, Number(config.intervalMs || 300000))).toISOString() };
    await writeDispatchScheduler(next);
    return { status: 'error', error: String(error.message || error), config: next };
  } finally { dispatchSchedulerInFlight = false; }
}

setInterval(() => { runDispatchScheduler().catch(() => {}); }, 15000).unref();

async function state() {
  const [approvals, tasks, ia, questions, brl, usd, finance, pendencias, proposals, proposalChecks, proposalDispatch, emailInbox, emailWatchStatus, radarRuns, radarGates, radarOpportunities, radarSessions, dispatchScheduler] = await Promise.all([
    readApprovals(), readTasks(), readIa(), readAgentQuestions(),
    readJson('opportunities-brl.json', []), readJson('opportunities-usd.json', []),
    readJson('finance.json', {}), readJson('pendencias.json', []), sentProposals(), readChecks(), readProposalDispatch(), readEmailInbox(),
    readEmailWatchStatus(), readRadarRuns(), readRadarGates(), readRadarOpportunities(), readRadarSessions(), readDispatchScheduler()
  ]);
  const bridge = bridgeSnapshot(await readAiProviders(), ia, proposalDispatch);
  const pendingGates = radarGates.filter((gate) => gate.status === 'pending');
  const gateKey = (gate) => `${gate.type}|${canonicalUrl(gate.url)}`;
  const visibleGates = [...new Map(pendingGates.map((gate) => [gateKey(gate), gate])).values()];
  return {
    now: new Date().toISOString(),
    summary: summarize(approvals, tasks),
    approvals: approvals.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))),
    tasks: tasks.sort((a, b) => {
      const rank = { alta: 0, media: 1, baixa: 2 };
      return (rank[a.priority] ?? 9) - (rank[b.priority] ?? 9);
    }),
    ia,
    agentQuestions: questions.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))),
    agentWebhook: Boolean(process.env.MONEYIA_AGENT_WEBHOOK_URL),
    aiWebhook: Boolean(process.env.MONEYIA_AI_WEBHOOK_URL || process.env.MONEYIA_CHATGPT_DISPATCH_URL || process.env.MONEYIA_DEEPSEEK_DISPATCH_URL || process.env.MONEYIA_GEMINI_DISPATCH_URL),
    aiProviders: await readAiProviders(),
    bridge,
    opportunities: {
      brl: brl.length,
      usd: usd.length,
      recent: [...brl, ...usd]
        .sort((a, b) => String(b.checked || '').localeCompare(String(a.checked || '')))
        .map((o) => ({ id: o.id, title: o.title, platform: o.platform, priority: o.priority, status: o.status, url: o.url, checked: o.checked, budget: o.budget }))
    },
    pendencias: pendencias.filter((p) => p.status === 'pendente'),
    proposals: proposals.map(p => ({ ...p, check: proposalChecks[p.id] || { status: 'nao_verificada', evidence: 'Aguardando primeira conferência automática.' } })),
    proposalDispatch,
    dispatchScheduler,
    emailInbox,
    emailWatchStatus,
    radar: {
      runs: radarRuns.slice(-20).reverse(),
      gates: visibleGates,
      opportunities: mergeOpportunities([...brl, ...usd, ...(await readJson('global-opportunities-2026-11-26.json', [])), ...radarOpportunities]).slice(0, 100),
      sessions: radarSessions.map((session) => ({ platform: session.platform, status: session.status, runId: session.runId, lastSeen: session.lastSeen }))
    },
    finance
  };
}

async function serveFile(res, file) {
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': mime[extname(file)] || 'text/plain; charset=utf-8', 'cache-control': 'no-cache' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Não encontrado');
  }
}

async function serveStatic(req, res, pathname) {
  const safe = pathname === '/' ? '/index.html' : pathname;
  if (safe.includes('..')) return sendJson(res, 400, { error: 'caminho inválido' });
  return serveFile(res, join(publicDir, safe));
}

const server = createServer(async (req, res) => {
  if (!authorized(req)) {
    res.writeHead(401, {
      'content-type': 'text/plain; charset=utf-8',
      'www-authenticate': 'Basic realm="moneyIA", charset="UTF-8"'
    });
    return res.end('Autenticação necessária.');
  }
  const url = new URL(req.url, `http://127.0.0.1:${port}`);
  const path = url.pathname;

  try {
    if (req.method === 'GET' && path === '/api/health') return sendJson(res, 200, { ok: true, service: 'moneyIA approvals', time: new Date().toISOString() });
    if (req.method === 'GET' && path === '/api/ia/providers') return sendJson(res, 200, { providers: await readAiProviders(), preferred: 'chatgpt' });
    if (req.method === 'GET' && path === '/api/bridge/status') {
      const [providers, ia, proposalDispatch] = await Promise.all([readAiProviders(), readIa(), readProposalDispatch()]);
      return sendJson(res, 200, bridgeSnapshot(providers, ia, proposalDispatch));
    }
    if (req.method === 'GET' && path === '/api/state') return sendJson(res, 200, await state());
    if (req.method === 'GET' && path === '/api/radar/runs') return sendJson(res, 200, (await readRadarRuns()).slice(-50).reverse());
    if (req.method === 'POST' && path === '/api/radar/runs') {
      const body = await readBody(req);
      const result = await startRadarRun({ mode: body.mode || 'shadow', shards: body.shards || 6 });
      return sendJson(res, 201, result);
    }
    if (req.method === 'POST' && path === '/api/radar/send-queue') {
      const body = await readBody(req);
      const result = await prepareRadarSendQueue(body.limit || 30);
      return sendJson(res, 201, { ...result, message: result.createdCount ? `${result.createdCount} pacote(s) aguardando revisão visual.` : 'Nenhum pacote novo elegível nesta leitura.' });
    }
    const radarRunPath = path.match(/^\/api\/radar\/runs\/([^/]+)$/);
    if (req.method === 'GET' && radarRunPath) {
      const run = (await readRadarRuns()).find((item) => item.id === decodeURIComponent(radarRunPath[1]));
      if (!run) return sendJson(res, 404, { error: 'execução do radar não encontrada' });
      const gates = (await readRadarGates()).filter((gate) => gate.runId === run.id);
      const opportunities = (await readRadarOpportunities()).filter((item) => run.resultIds?.includes(item.id));
      return sendJson(res, 200, { run, gates, opportunities });
    }
    const radarResultsPath = path.match(/^\/api\/radar\/runs\/([^/]+)\/results$/);
    if (req.method === 'POST' && radarResultsPath) {
      const runId = decodeURIComponent(radarResultsPath[1]);
      const runs = await readRadarRuns();
      const run = runs.find((item) => item.id === runId);
      if (!run) return sendJson(res, 404, { error: 'execução do radar não encontrada' });
      if (run.status === 'completed') return sendJson(res, 409, { error: 'execução já concluída' });
      const body = await readBody(req);
      const incoming = Array.isArray(body.results) ? body.results.slice(0, 500) : [];
      if (!incoming.length) return sendJson(res, 400, { error: 'results deve ser uma lista não vazia' });
      const existing = await readRadarOpportunities();
      const merged = mergeOpportunities([...existing, ...incoming.map((row) => ({ ...row, source: body.source || row.source || 'public', sourceShard: body.shardId || row.sourceShard }))]);
      const result = updateRunFromResults(run, merged);
      const allGates = await readRadarGates();
      for (const item of result.gates) {
        const gate = gateRecord({ runId, platform: item.platform || body.platform, url: item.url, gate: item.gate });
        const gateKey = `${gate.type}|${canonicalUrl(gate.url)}`;
        if (run.resolvedGateKeys?.includes(gateKey)) continue;
        if (!allGates.some((candidate) => candidate.runId === runId && canonicalUrl(candidate.url) === canonicalUrl(gate.url) && candidate.type === gate.type && candidate.status !== 'expired')) allGates.push(gate);
      }
      run.gateIds = allGates.filter((gate) => gate.runId === runId && gate.status === 'pending').map((gate) => gate.id);
      run.resultIds = result.normalized.map((item) => item.id);
      run.status = run.gateIds.length ? 'paused' : 'completed';
      await writeRadarOpportunities(merged);
      await writeRadarGates(allGates);
      const index = runs.findIndex((item) => item.id === runId);
      runs[index] = run;
      await writeRadarRuns(runs);
      return sendJson(res, 200, { run, added: incoming.length, opportunities: result.normalized, gates: allGates.filter((gate) => gate.runId === runId) });
    }
    const radarResumePath = path.match(/^\/api\/radar\/runs\/([^/]+)\/resume$/);
    if (req.method === 'POST' && radarResumePath) {
      const runId = decodeURIComponent(radarResumePath[1]);
      const runs = await readRadarRuns();
      const run = runs.find((item) => item.id === runId);
      if (!run) return sendJson(res, 404, { error: 'execução do radar não encontrada' });
      const pending = (await readRadarGates()).filter((gate) => gate.runId === runId && gate.status === 'pending');
      if (pending.length) return sendJson(res, 409, { error: 'há pendências humanas antes da retomada', gates: pending });
      run.status = 'running';
      run.updatedAt = new Date().toISOString();
      await writeRadarRuns(runs);
      const result = await shadowRadarRun(run);
      return sendJson(res, 200, result);
    }
    if (req.method === 'GET' && path === '/api/browser/gates') {
      const status = url.searchParams.get('status');
      const gates = await readRadarGates();
      if (status) {
        const filtered = gates.filter((gate) => gate.status === status);
        if (status !== 'pending') return sendJson(res, 200, filtered);
        return sendJson(res, 200, [...new Map(filtered.map((gate) => [`${gate.type}|${canonicalUrl(gate.url)}`, gate])).values()]);
      }
      const pending = gates.filter((gate) => gate.status === 'pending');
      const uniquePending = [...new Map(pending.map((gate) => [`${gate.type}|${canonicalUrl(gate.url)}`, gate])).values()];
      return sendJson(res, 200, [...gates.filter((gate) => gate.status !== 'pending'), ...uniquePending]);
    }
    const gatePath = path.match(/^\/api\/browser\/gates\/([^/]+)\/complete$/);
    if (req.method === 'POST' && gatePath) {
      const gateId = decodeURIComponent(gatePath[1]);
      const body = await readBody(req);
      const gates = await readRadarGates();
      const gate = gates.find((item) => item.id === gateId);
      if (!gate) return sendJson(res, 404, { error: 'pendência de navegador não encontrada' });
      if (gate.status !== 'pending') return sendJson(res, 409, { error: `pendência já está ${gate.status}` });
      const completed = completeGate(gate, body.by || 'titular', body.evidence);
      Object.assign(gate, completed);
      // A mesma sessão/portal can generate one gate per radar run. Completing
      // the browser step must clear equivalent pending gates globally, or the
      // user sees the same login/challenge again on the next refresh.
      const gateKey = `${gate.type}|${canonicalUrl(gate.url)}`;
      const equivalent = gates.filter((candidate) => candidate.status === 'pending'
        && `${candidate.type}|${canonicalUrl(candidate.url)}` === gateKey);
      for (const candidate of equivalent) Object.assign(candidate, completeGate(candidate, body.by || 'titular', body.evidence));
      await writeRadarGates(gates);
      const runs = await readRadarRuns();
      const touchedRuns = [];
      for (const run of runs) {
        const hadGate = gates.some((item) => item.runId === run.id && `${item.type}|${canonicalUrl(item.url)}` === gateKey)
          || run.gateIds?.includes(gate.id);
        if (!hadGate) continue;
        run.resolvedGateKeys = [...new Set([...(run.resolvedGateKeys || []), gateKey])];
        run.gateIds = gates.filter((item) => item.runId === run.id && item.status === 'pending').map((item) => item.id);
        // No pending gates means the last browser step is already complete.
        // Mark the run terminal here instead of relying on a second UI request
        // to /resume (which could be lost on refresh and leave it looking stuck).
        run.status = run.gateIds.length ? 'paused' : 'completed';
        run.updatedAt = new Date().toISOString();
        touchedRuns.push(run);
      }
      await writeRadarRuns(runs);
      const run = runs.find((item) => item.id === gate.runId) || null;
      const remaining = gates.filter((item) => item.status === 'pending' && `${item.type}|${canonicalUrl(item.url)}` === gateKey).length;
      return sendJson(res, 200, { gate, run, clearedGateIds: [gate.id, ...equivalent.map((item) => item.id)], touchedRuns: touchedRuns.map((item) => item.id), remainingEquivalent: remaining, message: remaining ? 'Pendência concluída; há outra etapa equivalente pendente.' : 'Pendência concluída em todas as execuções; a fila não repetirá esta etapa.' });
    }
    if (req.method === 'POST' && path === '/api/radar/sessions/acquire') {
      const body = await readBody(req);
      const platform = String(body.platform || '').trim();
      const runId = String(body.runId || '').trim();
      if (!platform || !runId) return sendJson(res, 400, { error: 'platform e runId são obrigatórios' });
      const sessions = await readRadarSessions();
      if (!canAcquireSession(sessions, platform, runId)) return sendJson(res, 409, { error: 'já existe uma sessão autenticada ativa para esta plataforma' });
      const row = { platform, platformKey: sessionKey(platform), runId, status: 'active', lockedAt: new Date().toISOString(), lastSeen: new Date().toISOString() };
      sessions.push(row);
      await writeRadarSessions(sessions);
      return sendJson(res, 201, row);
    }
    if (req.method === 'POST' && path === '/api/radar/sessions/release') {
      const body = await readBody(req);
      const sessions = await readRadarSessions();
      const row = sessions.find((item) => item.platformKey === sessionKey(body.platform) && item.runId === String(body.runId || ''));
      if (!row) return sendJson(res, 404, { error: 'sessão não encontrada' });
      row.status = 'released';
      row.releasedAt = new Date().toISOString();
      await writeRadarSessions(sessions);
      return sendJson(res, 200, row);
    }
    if (req.method === 'GET' && path === '/api/opportunities') {
      const rows = await readAllOpportunities();
      const country = fold(url.searchParams.get('country') || '');
      const language = fold(url.searchParams.get('language') || '');
      const currency = fold(url.searchParams.get('currency') || '');
      const payout = fold(url.searchParams.get('payout') || '');
      const demand = Number(url.searchParams.get('minDemand') || 0);
      const limit = Math.min(200, Math.max(1, Number(url.searchParams.get('limit') || 100)));
      const filtered = rows.filter((row) => {
        if (country && !fold(row.country).includes(country)) return false;
        if (language && !fold(row.language).includes(language)) return false;
        if (currency && !fold(row.currency).includes(currency)) return false;
        if (payout && !fold(row.payoutStatus).includes(payout)) return false;
        if (demand && Number(row.radarScore?.demand || 0) < demand) return false;
        return true;
      });
      return sendJson(res, 200, { total: filtered.length, opportunities: filtered.slice(0, limit) });
    }
    if (req.method === 'GET' && path === '/api/emails') return sendJson(res, 200, await readEmailInbox());
    if (req.method === 'GET' && path === '/api/emails/watch') return sendJson(res, 200, await readEmailWatchStatus());
    if (req.method === 'POST' && path === '/api/emails/ingest') {
      const body = await readBody(req);
      const incoming = Array.isArray(body.emails) ? body.emails.slice(0, 500) : [];
      if (!incoming.length) return sendJson(res, 400, { error: 'emails deve ser uma lista não vazia' });
      const previous = await readEmailInbox();
      const merged = [...(previous.emails || []), ...incoming];
      const analysis = analyzeEmails(merged);
      await writeEmailInbox({ ...analysis, source: body.source || 'gmail-connector' });
      const tasks = await readTasks();
      // Gmail IDs can arrive as a bare provider ID or with a `gmail:` prefix.
      // Normalize both forms so repeated watcher/connector scans never create
      // a second task for the same message.
      const emailIdKeys = (value) => {
        const raw = String(value || '').trim();
        if (!raw) return [];
        const withoutProvider = raw.replace(/^gmail:/i, '');
        return [...new Set([raw, withoutProvider, withoutProvider.split(':').pop()])];
      };
      const taskEmails = new Set();
      for (const task of tasks) {
        const match = String(task.description || '').match(/email-id:([^\s\]]+)/i);
        for (const key of emailIdKeys(match?.[1])) taskEmails.add(key);
      }
      const createdTasks = [];
      for (const email of analysis.emails) {
        const keys = emailIdKeys(email.id);
        if (!['acceptance_or_client_reply', 'new_opportunity', 'account_security'].includes(email.kind) || !keys.length || keys.some((key) => taskEmails.has(key))) continue;
        const title = email.kind === 'new_opportunity'
          ? `Revisar nova oportunidade recebida por e-mail — ${email.subject}`
          : email.kind === 'account_security'
            ? `Verificar segurança da conta — ${email.subject}`
            : `Verificar possível aceite/resposta de cliente — ${email.subject}`;
        createdTasks.push(await createTask({
          title: title.slice(0, 160),
          description: `[email-id:${email.id}] ${email.reason}\nDe: ${email.from}\n${email.snippet}`.slice(0, 2000),
          source: 'gmail-moneyia',
          assignee: email.kind === 'account_security' ? 'titular' : 'codex',
          priority: email.priority
        }));
        keys.forEach((key) => taskEmails.add(key));
      }
      return sendJson(res, 200, { analysis, createdTasks: createdTasks.map((task) => task.id) });
    }
    if (req.method === 'POST' && path === '/api/propostas/verificar') {
      const result = await verifyProposals();
      return sendJson(res, result.busy ? 202 : 200, result);
    }
    const verifyOne = path.match(/^\/api\/propostas\/([^/]+)\/verificar$/);
    if (req.method === 'POST' && verifyOne) {
      const id = decodeURIComponent(verifyOne[1]);
      if (!(await sentProposals()).some(p => p.id === id)) return sendJson(res, 404, { error: 'proposta enviada não encontrada' });
      const result = await verifyProposals([id]);
      return sendJson(res, result.busy ? 202 : 200, result);
    }
    if (req.method === 'GET' && path === '/api/agent-questions') {
      const questions = await readAgentQuestions();
      const status = url.searchParams.get('status');
      return sendJson(res, 200, status ? questions.filter((q) => q.status === status) : questions);
    }
    if (req.method === 'GET' && path === '/api/proposal-dispatch') {
      const rows = await readProposalDispatch();
      const status = url.searchParams.get('status');
      const opportunityId = url.searchParams.get('opportunityId');
      const filtered = rows.filter((row) => {
        if (status && row.status !== status) return false;
        if (opportunityId && row.opportunityId !== opportunityId) return false;
        return true;
      });
      return sendJson(res, 200, filtered);
    }
    if (req.method === 'GET' && (path === '/dashboard' || path === '/dashboard/')) {
      return serveFile(res, join(root, 'dashboard', 'index.html'));
    }

    if (req.method === 'POST' && path === '/api/aprovacoes') {
      const body = await readBody(req);
      if (!body.title) return sendJson(res, 400, { error: 'title é obrigatório' });
      const row = await createApproval(body);
      return sendJson(res, 201, row);
    }

    if (req.method === 'POST' && path === '/api/aprovacoes/from-opportunity') {
      const body = await readBody(req);
      const opportunityId = String(body.opportunityId || '').trim();
      if (!opportunityId) return sendJson(res, 400, { error: 'opportunityId é obrigatório' });
      const opportunity = await findOpportunity(opportunityId);
      if (!opportunity) return sendJson(res, 404, { error: 'oportunidade não encontrada' });
      const existing = (await readApprovals()).find((row) => row.opportunityId === opportunityId && ['pendente', 'aprovada'].includes(row.status));
      if (existing) return sendJson(res, 200, { approval: existing, created: false, delivery: 'already_queued' });
      const proposalText = String(body.proposalText || opportunity.proposal || '').trim();
      const demoUrl = String(body.demoUrl || opportunity.demoUrl || '').trim();
      if (!proposalText || !demoUrl) return sendJson(res, 409, { error: 'a oportunidade ainda não tem proposta e demo públicas suficientes' });
      const amount = String(body.amount || opportunity.proposalAmount || 'a definir após os insumos').slice(0, 80);
      const row = await createApproval({
        source: 'moneyIA-radar',
        title: `Enviar proposta ${opportunity.platform || 'plataforma'} — ${opportunity.title || opportunityId}`.slice(0, 160),
        description: `Pacote preparado pelo Radar. Demo pública: ${demoUrl}. Preço-âncora: ${amount}. O agente poderá preencher a etapa da plataforma depois da confirmação na Mesa e da revalidação da página autenticada.`,
        actionType: 'candidatura',
        target: `${opportunity.platform || 'plataforma'} · ${opportunityId}`,
        cost: 'R$ 0; eventual crédito/conexão somente se já disponível',
        files: [demoUrl, `opportunity:${opportunityId}`],
        opportunityId,
        opportunityUrl: opportunity.url,
        proposalText,
        demoUrl,
        amount
      });
      return sendJson(res, 201, { approval: row, created: true, delivery: 'pending_approval' });
    }

    if (req.method === 'POST' && path === '/api/aprovacoes/auto-prepare') {
      const body = await readBody(req);
      const requestedLimit = Number(body.limit || 30);
      const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(30, Math.floor(requestedLimit))) : 30;
      const [brl, usd, approvals] = await Promise.all([
        readJson('opportunities-brl.json', []),
        readJson('opportunities-usd.json', []),
        readApprovals()
      ]);
      const existingIds = new Set(approvals.map((row) => row.opportunityId).filter(Boolean));
      const rows = rankOpportunities([...brl, ...usd]);
      const byId = new Map(rows.map((opportunity) => [opportunity.id, opportunity]));
      const repaired = [];
      for (const existing of approvals.filter((row) => row.source === 'moneyIA-auto-radar' && row.status === 'pendente' && row.opportunityId)) {
        const opportunity = byId.get(existing.opportunityId);
        if (!opportunity) continue;
        const packet = buildProposalPacket(opportunity);
        const description = `Pacote preparado automaticamente pelo Radar. Verificação: ${opportunity.verification}. Estado observado: ${String(opportunity.status || 'não informado').slice(0, 500)}. Demo pública: ${packet.demoUrl}. Preço-âncora: ${packet.amount}. O agente só preenche a plataforma depois da sua aprovação e de revalidar a sessão autenticada.`;
        if (existing.amount !== packet.amount || existing.demoUrl !== packet.demoUrl || existing.proposalText !== packet.proposalText) {
          await updateApproval(existing.id, { amount: packet.amount, demoUrl: packet.demoUrl, proposalText: packet.proposalText, description, files: [packet.demoUrl, `opportunity:${opportunity.id}`] });
          repaired.push(existing.id);
        }
      }
      const candidates = rows.filter((opportunity) => !existingIds.has(opportunity.id) && isOpportunityEligible(opportunity).ok);
      const created = [];
      for (const opportunity of candidates.slice(0, limit)) {
        const packet = buildProposalPacket(opportunity);
        const row = await createApproval({
          source: 'moneyIA-auto-radar',
          title: `Enviar proposta ${opportunity.platform || 'plataforma'} — ${opportunity.title}`.slice(0, 160),
          description: `Pacote preparado automaticamente pelo Radar. Verificação: ${opportunity.verification}. Estado observado: ${String(opportunity.status || 'não informado').slice(0, 500)}. Demo pública: ${packet.demoUrl}. Preço-âncora: ${packet.amount}. O agente só preenche a plataforma depois da sua aprovação e de revalidar a sessão autenticada.`,
          actionType: 'candidatura',
          target: `${opportunity.platform || 'plataforma'} · ${opportunity.id}`,
          cost: 'R$ 0; eventual crédito/conexão somente se já disponível',
          files: [packet.demoUrl, `opportunity:${opportunity.id}`],
          opportunityId: opportunity.id,
          opportunityUrl: opportunity.url,
          proposalText: packet.proposalText,
          demoUrl: packet.demoUrl,
          amount: packet.amount
        });
        created.push({ id: row.id, opportunityId: opportunity.id, title: opportunity.title, amount: packet.amount, demoUrl: packet.demoUrl });
        existingIds.add(opportunity.id);
      }
      return sendJson(res, 201, {
        created,
        createdCount: created.length,
        repaired,
        limit,
        remainingEligible: candidates.length - created.length,
        message: created.length ? `${created.length} pacote(s) preparado(s) e aguardando sua aprovação.` : 'Nenhum pacote novo elegível nesta leitura.'
      });
    }

    if (req.method === 'POST' && path === '/api/agent-questions') {
      const body = await readBody(req);
      if (!String(body.title || body.prompt || body.question || '').trim()) {
        return sendJson(res, 400, { error: 'title ou prompt é obrigatório' });
      }
      const row = await createAgentQuestion(body);
      return sendJson(res, 201, row);
    }

    const answerQuestion = path.match(/^\/api\/agent-questions\/([^/]+)\/answer$/);
    if (req.method === 'POST' && answerQuestion) {
      const body = await readBody(req);
      const questions = await readAgentQuestions();
      const question = questions.find((q) => q.id === decodeURIComponent(answerQuestion[1]));
      if (!question) return sendJson(res, 404, { error: 'pergunta do agente não encontrada' });
      if (question.sensitive && !process.env.MONEYIA_AGENT_WEBHOOK_URL) {
        return sendJson(res, 409, { error: 'resposta sensível exige MONEYIA_AGENT_WEBHOOK_URL; nada foi armazenado' });
      }
      const delivery = await sendAgentAnswerWebhook(question, body.answer);
      if (delivery.status === 'falha_webhook') {
        return sendJson(res, 502, { error: 'não foi possível encaminhar ao agente', detail: delivery.webhookStatus });
      }
      const row = await answerAgentQuestion(question.id, body.answer, body.by || 'titular', delivery.status);
      return sendJson(res, 200, { question: row, delivery: delivery.status });
    }

    const sendIa = path.match(/^\/api\/oportunidades\/([^/]+)\/enviar-ia$/);
    if (req.method === 'POST' && sendIa) {
      const opportunity = await findOpportunity(decodeURIComponent(sendIa[1]));
      if (!opportunity) return sendJson(res, 404, { error: 'oportunidade não encontrada' });
      const existing = (await readIa()).find((r) => r.opportunityId === opportunity.id && r.status !== 'respondida');
      if (existing) return sendJson(res, 200, { item: existing, delivery: 'already_queued' });

      const body = await readBody(req);
      const prompt = iaPrompt(opportunity);
      let item = await createIaItem({
        opportunityId: opportunity.id,
        title: opportunity.title,
        platform: opportunity.platform,
        url: opportunity.url,
        priority: opportunity.priority,
        budget: opportunity.budget,
        prompt,
        status: 'aguardando_ponte',
        providerId: String(body.providerId || 'chatgpt').slice(0, 40)
      });
      const delivery = await sendToAiWebhook(item, body.providerId || '');
      item = await setIaDelivery(item.id, delivery.status, delivery.webhookStatus, delivery.providerId, delivery.providerLabel);
      if (delivery.response) item = await setIaResponse(item.id, delivery.response, `dispatch:${delivery.providerId}`);
      return sendJson(res, 201, { item, delivery: delivery.status, provider: delivery.providerLabel, providers: delivery.providers });
    }

    const bridgeContinue = path.match(/^\/api\/bridge\/ia\/([^/]+)\/continuar$/);
    if (req.method === 'POST' && bridgeContinue) {
      const id = decodeURIComponent(bridgeContinue[1]);
      const item = (await readIa()).find((row) => row.id === id);
      if (!item) return sendJson(res, 404, { error: 'item da IA não encontrado' });
      if (item.status === 'respondida') return sendJson(res, 200, { item, delivery: 'already_answered' });
      const retorno = localFallback(item);
      const row = await setIaResponse(id, retorno, 'ponte_local');
      const task = await createTask({
        title: `Revisar rascunho da ponte — ${row.title}`.slice(0, 160),
        description: `Rascunho local gerado porque a IA não estava disponível.\nOportunidade: ${row.url}\n\n${retorno}`.slice(0, 2000),
        source: 'ponte-local',
        assignee: 'titular',
        priority: row.priority === 'alta' ? 'alta' : 'media'
      });
      return sendJson(res, 200, { item: row, task, delivery: 'local_fallback' });
    }

    const bridgeRetry = path.match(/^\/api\/bridge\/ia\/([^/]+)\/retry$/);
    if (req.method === 'POST' && bridgeRetry) {
      const id = decodeURIComponent(bridgeRetry[1]);
      const item = (await readIa()).find((row) => row.id === id);
      if (!item) return sendJson(res, 404, { error: 'item da IA não encontrado' });
      if (item.status === 'respondida') return sendJson(res, 200, { item, delivery: 'already_answered' });
      const body = await readBody(req);
      const delivery = await sendToAiWebhook(item, body.providerId || item.providerId || '');
      let row = await setIaDelivery(id, delivery.status, delivery.webhookStatus, delivery.providerId, delivery.providerLabel);
      if (delivery.response) row = await setIaResponse(id, delivery.response, `dispatch:${delivery.providerId}`);
      return sendJson(res, 200, { item: row, delivery: delivery.status, provider: delivery.providerLabel, providers: delivery.providers });
    }

    const iaReturn = path.match(/^\/api\/ia\/([^/]+)\/retorno$/);
    if (req.method === 'POST' && iaReturn) {
      const body = await readBody(req);
      if (!String(body.retorno || '').trim()) return sendJson(res, 400, { error: 'retorno é obrigatório' });
      const row = await setIaResponse(decodeURIComponent(iaReturn[1]), body.retorno, body.source || 'retorno_registrado');
      const task = await createTask({
        title: `Analisar retorno da IA — ${row.title}`.slice(0, 160),
        description: `Oportunidade: ${row.url}\n\nRetorno da IA:\n${row.retorno}`.slice(0, 2000),
        source: 'chatgpt',
        assignee: 'codex',
        priority: row.priority === 'alta' ? 'alta' : 'media'
      });
      return sendJson(res, 200, { item: row, task });
    }

    const decision = path.match(/^\/api\/aprovacoes\/([^/]+)\/decision$/);
    if (req.method === 'POST' && decision) {
      const body = await readBody(req);
      if (!['aprovar', 'rejeitar'].includes(body.decision)) return sendJson(res, 400, { error: 'decision deve ser aprovar ou rejeitar' });
      const row = await decideApproval(decodeURIComponent(decision[1]), body.decision, body.by || 'titular', body.note || '');
      let dispatch = null;
      let delivery = null;
      if (row.status === 'aprovada' && row.actionType === 'candidatura' && row.opportunityId) {
        const existing = (await readProposalDispatch()).find((item) => item.approvalId === row.id);
        dispatch = existing || await createProposalDispatch({ opportunityId: row.opportunityId, approvalId: row.id, provider: 'deepseek' });
        delivery = await sendProposalDispatchWebhook(row, dispatch);
        if (delivery.status !== 'aguardando_agente') {
          dispatch = await updateProposalDispatch(dispatch.id, {
            status: delivery.status,
            provider: delivery.providerId || dispatch.provider,
            agent: delivery.providerId || dispatch.agent,
            note: `Retorno da ponte do agente: ${delivery.webhookStatus ?? '2xx'}.`
          });
        }
        await createTask({
          title: `Enviar proposta aprovada — ${row.opportunityId}`.slice(0, 160),
          description: `Aprovação ${row.id} registrada. Demo: ${row.demoUrl || 'ver arquivos'}. Conferir a página e registrar evidência externa em /api/proposal-dispatch/${dispatch.id}/evidence. Estado atual: ${dispatch.status}.`,
          source: 'moneyIA-ponte',
          assignee: delivery?.providerId || 'deepseek',
          priority: 'alta'
        });
      }
      return sendJson(res, 200, { approval: row, dispatch, delivery });
    }

    if (req.method === 'GET' && path === '/api/proposal-dispatch/scheduler') {
      return sendJson(res, 200, await readDispatchScheduler());
    }
    if (req.method === 'POST' && path === '/api/proposal-dispatch/scheduler') {
      const body = await readBody(req);
      const current = await readDispatchScheduler();
      const enabled = body.enabled === undefined ? Boolean(current.enabled) : Boolean(body.enabled);
      const intervalMs = Math.max(60000, Math.min(86_400_000, Number(body.intervalMs || current.intervalMs || 300000)));
      const config = await writeDispatchScheduler({
        ...current,
        enabled,
        intervalMs,
        nextAt: enabled ? (body.runNow ? new Date().toISOString() : (current.nextAt || new Date().toISOString())) : null,
        inFlight: false
      });
      const result = enabled && body.runNow ? await runDispatchScheduler(true) : { status: enabled ? 'scheduled' : 'paused', config };
      return sendJson(res, 200, { ...result, config: result.config || config });
    }
    const dispatchEvidence = path.match(/^\/api\/proposal-dispatch\/([^/]+)\/evidence$/);
    const dispatchForward = path.match(/^\/api\/proposal-dispatch\/([^/]+)\/forward$/);
    const dispatchClaim = path.match(/^\/api\/proposal-dispatch\/([^/]+)\/claim$/);
    const dispatchRetry = path.match(/^\/api\/proposal-dispatch\/([^/]+)\/retry$/);
    if (req.method === 'POST' && dispatchRetry) {
      const id = decodeURIComponent(dispatchRetry[1]);
      const dispatch = (await readProposalDispatch()).find((row) => row.id === id);
      if (!dispatch) return sendJson(res, 404, { error: 'dispatch não encontrado' });
      if (dispatch.sent || dispatch.status === 'enviado_confirmado') return sendJson(res, 409, { error: 'dispatch já confirmado externamente' });
      const approval = (await readApprovals()).find((row) => row.id === dispatch.approvalId);
      if (!approval) return sendJson(res, 404, { error: 'aprovação do dispatch não encontrada' });
      const body = await readBody(req);
      const requestedProviderId = String(body.providerId || '').trim().slice(0, 40);
      const delivery = await sendProposalDispatchWebhook(approval, dispatch, requestedProviderId);
      const row = await updateProposalDispatch(id, {
        status: delivery.status,
        provider: delivery.providerId || dispatch.provider,
        agent: delivery.providerId || dispatch.agent,
        note: delivery.status === 'despachada_ao_agente'
          ? `Redundância acionada: ${delivery.providerLabel || delivery.providerId}; sem confirmação externa.`
          : `Todos os agentes disponíveis falharam: ${delivery.webhookStatus || 'sem retorno'}`
      });
      return sendJson(res, delivery.status === 'falha_agente' ? 502 : 200, { dispatch: row, delivery });
    }
    if (req.method === 'POST' && dispatchForward) {
      const id = decodeURIComponent(dispatchForward[1]);
      const dispatch = (await readProposalDispatch()).find((row) => row.id === id);
      if (!dispatch) return sendJson(res, 404, { error: 'dispatch não encontrado' });
      if (dispatch.sent || dispatch.status === 'enviado_confirmado') return sendJson(res, 409, { error: 'dispatch já confirmado externamente' });
      const approval = (await readApprovals()).find((row) => row.id === dispatch.approvalId);
      if (!approval) return sendJson(res, 404, { error: 'aprovação do dispatch não encontrada' });
      const body = await readBody(req);
      const requestedProviderId = String(body.providerId || '').trim().slice(0, 40);
      const delivery = await sendProposalDispatchWebhook(approval, dispatch, requestedProviderId);
      if (delivery.status === 'falha_agente') return sendJson(res, 502, { dispatch, delivery });
      const row = await updateProposalDispatch(id, {
        status: 'despachada_ao_agente',
        provider: delivery.providerId || dispatch.provider,
        agent: delivery.providerId || dispatch.agent,
        note: `Fila reencaminhada ao agente (${delivery.webhookStatus ?? 'fila local'}); sem confirmação externa.`
      });
      return sendJson(res, 200, { dispatch: row, delivery });
    }
    if (req.method === 'POST' && dispatchClaim) {
      const id = decodeURIComponent(dispatchClaim[1]);
      const dispatchRows = await readProposalDispatch();
      const dispatch = dispatchRows.find((row) => row.id === id);
      if (!dispatch) return sendJson(res, 404, { error: 'dispatch não encontrado' });
      if (dispatch.sent || dispatch.status === 'enviado_confirmado') return sendJson(res, 409, { error: 'dispatch já confirmado externamente' });
      const body = await readBody(req);
      const agent = String(body.agent || dispatch.provider || 'deepseek').slice(0, 60);
      const row = await updateProposalDispatch(id, {
        agent,
        status: 'em_execucao',
        note: `Agente ${agent} assumiu a conferência; ainda sem confirmação externa.`
      });
      const tasks = await readTasks();
      const task = tasks.find((item) => item.source === 'moneyIA-ponte' && item.description.includes(`/api/proposal-dispatch/${id}/evidence`));
      const updatedTask = task ? await updateTask(task.id, { status: 'em_andamento', assignee: agent }) : null;
      return sendJson(res, 200, { dispatch: row, task: updatedTask });
    }

    if (req.method === 'POST' && dispatchEvidence) {
      const body = await readBody(req);
      if (!String(body.evidence || '').trim()) return sendJson(res, 400, { error: 'evidence é obrigatório' });
      const row = await updateProposalDispatch(decodeURIComponent(dispatchEvidence[1]), {
        status: 'enviado_confirmado', sent: true, externalEvidence: String(body.evidence).slice(0, 2000), dispatchedAt: new Date().toISOString()
      });
      const tasks = await readTasks();
      const task = tasks.find((item) => item.source === 'moneyIA-ponte' && item.description.includes(`/api/proposal-dispatch/${row.id}/evidence`));
      const updatedTask = task ? await updateTask(task.id, { status: 'concluida' }) : null;
      return sendJson(res, 200, { dispatch: row, task: updatedTask });
    }

    if (req.method === 'POST' && path === '/api/tarefas') {
      const body = await readBody(req);
      if (!body.title) return sendJson(res, 400, { error: 'title é obrigatório' });
      const row = await createTask(body);
      return sendJson(res, 201, row);
    }

    const task = path.match(/^\/api\/tarefas\/([^/]+)$/);
    if (req.method === 'PATCH' && task) {
      const body = await readBody(req);
      const row = await updateTask(decodeURIComponent(task[1]), body);
      return sendJson(res, 200, row);
    }

    if (path.startsWith('/api/')) return sendJson(res, 404, { error: 'endpoint não encontrado' });
    return serveStatic(req, res, path);
  } catch (error) {
    return sendJson(res, 500, { error: error.message || 'erro interno' });
  }
});

server.listen(port, host, () => {
  console.log(`moneyIA app em http://${host}:${port}`);
  console.log(`Autenticação: ${authEnabled ? 'Basic Auth ativa' : 'somente loopback'}`);
  if (host === '0.0.0.0' && !authEnabled) {
    console.warn('ATENÇÃO: host 0.0.0.0 sem MONEYIA_APP_USER/PASSWORD. Requisições externas serão recusadas.');
  }
  console.log('Aprovações: leitura/escrita em data/aprovacoes.json');
  console.log('Tarefas: leitura/escrita em data/tarefas.json');
  verifyProposals().catch(e => console.warn('Conferência de propostas:', e.message));
});
setInterval(() => verifyProposals().catch(e => console.warn('Conferência de propostas:', e.message)), 30 * 60 * 1000).unref();
