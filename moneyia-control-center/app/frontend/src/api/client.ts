import type { MesaState } from '../types/moneyia';

export async function requestJson<T = Record<string, unknown>>(
  path: string,
  method: 'GET' | 'POST' | 'PATCH' = 'GET',
  body?: unknown
): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: { 'content-type': 'application/json' },
    cache: 'no-store',
    ...(body !== undefined ? { body: JSON.stringify(body) } : {})
  });
  const rawText = await res.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    parsed = { raw: rawText };
  }
  if (!res.ok) {
    const message = typeof parsed === 'object' && parsed !== null
      ? String((parsed as Record<string, unknown>).error || `HTTP ${res.status}`)
      : `HTTP ${res.status}`;
    throw new Error(message);
  }
  return parsed as T;
}

export const fetchMesaState = () => requestJson<MesaState>('/api/state', 'GET');
export const runQueueBatch = (limit: number, tier: 'fast' | 'heavy') =>
  requestJson('/api/oportunidades/processar-fila', 'POST', { limit, tier });
export const sendOpportunityToAi = (id: string) =>
  requestJson(`/api/oportunidades/${encodeURIComponent(id)}/enviar-ia`, 'POST', {});
export const saveIaReturn = (id: string, retorno: string) =>
  requestJson(`/api/ia/${encodeURIComponent(id)}/retorno`, 'POST', { retorno });
export const decideSingleApproval = (id: string, decision: 'aprovar' | 'rejeitar', note = '') =>
  requestJson(`/api/aprovacoes/${encodeURIComponent(id)}/decision`, 'POST', {
    decision,
    by: 'mesa-react-ts',
    note
  });
export async function decideBatchApprovals(ids: string[], decision: 'aprovar' | 'rejeitar', note = '') {
  const results = [];
  for (const id of ids) results.push(await decideSingleApproval(id, decision, note));
  return { processed: results.length, results };
}
export const startRadar = () => requestJson('/api/radar/runs', 'POST', { mode: 'shadow', shards: 6 });
export const prepareRadarQueue = () => requestJson('/api/radar/send-queue', 'POST', { limit: 30 });
export const createNewTask = (title: string, priority: string) =>
  requestJson('/api/tarefas', 'POST', { title, priority, source: 'mesa-react-ts' });
export const toggleTaskStatus = (id: string, status: string) =>
  requestJson(`/api/tarefas/${encodeURIComponent(id)}`, 'PATCH', { status });
export const answerQuestion = (id: string, answer: string) =>
  requestJson(`/api/agent-questions/${encodeURIComponent(id)}/answer`, 'POST', {
    answer,
    by: 'titular'
  });
export const runMcpAction = (action: string) =>
  requestJson('/api/mcp/exec', 'POST', { action });
export const runEngineAction = (engine: string, payload: Record<string, unknown> = {}) =>
  requestJson('/api/engines/run', 'POST', { engine, ...payload });
export const syncAuthority = () => requestJson('/api/autoridade/sync', 'POST', {});
export const runSelfImprove = () => requestJson('/api/self-improve', 'POST', {});
