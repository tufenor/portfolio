// Estado compartilhado do painel de aprovações e tarefas.
// Sem dependências externas. Gravação atômica para não corromper JSON.
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
export const dataDir = join(root, 'data');
export const approvalsFile = join(dataDir, 'aprovacoes.json');
export const tasksFile = join(dataDir, 'tarefas.json');
export const iaFile = join(dataDir, 'ia-inbox.json');
export const agentQuestionsFile = join(dataDir, 'agent-questions.json');
export const proposalDispatchFile = join(dataDir, 'proposal-dispatch.json');
export const notificationsFile = join(dataDir, 'notificacoes.jsonl');
export const emailInboxFile = join(dataDir, 'email-inbox.json');
export const radarRunsFile = join(dataDir, 'radar-runs.json');
export const radarGatesFile = join(dataDir, 'radar-gates.json');
export const radarOpportunitiesFile = join(dataDir, 'radar-opportunities.json');
export const radarSessionsFile = join(dataDir, 'radar-sessions.json');

const readJson = async (file, fallback = []) => {
  try { return JSON.parse(await readFile(file, 'utf8')); } catch { return fallback; }
};

const writeJson = async (file, value) => {
  await mkdir(dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  const content = JSON.stringify(value, null, 2) + '\n';
  await writeFile(tmp, content, 'utf8');
  try {
    await rename(tmp, file);
  } catch (error) {
    // OneDrive can briefly hold the destination reparse point. Keep the
    // operation usable locally while preserving the same JSON content.
    if (!['EPERM', 'EACCES', 'EBUSY'].includes(error.code)) throw error;
    await writeFile(file, content, 'utf8');
    try { await import('node:fs/promises').then(({ unlink }) => unlink(tmp)); } catch {}
  }
};

export const readApprovals = () => readJson(approvalsFile, []);
export const readTasks = () => readJson(tasksFile, []);
export const readIa = () => readJson(iaFile, []);
export const readAgentQuestions = () => readJson(agentQuestionsFile, []);
export const readProposalDispatch = () => readJson(proposalDispatchFile, []);
export const readEmailInbox = () => readJson(emailInboxFile, { scannedAt: null, total: 0, counts: {}, emails: [] });
export const readRadarRuns = () => readJson(radarRunsFile, []);
export const readRadarGates = () => readJson(radarGatesFile, []);
export const readRadarOpportunities = () => readJson(radarOpportunitiesFile, []);
export const readRadarSessions = () => readJson(radarSessionsFile, []);

export async function writeEmailInbox(value) {
  await writeJson(emailInboxFile, value);
  return value;
}

export async function writeRadarRuns(value) { await writeJson(radarRunsFile, value); return value; }
export async function writeRadarGates(value) { await writeJson(radarGatesFile, value); return value; }
export async function writeRadarOpportunities(value) { await writeJson(radarOpportunitiesFile, value); return value; }
export async function writeRadarSessions(value) { await writeJson(radarSessionsFile, value); return value; }

export function nextId(rows, prefix) {
  const max = rows.reduce((acc, row) => {
    const match = String(row.id || '').match(new RegExp(`^${prefix}-(\\d+)$`));
    return match ? Math.max(acc, Number(match[1])) : acc;
  }, 0);
  return `${prefix}-${String(max + 1).padStart(3, '0')}`;
}

export async function createApproval(input) {
  const rows = await readApprovals();
  const now = new Date().toISOString();
  const row = {
    id: nextId(rows, 'APR'),
    source: String(input.source || 'desconhecido').slice(0, 40),
    title: String(input.title || 'Sem título').slice(0, 160),
    description: String(input.description || '').slice(0, 2000),
    actionType: String(input.actionType || 'acao').slice(0, 40),
    target: String(input.target || '').slice(0, 300),
    cost: String(input.cost || 'R$ 0').slice(0, 80),
    files: Array.isArray(input.files) ? input.files.slice(0, 20).map(String) : [],
    opportunityId: input.opportunityId ? String(input.opportunityId).slice(0, 100) : null,
    opportunityUrl: input.opportunityUrl ? String(input.opportunityUrl).slice(0, 500) : null,
    proposalText: input.proposalText ? String(input.proposalText).slice(0, 12000) : null,
    demoUrl: input.demoUrl ? String(input.demoUrl).slice(0, 500) : null,
    amount: input.amount ? String(input.amount).slice(0, 80) : null,
    status: 'pendente',
    createdAt: now,
    updatedAt: now,
    decidedAt: null,
    decidedBy: null,
    note: ''
  };
  rows.push(row);
  await writeJson(approvalsFile, rows);
  return row;
}

export async function updateApproval(id, patch = {}) {
  const rows = await readApprovals();
  const row = rows.find((item) => item.id === id);
  if (!row) throw new Error('aprovação não encontrada');
  for (const field of ['description', 'proposalText', 'demoUrl', 'amount', 'note']) {
    if (patch[field] !== undefined && patch[field] !== null) row[field] = String(patch[field]).slice(0, field === 'proposalText' ? 12000 : field === 'description' ? 2000 : 2000);
  }
  if (Array.isArray(patch.files)) row.files = patch.files.slice(0, 20).map(String);
  await writeJson(approvalsFile, rows);
  return row;
}

export async function createProposalDispatch(input) {
  const rows = await readProposalDispatch();
  const now = new Date().toISOString();
  const row = {
    id: nextId(rows, 'PD'),
    opportunityId: String(input.opportunityId || '').slice(0, 100),
    approvalId: String(input.approvalId || '').slice(0, 40),
    provider: String(input.provider || 'deepseek').slice(0, 60),
    agent: input.agent ? String(input.agent).slice(0, 60) : null,
    status: String(input.status || 'aguardando_agente').slice(0, 60),
    sent: false,
    createdAt: now,
    dispatchedAt: null,
    externalEvidence: null,
    note: String(input.note || 'Aprovação local registrada; aguardando o agente responsável.').slice(0, 1000)
  };
  rows.push(row);
  await writeJson(proposalDispatchFile, rows);
  return row;
}

export async function updateProposalDispatch(id, patch = {}) {
  const rows = await readProposalDispatch();
  const row = rows.find((item) => item.id === id);
  if (!row) throw new Error('dispatch de proposta não encontrado');
  if (patch.status) row.status = String(patch.status).slice(0, 60);
  if (patch.provider) row.provider = String(patch.provider).slice(0, 60);
  if (patch.agent) row.agent = String(patch.agent).slice(0, 60);
  if (typeof patch.sent === 'boolean') row.sent = patch.sent;
  if (patch.externalEvidence) row.externalEvidence = String(patch.externalEvidence).slice(0, 2000);
  if (patch.dispatchedAt) row.dispatchedAt = String(patch.dispatchedAt).slice(0, 60);
  if (patch.note) row.note = String(patch.note).slice(0, 1000);
  row.updatedAt = new Date().toISOString();
  await writeJson(proposalDispatchFile, rows);
  return row;
}

export async function decideApproval(id, decision, by = 'titular', note = '') {
  if (!['aprovar', 'rejeitar'].includes(decision)) throw new Error('decisão inválida');
  const rows = await readApprovals();
  const row = rows.find((r) => r.id === id);
  if (!row) throw new Error('aprovação não encontrada');
  if (row.status !== 'pendente') throw new Error(`aprovação já está ${row.status}`);
  row.status = decision === 'aprovar' ? 'aprovada' : 'rejeitada';
  row.decidedAt = new Date().toISOString();
  row.decidedBy = String(by).slice(0, 60);
  row.note = String(note || '').slice(0, 1000);
  await writeJson(approvalsFile, rows);
  return row;
}

let taskWrites = Promise.resolve();

function writeTaskInOrder(change) {
  const next = taskWrites.then(change);
  taskWrites = next.catch(() => {});
  return next;
}

export function createTask(input) {
  return writeTaskInOrder(() => insertTask(input));
}

async function insertTask(input) {
  const rows = await readTasks();
  const operationKey = input.operationKey ? String(input.operationKey).slice(0, 100) : null;
  if (operationKey) {
    const existing = rows.find((row) => row.operationKey === operationKey);
    if (existing) return existing;
  }
  const now = new Date().toISOString();
  const row = {
    id: nextId(rows, 'T'),
    ...(operationKey ? { operationKey } : {}),
    title: String(input.title || 'Sem título').slice(0, 160),
    description: String(input.description || '').slice(0, 2000),
    source: String(input.source || 'manual').slice(0, 40),
    assignee: String(input.assignee || 'codex').slice(0, 40),
    priority: ['alta', 'media', 'baixa'].includes(input.priority) ? input.priority : 'media',
    status: 'pendente',
    createdAt: now,
    updatedAt: now,
    due: input.due ? String(input.due).slice(0, 40) : null
  };
  rows.push(row);
  await writeJson(tasksFile, rows);
  return row;
}

export function updateTask(id, patch = {}) {
  return writeTaskInOrder(() => applyTaskPatch(id, patch));
}

async function applyTaskPatch(id, patch = {}) {
  const rows = await readTasks();
  const row = rows.find((r) => r.id === id);
  if (!row) throw new Error('tarefa não encontrada');
  if (patch.status) {
    if (!['pendente', 'em_andamento', 'concluida', 'cancelada'].includes(patch.status)) throw new Error('status inválido');
    row.status = patch.status;
  }
  if (patch.priority) {
    if (!['alta', 'media', 'baixa'].includes(patch.priority)) throw new Error('prioridade inválida');
    row.priority = patch.priority;
  }
  if (patch.assignee) row.assignee = String(patch.assignee).slice(0, 40);
  if (patch.title) row.title = String(patch.title).slice(0, 160);
  if (patch.description) row.description = String(patch.description).slice(0, 2000);
  row.updatedAt = new Date().toISOString();
  await writeJson(tasksFile, rows);
  return row;
}

export async function createIaItem(input) {
  const rows = await readIa();
  const now = new Date().toISOString();
  const row = {
    id: nextId(rows, 'IA'),
    opportunityId: String(input.opportunityId || '').slice(0, 80),
    title: String(input.title || '').slice(0, 200),
    platform: String(input.platform || '').slice(0, 80),
    url: String(input.url || '').slice(0, 500),
    priority: String(input.priority || '').slice(0, 20),
    budget: String(input.budget || '').slice(0, 300),
    prompt: String(input.prompt || '').slice(0, 6000),
    status: input.status || 'aguardando_ponte',
    providerId: String(input.providerId || 'chatgpt').slice(0, 40),
    providerLabel: String(input.providerLabel || '').slice(0, 80),
    webhookStatus: input.webhookStatus || null,
    retorno: null,
    createdAt: now,
    dispatchedAt: null,
    respondedAt: null,
    responseSource: null
  };
  rows.push(row);
  await writeJson(iaFile, rows);
  return row;
}

export async function setIaResponse(id, response, source = 'retorno_registrado') {
  const rows = await readIa();
  const row = rows.find((r) => r.id === id);
  if (!row) throw new Error('item da IA não encontrado');
  row.retorno = String(response || '').slice(0, 10000);
  row.status = 'respondida';
  row.respondedAt = new Date().toISOString();
  row.responseSource = String(source).slice(0, 80);
  await writeJson(iaFile, rows);
  return row;
}

export async function setIaDelivery(id, status, webhookStatus = null, providerId = null, providerLabel = null) {
  const rows = await readIa();
  const row = rows.find((r) => r.id === id);
  if (!row) throw new Error('item da IA não encontrado');
  row.status = status;
  row.webhookStatus = webhookStatus;
  if (providerId) row.providerId = String(providerId).slice(0, 40);
  if (providerLabel) row.providerLabel = String(providerLabel).slice(0, 80);
  if (status === 'despachada') row.dispatchedAt = new Date().toISOString();
  await writeJson(iaFile, rows);
  return row;
}

const questionTypes = new Set(['text', 'multiline', 'number', 'amount', 'code', 'secret', 'choice', 'json', 'url']);

/**
 * Pergunta feita por um agente. A pergunta é explícita para que o titular
 * saiba exatamente qual dado está sendo solicitado no celular.
 */
export async function createAgentQuestion(input) {
  const rows = await readAgentQuestions();
  const now = new Date().toISOString();
  const type = questionTypes.has(String(input.type)) ? String(input.type) : 'text';
  const options = Array.isArray(input.options)
    ? input.options.map((x) => String(x).slice(0, 120)).slice(0, 30)
    : [];
  const row = {
    id: nextId(rows, 'Q'),
    agent: String(input.agent || input.assignee || 'agente').slice(0, 60),
    title: String(input.title || 'Informação necessária').slice(0, 180),
    prompt: String(input.prompt || input.question || '').slice(0, 1200),
    type,
    field: String(input.field || '').slice(0, 80),
    options,
    required: input.required !== false,
    sensitive: Boolean(input.sensitive || type === 'secret'),
    status: 'pendente',
    createdAt: now,
    answeredAt: null,
    answeredBy: null,
    answer: null,
    answerPreview: null,
    delivery: 'pendente'
  };
  rows.push(row);
  await writeJson(agentQuestionsFile, rows);
  return row;
}

/**
 * Salva a resposta do titular. Segredos nunca são gravados em JSON: eles só
 * podem ser encaminhados por webhook configurado pelo operador e ficam
 * marcados como recebidos sem conteúdo recuperável.
 */
export async function answerAgentQuestion(id, answer, by = 'titular', delivery = 'local') {
  const rows = await readAgentQuestions();
  const row = rows.find((r) => r.id === id);
  if (!row) throw new Error('pergunta do agente não encontrada');
  if (row.status !== 'pendente') throw new Error(`pergunta já está ${row.status}`);
  const value = typeof answer === 'string' ? answer : JSON.stringify(answer);
  if (!String(value || '').trim()) throw new Error('resposta vazia');
  row.status = row.sensitive ? 'respondida_sem_armazenar' : 'respondida';
  row.answeredAt = new Date().toISOString();
  row.answeredBy = String(by || 'titular').slice(0, 60);
  row.delivery = String(delivery || 'local').slice(0, 40);
  if (row.sensitive) {
    row.answer = null;
    row.answerPreview = '[conteúdo sensível recebido; não armazenado]';
  } else {
    row.answer = String(value).slice(0, 12000);
    row.answerPreview = row.answer.length > 180 ? `${row.answer.slice(0, 180)}…` : row.answer;
  }
  await writeJson(agentQuestionsFile, rows);
  return { ...row, answer: row.sensitive ? null : row.answer };
}

export function summarize(approvals, tasks) {
  const pending = approvals.filter((a) => a.status === 'pendente');
  return {
    aprovacoesPendentes: pending.length,
    aprovacoesAprovadas: approvals.filter((a) => a.status === 'aprovada').length,
    aprovacoesRejeitadas: approvals.filter((a) => a.status === 'rejeitada').length,
    tarefasPendentes: tasks.filter((t) => t.status === 'pendente').length,
    tarefasEmAndamento: tasks.filter((t) => t.status === 'em_andamento').length,
    tarefasConcluidas: tasks.filter((t) => t.status === 'concluida').length
  };
}
