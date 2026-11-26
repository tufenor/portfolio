const SUBAI_KEY = 'moneyia_v2_subais_v1';
const CORE_AIS = [
  { id: 'gemini-flash', name: 'Gemini 2.5 Flash', tier: 'fast', audience: 'Global · BRL · USD', role: 'Triagem rápida, síntese e análise de oportunidades' },
  { id: 'gemini-pro', name: 'Gemini 2.5 Pro', tier: 'heavy', audience: 'Escopo & Oferta', role: 'Análise aprofundada, arquitetura e estrutura de entrega' },
  { id: 'qwen-fast', name: 'Ollama qwen3.5:4b', tier: 'fast', audience: 'Fila Local', role: 'Execução local ágil sem custo de API' },
  { id: 'qwen-heavy', name: 'Ollama qwen3.8:27b', tier: 'heavy', audience: 'Raciocínio Local', role: 'Análise densa local e preparação de propostas' },
  { id: 'mcp-jarvis', name: 'Agentes & MCP / JARVIS', tier: 'fast', audience: 'Rotinas & Alertas', role: 'Panorama, healthcheck, cadência e ponte mobile' }
];

let currentState = null;
let syncHandle = null;

function esc(v) {
  return String(v ?? '')
    .replaceAll('&', '&')
    .replaceAll('<', '<')
    .replaceAll('>', '>')
    .replaceAll('"', '"');
}

function fmtMoney(num, prefix) {
  const n = Number(num || 0);
  return `${prefix} ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function getSubAis() {
  try {
    const raw = localStorage.getItem(SUBAI_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function setSubAis(items) {
  try { localStorage.setItem(SUBAI_KEY, JSON.stringify(items)); } catch {}
}

function setOutput(label, payload) {
  const meta = document.getElementById('log-meta');
  const box = document.getElementById('output-box');
  if (meta) meta.textContent = `${label} · ${new Date().toLocaleTimeString('pt-BR')}`;
  if (box) box.textContent = typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2);
}

async function api(path, method = 'GET', body = null) {
  const res = await fetch(path, {
    method,
    headers: { 'content-type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  const text = await res.text();
  try { return JSON.parse(text); } catch { return { raw: text }; }
}

const TITLES = {
  'view-results': 'Resultados <span class="accent">consolidados.</span>',
  'view-agents': 'Relatório <span class="accent">por IA.</span>',
  'view-subagents': 'Sub-IAs & <span class="accent">alcance.</span>',
  'view-hunt': 'Caça & <span class="accent">fila IA.</span>',
  'view-approvals': 'Aprovações <span class="accent">pendentes.</span>',
  'view-tasks': 'Tarefas & <span class="accent">perguntas.</span>',
  'view-mcp': 'MCP & <span class="accent">JARVIS.</span>'
};

function openView(id) {
  document.querySelectorAll('.rail-link').forEach((b) => b.classList.toggle('active', b.dataset.view === id));
  document.querySelectorAll('.view').forEach((v) => v.classList.toggle('active', v.id === id));
  const h1 = document.getElementById('page-title');
  if (h1 && TITLES[id]) h1.innerHTML = TITLES[id];
}

function renderSummaryStrip(st) {
  const opps = st.opportunities || {};
  const rec = st.finance?.confirmedReceived || {};
  const pending = (st.approvals || []).filter((a) => a.status === 'pendente');
  const openTasks = (st.tasks || []).filter((t) => t.status !== 'concluida');
  const iaList = st.ia || [];
  const subAis = getSubAis();
  const readyCount = iaList.filter((i) => i.response || i.status === 'respondida').length + (opps.recent || []).length;

  document.getElementById('val-brl').textContent = fmtMoney(rec.BRL, 'R$');
  document.getElementById('sub-brl').textContent = `Oportunidades BRL: ${opps.brl ?? 0}`;
  document.getElementById('val-usd').textContent = fmtMoney(rec.USD, 'US$');
  document.getElementById('sub-usd').textContent = `Oportunidades USD: ${opps.usd ?? 0}`;
  document.getElementById('val-global').textContent = opps.global ?? 0;
  document.getElementById('sub-global').textContent = `BOB recebido: ${fmtMoney(rec.BOB, 'Bs')}`;
  document.getElementById('val-pending').textContent = `${pending.length} / ${iaList.length}`;
  document.getElementById('sub-pending').textContent = 'Aprovações / Fila IA';

  document.getElementById('badge-results').textContent = readyCount;
  document.getElementById('badge-agents').textContent = CORE_AIS.length + subAis.length;
  document.getElementById('badge-subagents').textContent = subAis.length;
  document.getElementById('badge-opps').textContent = opps.total ?? 0;
  document.getElementById('badge-approvals').textContent = pending.length;
  document.getElementById('badge-tasks').textContent = openTasks.length;
}

function renderResults(st) {
  const el = document.getElementById('results-list');
  if (!el) return;
  const q = (document.getElementById('filter-results')?.value || '').trim().toLowerCase();

  const iaDone = (st.ia || [])
    .slice()
    .reverse()
    .map((i) => ({
      tag: i.response ? 'Resultado Pronto' : 'Na Fila IA',
      title: i.title || i.opportunityId || i.id,
      meta: `${i.platform || 'Canal'} · ${i.budget || 'Orçamento N/D'} · ${i.status || 'pendente'}`,
      text: i.response || i.prompt || '',
      url: i.url || '',
      oppId: i.opportunityId || ''
    }));

  const topOpps = (st.opportunities?.recent || []).map((o) => ({
    tag: 'Oportunidade',
    title: o.title || o.id,
    meta: `${o.platform || ''} · ${o.budget || 'Orçamento N/D'} · ${o.status || ''}`,
    text: `Prioridade: ${o.priority || 'N/D'}`,
    url: o.url || '',
    oppId: o.id
  }));

  const items = [...iaDone, ...topOpps].filter((it) => {
    if (!q) return true;
    return `${it.tag} ${it.title} ${it.meta} ${it.text}`.toLowerCase().includes(q);
  });

  if (!items.length) {
    el.innerHTML = '<div class="paper-card"><p class="muted">Nenhum resultado encontrado.</p></div>';
    return;
  }

  el.innerHTML = items.slice(0, 15).map((it) => `
    <article class="paper-card">
      <div class="entry-head">
        <div>
          <span class="muted">${esc(it.tag)}</span>
          <h3>${esc(it.title)}</h3>
          <div class="muted">${esc(it.meta)}</div>
        </div>
      </div>
      ${it.text ? `<pre class="mini-pre">${esc(String(it.text).slice(0, 600))}</pre>` : ''}
      <div class="row-actions">
        ${it.url ? `<a href="${esc(it.url)}" target="_blank" rel="noopener noreferrer" class="btn btn-light btn-xs">Abrir link</a>` : ''}
        ${it.oppId ? `<button type="button" class="btn btn-dark btn-xs" data-send-ia="${esc(it.oppId)}">Analisar com IA</button>` : ''}
      </div>
    </article>
  `).join('');
}

function renderAgentsReport(st) {
  const el = document.getElementById('agents-report');
  if (!el) return;
  const iaList = st.ia || [];
  const subs = getSubAis().map((s, idx) => ({
    id: `sub-${idx}`,
    name: `Sub-IA: ${s.name}`,
    tier: s.tier || 'fast',
    audience: `${s.audience} (${s.channel})`,
    role: s.goal || 'Sub-IA de expansão de alcance e triagem de receita'
  }));

  el.innerHTML = [...CORE_AIS, ...subs].map((ai) => {
    const last = iaList.length ? iaList[iaList.length - 1] : null;
    return `
      <article class="paper-card">
        <div class="entry-head">
          <div>
            <h3>${esc(ai.name)}</h3>
            <div class="muted">Público: ${esc(ai.audience)} · Tier: ${esc(ai.tier)}</div>
          </div>
          <span class="muted">Ativa</span>
        </div>
        <p class="muted">${esc(ai.role)}</p>
        ${last?.response ? `<pre class="mini-pre">${esc(String(last.response).slice(0, 360))}</pre>` : '<div class="muted">Aguardando execução.</div>'}
        <div class="row-actions">
          <button type="button" class="btn btn-dark btn-xs" data-run-tier="${esc(ai.tier)}">Rodar lote (${esc(ai.tier)})</button>
        </div>
      </article>
    `;
  }).join('');
}

function renderSubAis() {
  const el = document.getElementById('subai-list');
  if (!el) return;
  const subs = getSubAis();
  if (!subs.length) {
    el.innerHTML = '<div class="paper-card"><p class="muted">Nenhuma sub-IA registrada. Crie uma acima para focar em um público ou canal.</p></div>';
    return;
  }
  el.innerHTML = subs.map((s, idx) => `
    <article class="paper-card">
      <div class="entry-head">
        <div>
          <h3>${esc(s.name)}</h3>
          <div class="muted">Público: ${esc(s.audience)} · Canal: ${esc(s.channel)} · Tier: ${esc(s.tier)}</div>
        </div>
        <button type="button" class="btn btn-warn btn-xs" data-del-subai="${idx}">Remover</button>
      </div>
      ${s.goal ? `<p class="muted">${esc(s.goal)}</p>` : ''}
      <div class="row-actions">
        <button type="button" class="btn btn-dark btn-xs" data-run-tier="${esc(s.tier || 'fast')}">Disparar (${esc(s.tier || 'fast')})</button>
      </div>
    </article>
  `).join('');
}

function renderHuntAndQueue(st) {
  const oppEl = document.getElementById('opps-list');
  const iaEl = document.getElementById('ia-list');
  const q = (document.getElementById('filter-opps')?.value || '').trim().toLowerCase();

  const opps = (st.opportunities?.recent || []).filter((o) => {
    if (!q) return true;
    return `${o.title || ''} ${o.platform || ''} ${o.budget || ''} ${o.status || ''}`.toLowerCase().includes(q);
  });

  if (oppEl) {
    oppEl.innerHTML = opps.length
      ? opps.map((o) => `
        <div class="entry">
          <div class="entry-head">
            <div>
              <strong>${esc(o.title || o.id)}</strong>
              <div class="muted">${esc(o.platform || '')} · ${esc(o.budget || 'Orçamento N/D')} · ${esc(o.status || '')}</div>
              ${o.url ? `<div class="muted"><a href="${esc(o.url)}" target="_blank" rel="noopener noreferrer">${esc(o.url)}</a></div>` : ''}
            </div>
            <button type="button" class="btn btn-dark btn-xs" data-send-ia="${esc(o.id)}">Enviar p/ IA</button>
          </div>
        </div>
      `).join('')
      : '<p class="muted">Nenhuma oportunidade encontrada.</p>';
  }

  const iaItems = (st.ia || []).slice().reverse().slice(0, 12);
  if (iaEl) {
    iaEl.innerHTML = iaItems.length
      ? iaItems.map((it) => `
        <div class="entry">
          <strong>${esc(it.title || it.opportunityId || it.id)}</strong>
          <div class="muted">Status: ${esc(it.status || 'pendente')} · ${esc(it.platform || '')}</div>
          ${it.response ? `<pre class="mini-pre">${esc(String(it.response).slice(0, 500))}</pre>` : ''}
          <div class="inline-row">
            <input type="text" class="ctrl grow" data-ia-input="${esc(it.id)}" placeholder="Colar retorno manual..." />
            <button type="button" class="btn btn-light btn-xs" data-ia-return="${esc(it.id)}">Salvar</button>
          </div>
        </div>
      `).join('')
      : '<p class="muted">Fila vazia.</p>';
  }
}

function renderApprovals(st) {
  const pending = (st.approvals || []).filter((a) => a.status === 'pendente');
  const box = document.getElementById('approvals-box');
  if (box) box.textContent = pending.length ? JSON.stringify(pending.slice(0, 15), null, 2) : 'Nenhuma aprovação pendente.';

  const el = document.getElementById('approvals-list');
  if (!el) return;
  if (!pending.length) {
    el.innerHTML = '<p class="muted">Nenhuma aprovação pendente.</p>';
    return;
  }
  el.innerHTML = pending.slice(0, 20).map((a) => `
    <div class="entry">
      <div class="entry-head">
        <div>
          <strong>${esc(a.title || a.id)}</strong>
          <div class="muted">${esc(a.source || 'sistema')} · ${esc(a.createdAt || '')}</div>
        </div>
        <div class="row-actions">
          <button type="button" class="btn btn-ok btn-xs" data-decide-id="${esc(a.id)}" data-decision="aprovar">Aprovar</button>
          <button type="button" class="btn btn-warn btn-xs" data-decide-id="${esc(a.id)}" data-decision="rejeitar">Rejeitar</button>
        </div>
      </div>
      ${a.description ? `<pre class="mini-pre">${esc(String(a.description).slice(0, 400))}</pre>` : ''}
    </div>
  `).join('');
}

function renderTasksAndQuestions(st) {
  const tEl = document.getElementById('tasks-list');
  const filter = document.getElementById('task-filter')?.value || 'todas';
  if (tEl) {
    const tasks = (st.tasks || []).filter((t) => {
      if (filter === 'aberta') return t.status !== 'concluida';
      if (filter === 'concluida') return t.status === 'concluida';
      return true;
    });
    tEl.innerHTML = tasks.length
      ? tasks.slice(0, 15).map((t) => `
        <div class="entry">
          <div class="entry-head">
            <div>
              <strong>[${esc(t.priority || 'media')}] ${esc(t.title || t.id)}</strong>
              <div class="muted">Status: ${esc(t.status || 'aberta')} · ${esc(t.source || '')}</div>
            </div>
            <button type="button" class="btn btn-light btn-xs" data-task-toggle="${esc(t.id)}" data-next-status="${t.status === 'concluida' ? 'aberta' : 'concluida'}">
              ${t.status === 'concluida' ? 'Reabrir' : 'Concluir'}
            </button>
          </div>
        </div>
      `).join('')
      : '<p class="muted">Nenhuma tarefa.</p>';
  }

  const qEl = document.getElementById('questions-list');
  if (qEl) {
    const qs = (st.agentQuestions || []).filter((q) => q.status === 'pendente');
    qEl.innerHTML = qs.length
      ? qs.map((q) => `
        <div class="entry">
          <strong>${esc(q.title || q.prompt || q.id)}</strong>
          <div class="inline-row">
            <input type="text" class="ctrl grow" data-q-input="${esc(q.id)}" placeholder="Responder ao agente..." />
            <button type="button" class="btn btn-dark btn-xs" data-q-answer="${esc(q.id)}">Responder</button>
          </div>
        </div>
      `).join('')
      : '<p class="muted">Nenhuma pergunta pendente.</p>';
  }
}

function renderAll(st) {
  currentState = st;
  const pending = (st.approvals || []).filter((a) => a.status === 'pendente');
  document.getElementById('conn-status').textContent = 'Online · 127.0.0.1:8899';
  document.getElementById('status-bar').textContent =
    `Oportunidades: ${st.opportunities?.total ?? 0} | Aprovações pendentes: ${pending.length} | Tarefas: ${(st.tasks || []).length} | Fila IA: ${(st.ia || []).length}`;
  renderSummaryStrip(st);
  renderResults(st);
  renderAgentsReport(st);
  renderSubAis();
  renderHuntAndQueue(st);
  renderApprovals(st);
  renderTasksAndQuestions(st);
}

async function loadState() {
  const tag = document.activeElement?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;
  const st = await api('/api/state');
  if (st && !st.error) {
    renderAll(st);
  } else {
    document.getElementById('conn-status').textContent = 'Falha em /api/state';
  }
}

async function runQueue(limit = 5, tierOverride = null) {
  const tier = tierOverride || document.getElementById('run-tier')?.value || 'fast';
  setOutput(`Agentes (${limit} · ${tier})`, 'Processando fila...');
  const r = await api('/api/oportunidades/processar-fila', 'POST', { limit: Number(limit) || 5, tier });
  setOutput('Resultado da fila', r);
  await loadState();
}

function setupAutoSync() {
  if (syncHandle) clearInterval(syncHandle);
  const ms = Number(document.getElementById('auto-sync')?.value || 0);
  if (ms > 0) syncHandle = setInterval(loadState, ms);
}

document.querySelectorAll('.rail-link[data-view]').forEach((b) => {
  b.addEventListener('click', () => openView(b.dataset.view));
});

document.getElementById('btn-refresh')?.addEventListener('click', loadState);
document.getElementById('btn-fila')?.addEventListener('click', () => runQueue(5));
document.getElementById('btn-diag-1')?.addEventListener('click', () => runQueue(1));
document.getElementById('btn-run-batch')?.addEventListener('click', () => {
  runQueue(Number(document.getElementById('batch-limit')?.value || 5));
});

document.getElementById('btn-autoridade')?.addEventListener('click', async () => {
  setOutput('Sync Autoridade', 'Sincronizando...');
  const r = await api('/api/autoridade/sync', 'POST', {});
  setOutput('Sync Autoridade', r);
});

document.getElementById('btn-improve')?.addEventListener('click', async () => {
  setOutput('Auto-Melhoria', 'Gerando melhorias...');
  const r = await api('/api/self-improve', 'POST', {});
  setOutput('Auto-Melhoria', r);
  await loadState();
});

document.getElementById('auto-sync')?.addEventListener('change', setupAutoSync);
document.getElementById('filter-results')?.addEventListener('input', () => currentState && renderResults(currentState));
document.getElementById('filter-opps')?.addEventListener('input', () => currentState && renderHuntAndQueue(currentState));
document.getElementById('task-filter')?.addEventListener('change', () => currentState && renderTasksAndQuestions(currentState));

document.getElementById('subai-form')?.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = document.getElementById('subai-name').value.trim();
  const audience = document.getElementById('subai-audience').value.trim();
  const channel = document.getElementById('subai-channel').value.trim();
  const tier = document.getElementById('subai-tier').value;
  const goal = document.getElementById('subai-goal').value.trim();
  if (!name || !audience || !channel) return;
  const list = getSubAis();
  list.unshift({ name, audience, channel, tier, goal });
  setSubAis(list);
  e.target.reset();
  if (currentState) renderAll(currentState);
  setOutput('Sub-IA criada', { name, audience, channel, tier });
});

document.getElementById('task-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const inp = document.getElementById('task-title');
  const title = inp.value.trim();
  if (!title) return;
  const r = await api('/api/tarefas', 'POST', {
    title,
    priority: document.getElementById('task-priority').value,
    source: 'mesa-v2'
  });
  setOutput('Nova tarefa', r);
  inp.value = '';
  await loadState();
});

async function decideAll(decision) {
  const ids = (currentState?.approvals || []).filter((a) => a.status === 'pendente').map((a) => a.id);
  const note = (document.getElementById('batch-note')?.value || '').trim();
  if (!ids.length) {
    setOutput('Lote', 'Nenhuma aprovação pendente.');
    return;
  }
  const r = await api('/api/aprovacoes/batch', 'POST', { ids, decision, by: 'mesa-v2', note });
  setOutput(`Lote (${decision})`, r);
  await loadState();
}

document.getElementById('btn-aprovar-tudo')?.addEventListener('click', () => decideAll('aprovar'));
document.getElementById('btn-rejeitar-tudo')?.addEventListener('click', () => decideAll('rejeitar'));

document.addEventListener('click', async (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;

  if (btn.dataset.runTier) return runQueue(3, btn.dataset.runTier);

  if (btn.dataset.delSubai !== undefined) {
    const list = getSubAis();
    list.splice(Number(btn.dataset.delSubai), 1);
    setSubAis(list);
    if (currentState) renderAll(currentState);
    return;
  }

  if (btn.dataset.decideId) {
    const r = await api(`/api/aprovacoes/${encodeURIComponent(btn.dataset.decideId)}/decision`, 'POST', {
      decision: btn.dataset.decision,
      by: 'mesa-v2'
    });
    setOutput('Decisão', r);
    await loadState();
    return;
  }

  if (btn.dataset.sendIa) {
    setOutput('Enviar p/ IA', `Enviando ${btn.dataset.sendIa}...`);
    const r = await api(`/api/oportunidades/${encodeURIComponent(btn.dataset.sendIa)}/enviar-ia`, 'POST', {});
    setOutput('Enviar p/ IA', r);
    await loadState();
    return;
  }

  if (btn.dataset.iaReturn) {
    const id = btn.dataset.iaReturn;
    const retorno = (document.querySelector(`input[data-ia-input="${id}"]`)?.value || '').trim();
    if (!retorno) return;
    const r = await api(`/api/ia/${encodeURIComponent(id)}/retorno`, 'POST', { retorno });
    setOutput('Retorno IA', r);
    await loadState();
    return;
  }

  if (btn.dataset.taskToggle) {
    const r = await api(`/api/tarefas/${encodeURIComponent(btn.dataset.taskToggle)}`, 'PATCH', {
      status: btn.dataset.nextStatus
    });
    setOutput('Tarefa', r);
    await loadState();
    return;
  }

  if (btn.dataset.qAnswer) {
    const id = btn.dataset.qAnswer;
    const answer = (document.querySelector(`input[data-q-input="${id}"]`)?.value || '').trim();
    if (!answer) return;
    const r = await api(`/api/agent-questions/${encodeURIComponent(id)}/answer`, 'POST', { answer, by: 'titular' });
    setOutput('Resposta ao agente', r);
    await loadState();
  }
});

document.querySelectorAll('#mcp-buttons button[data-mcp]').forEach((btn) => {
  btn.addEventListener('click', async () => {
    const action = btn.getAttribute('data-mcp');
    setOutput(`MCP: ${action}`, 'Executando...');
    const r = await api('/api/mcp/exec', 'POST', { action });
    setOutput(`MCP: ${action}`, r.output || r);
  });
});

document.getElementById('btn-clear-out')?.addEventListener('click', () => setOutput('Limpo', ''));
document.getElementById('btn-copy-out')?.addEventListener('click', async () => {
  const txt = document.getElementById('output-box')?.textContent || '';
  if (navigator.clipboard && txt) await navigator.clipboard.writeText(txt).catch(() => {});
});

setupAutoSync();
loadState();