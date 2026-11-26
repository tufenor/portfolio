const $ = (sel) => document.querySelector(sel);
let state = null;
const BASE_PATH = location.pathname.startsWith('/moneyia') ? '/moneyia' : '';
const withBase = (path) => BASE_PATH && path.startsWith('/') ? `${BASE_PATH}${path}` : path;
let approvalFilter = 'pendente';
let pendingDecision = null;
let pendingIa = null;
const dispatchStatusLabel = {
  aguardando_evidencia: 'Aguardando evidência externa',
  despachada_ao_agente: 'Despachada ao agente',
  em_execucao: 'Em conferência',
  aguardando_agente: 'Aguardando agente',
  falha_agente: 'Falha no agente',
  enviado_confirmado: 'Enviado confirmado'
};
const OUTBOX_KEY = 'moneyia-outbox-v1';
const STATE_KEY = 'moneyia-state-v1';
const GATE_SEEN_KEY = 'moneyia-radar-gates-seen-v1';
const AUTO_FORWARD_KEY = 'moneyia-auto-forward-v1';
const AUTO_FORWARD_INTERVAL_MS = 5 * 60 * 1000;
let autoForwardTimer = null;
let autoForwardBusy = false;

class QueuedError extends Error {
  constructor(message) { super(message); this.name = 'QueuedError'; }
}

const readOutbox = () => {
  try { return JSON.parse(localStorage.getItem(OUTBOX_KEY) || '[]'); } catch { return []; }
};
const writeOutbox = (rows) => {
  localStorage.setItem(OUTBOX_KEY, JSON.stringify(rows));
  updateNetState();
};
const queueOperation = (path, method, body) => {
  const rows = readOutbox();
  rows.push({ id: crypto.randomUUID(), path, method, body, at: new Date().toISOString() });
  writeOutbox(rows);
};

function updateNetState() {
  const queued = readOutbox().length;
  const offline = !navigator.onLine;
  const label = $('#netLabel');
  const wrap = $('#netState');
  const banner = $('#offlineBanner');
  const sync = $('#syncBtn');
  if (!label || !wrap) return;
  wrap.classList.toggle('offline', offline);
  wrap.classList.toggle('pending', !offline && queued > 0);
  label.textContent = offline ? 'offline' : (queued ? `${queued} na fila` : 'local');
  if (banner) banner.hidden = !offline;
  if (sync) sync.hidden = queued === 0;
}

function renderBridgeState() {
  const bridge = state?.bridge;
  const el = $('#bridgeState');
  if (!el) return;
  const pending = Number(bridge?.queue?.pending || 0);
  const proposalPending = Number(bridge?.proposalQueue?.pending || 0);
  const jarvis = (state?.aiProviders || []).find((provider) => provider.id === 'jarvis');
  const jarvisReady = Boolean(jarvis?.endpointConfigured && jarvis?.cotaDisponivel);
  el.classList.toggle('degraded', !bridge || bridge.status !== 'operacional');
  el.title = bridge?.continuity || 'Ponte local disponível';
  const jarvisLabel = jarvisReady ? 'JARVIS disponível' : 'JARVIS aguardando conexão';
  el.querySelector('span').textContent = pending || proposalPending
    ? `Ponte local · ${jarvisLabel} · IA ${pending} · propostas ${proposalPending}`
    : `Ponte local ativa · ${jarvisLabel}`;
}

async function api(path, options = {}) {
  const isWrite = options.method && options.method !== 'GET';
  try {
    const res = await fetch(withBase(path), {
      headers: { 'content-type': 'application/json' },
      ...options
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `erro ${res.status}`);
    return data;
  } catch (error) {
    if (isWrite && error instanceof TypeError) {
      queueOperation(path, options.method, JSON.parse(options.body || '{}'));
      throw new QueuedError('Sem conexão. A operação ficou na fila local.');
    }
    throw error;
  }
}

async function flushOutbox() {
  const rows = readOutbox();
  if (!rows.length) return { sent: 0, failed: 0 };
  const left = [];
  let sent = 0;
  let failed = 0;
  for (const op of rows) {
    try {
      const res = await fetch(withBase(op.path), {
        method: op.method,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(op.body || {})
      });
      if (res.ok) { sent++; continue; }
      const data = await res.json().catch(() => ({}));
      if (res.status >= 400 && res.status < 500) { failed++; continue; }
      left.push(op);
    } catch {
      left.push(op);
    }
  }
  localStorage.setItem(OUTBOX_KEY, JSON.stringify(left));
  updateNetState();
  return { sent, failed };
}
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (iso) => {
  if (!iso) return '—';
  try { return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Manaus' }).format(new Date(iso)); }
  catch { return iso; }
};
const statusLabel = {
  pendente: 'pendente', aprovada: 'aprovada', rejeitada: 'rejeitada',
  em_andamento: 'em andamento', concluida: 'concluída', cancelada: 'cancelada'
};
const actionLabel = { envio: 'envio', gasto: 'gasto', publicacao: 'publicação', decisao: 'decisão', escrita: 'escrita', exclusao: 'exclusão', instalacao: 'instalação' };
const priorityLabel = { alta: 'alta', media: 'média', baixa: 'baixa' };

function toast(message) {
  const el = $('#toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => el.classList.remove('show'), 3200);
}

async function load() {
  if (navigator.onLine && readOutbox().length) await flushOutbox();
  try {
    state = await api('/api/state');
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
    updateNetState();
    render();
    $('#lastUpdate').textContent = `Atualizado ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  } catch (error) {
    const cached = localStorage.getItem(STATE_KEY);
    if (cached) {
      try {
        state = JSON.parse(cached);
        render();
        $('#lastUpdate').textContent = 'Offline · último estado salvo';
        toast('Sem conexão. Usando o último estado salvo.');
      } catch { toast(`Falha ao carregar: ${error.message}`); }
    } else {
      toast(`Falha ao carregar: ${error.message}`);
    }
    updateNetState();
  }
}

function render() {
  if (!state) return;
  const s = state.summary;
  $('#kpiApprovals').textContent = s.aprovacoesPendentes;
  $('#kpiTasks').textContent = s.tarefasPendentes + s.tarefasEmAndamento;
  $('#kpiOpps').textContent = state.opportunities.brl + state.opportunities.usd;
  const money = state.finance?.confirmedReceived || {};
  $('#kpiMoney').textContent = `R$ ${Number(money.BRL || 0)} · Bs ${Number(money.BOB || 0)}`;
  renderBridgeState();
  renderApprovals();
  renderTasks();
  renderHuman();
  renderOpps();
  renderRadarStatus();
  renderGates();
  renderProposals();
  renderIa();
  renderEmails();
  updateAutoForwardUi();
}

function renderEmails() {
  const box = $('#emailInbox');
  if (!box) return;
  const inbox = state.emailInbox || { emails: [], counts: {} };
  const watch = state.emailWatchStatus || {};
  const counts = inbox.counts || {};
  const rows = (inbox.emails || []).filter((row) => ['acceptance_or_client_reply', 'new_opportunity', 'proposal_status', 'application_status', 'account_security'].includes(row.kind)).slice(0, 20);
  const watchLabel = watch.status === 'ok' ? 'verificador ativo' : watch.status === 'waiting_for_chrome' ? 'aguardando Chrome/Gmail' : watch.status === 'checking' ? 'verificando agora' : 'verificador não confirmado';
  const summary = `Analisados: ${inbox.total || 0} · novas oportunidades: ${counts.new_opportunity || 0} · possíveis aceites/respostas: ${counts.acceptance_or_client_reply || 0} · estados: ${counts.proposal_status || 0} · ${watchLabel}`;
  if (!rows.length) { box.innerHTML = `<div class="empty">${esc(summary)}. Nenhum sinal relevante importado ainda.</div>`; return; }
  box.innerHTML = `<div class="files">${esc(summary)}${inbox.scannedAt ? ` · leitura ${esc(fmt(inbox.scannedAt))}` : ''}</div>` + rows.map((row) => `
    <article class="task ${row.priority === 'alta' ? 'urgent' : ''}">
      <div class="task-top"><h3>${esc(row.subject || '(sem assunto)')}</h3><span class="pill">${esc(row.source)} · ${esc(row.kind)}</span></div>
      <p>${esc(row.reason)} ${esc(row.snippet || '')}</p>
      <div class="row"><span class="pill">${esc(row.from)}</span>${row.opportunityUrl ? `<a class="linkbtn" href="${esc(row.opportunityUrl)}" target="_blank" rel="noopener">Abrir oportunidade ↗</a>` : ''}${row.displayUrl ? `<a class="linkbtn" href="${esc(row.displayUrl)}" target="_blank" rel="noopener">Abrir no Gmail ↗</a>` : ''}</div>
    </article>`).join('');
}

function renderIaProviders() {
  const select = $('#iaProvider');
  if (!select) return;
  const providers = state.aiProviders || [];
  const current = select.value || 'chatgpt';
  select.innerHTML = providers.map((p) => {
    const ready = p.endpointConfigured && p.cotaDisponivel === true ? 'conectado · cota disponível' : (p.endpointConfigured ? 'sem cota confirmada' : 'aguardando ponte');
    return `<option value="${esc(p.id)}">${esc(p.label)} · ${ready}</option>`;
  }).join('');
  select.value = providers.some((p) => p.id === current) ? current : (providers[0]?.id || 'chatgpt');
}

function renderProposals() {
  const box = $('#proposals');
  const rows = state.proposals || [];
  if (!rows.length) { box.innerHTML = '<div class="empty">Nenhuma proposta enviada registrada.</div>'; return; }
  const names = { confirmada_na_plataforma: 'Confirmada na plataforma', sem_sessao: 'Sem sessão', bloqueada: 'Acesso bloqueado', inconclusiva: 'Inconclusiva', erro: 'Erro na consulta', nao_verificada: 'Ainda não conferida' };
  box.innerHTML = rows.map(p => `
    <article class="proposal-check">
      <div><strong>${esc(p.title)}</strong><small>${esc(p.platform)} · ${esc(p.id)}</small></div>
      <div><span class="pill">${esc(names[p.check.status] || p.check.status)}</span><small>${esc(p.check.evidence || '')}${p.check.checkedAt ? ` · ${esc(fmt(p.check.checkedAt))}` : ''}</small></div>
      <div><a class="btn ghost small" href="${esc(p.url)}" target="_blank" rel="noopener">Abrir</a> <button class="btn ghost small" data-verify-proposal="${esc(p.id)}" type="button">Conferir</button></div>
    </article>`).join('');
  box.querySelectorAll('[data-verify-proposal]').forEach(button => button.addEventListener('click', () => verifyProposal(button.dataset.verifyProposal, button)));
}

async function verifyProposal(id, button) {
  button.disabled = true;
  toast('Conferindo a página da proposta…');
  try {
    const path = id ? `/api/propostas/${encodeURIComponent(id)}/verificar` : '/api/propostas/verificar';
     const response = await fetch(withBase(path), { method: 'POST' });
    if (!response.ok) throw new Error((await response.json()).error || `erro ${response.status}`);
    const result = await response.json();
    toast(result.busy ? 'Conferência já em andamento.' : 'Conferência registrada.');
    await load();
  } catch (error) { toast(`Falha na conferência: ${error.message}`); }
  finally { button.disabled = false; }
}

async function prepareApprovals(button) {
  button.disabled = true;
  toast('Preparando pacotes qualificados do Radar…');
  try {
    const result = await api('/api/aprovacoes/auto-prepare', {
      method: 'POST',
      body: JSON.stringify({ limit: 30 })
    });
    toast(result.createdCount ? `${result.createdCount} pacote(s) pronto(s) na fila de aprovação.` : 'Nenhum pacote novo elegível nesta leitura.');
    await load();
  } catch (error) {
    if (error.name !== 'QueuedError') toast(`Falha ao preparar aprovações: ${error.message}`);
  } finally {
    button.disabled = false;
  }
}

$('#verifyAll').addEventListener('click', event => verifyProposal(null, event.currentTarget));
$('#prepareApprovals')?.addEventListener('click', event => prepareApprovals(event.currentTarget));
$('#emailRefresh')?.addEventListener('click', () => toast('Use o conector Gmail para importar a leitura atual; a Mesa não altera sua caixa.'));
$('#startRadar')?.addEventListener('click', event => startRadar(event.currentTarget));
$('#createSendQueue')?.addEventListener('click', event => createSendQueue(event.currentTarget));
$('#gatesRefresh')?.addEventListener('click', load);
$('#approveQueue')?.addEventListener('click', () => {
  const next = (state?.approvals || [])
    .filter((row) => row.status === 'pendente')
    .sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')))[0];
  if (!next) return toast('Não há aprovação pendente na fila.');
  openApproval(next.id, 'aprovar');
});

function readAutoForward() {
  try { return JSON.parse(localStorage.getItem(AUTO_FORWARD_KEY) || '{"enabled":false}'); }
  catch { return { enabled: false }; }
}

function writeAutoForward(value) {
  localStorage.setItem(AUTO_FORWARD_KEY, JSON.stringify(value));
}

function updateAutoForwardUi() {
  const button = $('#autoForwardQueue');
  const status = $('#autoForwardStatus');
  if (!button || !status) return;
  const config = state?.dispatchScheduler || readAutoForward();
  button.setAttribute('aria-pressed', String(Boolean(config.enabled)));
  button.textContent = config.enabled ? 'Parar encaminhamento automático' : 'Encaminhar todos automaticamente';
  if (!config.enabled) {
    status.textContent = 'Encaminhamento automático desligado.';
    return;
  }
  const next = config.nextAt ? new Date(config.nextAt) : null;
  status.textContent = next && Number.isFinite(next.getTime())
    ? `Encaminhamento automático ativo · próximo pacote após ${fmt(config.nextAt)} · intervalo de 5 minutos.`
    : 'Encaminhamento automático ativo · processando um pacote a cada 5 minutos.';
}

function pickAutoApproval() {
  const pending = (state?.approvals || []).filter((row) => row.status === 'pendente')
    .sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
  if (!pending.length) return null;
  const config = readAutoForward();
  // Interleave platforms when possible, while preserving FIFO within a source.
  if (config.lastSource) return pending.find((row) => String(row.source || '') !== String(config.lastSource)) || pending[0];
  return pending[0];
}

async function autoForwardTick() {
  if (autoForwardBusy || !readAutoForward().enabled) return;
  const next = pickAutoApproval();
  if (!next) {
    updateAutoForwardUi();
    return;
  }
  autoForwardBusy = true;
  const config = readAutoForward();
  try {
    const result = await api(`/api/aprovacoes/${encodeURIComponent(next.id)}/decision`, {
      method: 'POST',
      body: JSON.stringify({ decision: 'aprovar', by: 'fila-automatica', note: 'Encaminhamento automático um-a-um; intervalo de 5 minutos.' })
    });
    writeAutoForward({ ...config, lastApprovalId: next.id, lastSource: next.source || '', lastAt: new Date().toISOString(), nextAt: new Date(Date.now() + AUTO_FORWARD_INTERVAL_MS).toISOString() });
    toast(result.dispatch ? `Pacote encaminhado ao agente: ${next.title}.` : `Pacote aprovado: ${next.title}.`);
    await load();
  } catch (error) {
    // Keep the item pending and retry on the next tick; never claim external send.
    if (error.name === 'QueuedError') toast('Sem conexão; o encaminhamento automático ficou na fila local.');
    else toast(`Encaminhamento automático aguardará nova tentativa: ${error.message}`);
    writeAutoForward({ ...config, nextAt: new Date(Date.now() + AUTO_FORWARD_INTERVAL_MS).toISOString() });
    updateAutoForwardUi();
  } finally {
    autoForwardBusy = false;
  }
}

async function setAutoForward(enabled) {
  try {
    const result = await api('/api/proposal-dispatch/scheduler', {
      method: 'POST',
      body: JSON.stringify({ enabled, intervalMs: AUTO_FORWARD_INTERVAL_MS, runNow: enabled })
    });
    if (result.config) writeAutoForward(result.config);
    toast(enabled ? 'Encaminhamento automático ativado no servidor: um pacote a cada 5 minutos.' : 'Encaminhamento automático pausado; nenhum envio externo foi marcado.');
    await load();
  } catch (error) {
    if (error.name !== 'QueuedError') toast(`Não foi possível configurar a fila: ${error.message}`);
  }
}

$('#autoForwardQueue')?.addEventListener('click', () => setAutoForward(!(state?.dispatchScheduler?.enabled || readAutoForward().enabled)));

function renderApprovals() {
  const box = $('#approvals');
  const rows = state.approvals.filter((a) => approvalFilter === 'todas' || a.status === approvalFilter);
  if (!rows.length) {
    const dispatches = (state.proposalDispatch || []).filter((item) => !item.sent && item.status !== 'enviado_confirmado');
    box.innerHTML = `<div class="empty">${approvalFilter === 'pendente'
      ? `Nenhuma aprovação pendente. ${dispatches.length ? `${dispatches.length} proposta(s) já estão na fila do agente responsável. <button class="btn ghost small" data-show-all-approvals type="button">Ver despachos</button>` : 'Tudo decidido.'}`
      : 'Nenhuma aprovação registrada.'}</div>`;
    box.querySelector('[data-show-all-approvals]')?.addEventListener('click', () => {
      approvalFilter = 'todas';
      document.querySelectorAll('.seg-btn').forEach((x) => x.classList.toggle('active', x.dataset.filter === 'todas'));
      renderApprovals();
    });
    return;
  }
  box.innerHTML = rows.map((a) => {
    const dispatch = (state.proposalDispatch || []).find((item) => item.approvalId === a.id);
    const meta = [
      `<span class="pill ${esc(a.source)}">${esc(a.source)}</span>`,
      `<span class="pill ${esc(a.actionType)}">${esc(actionLabel[a.actionType] || a.actionType)}</span>`,
      `<span class="cost">${esc(a.cost)}</span>`
    ].join('');
    const decision = a.status !== 'pendente'
      ? `<div class="files">${a.status === 'aprovada' ? 'Aprovada' : 'Rejeitada'} por ${esc(a.decidedBy || 'titular')} em ${esc(fmt(a.decidedAt))}${a.note ? ` · ${esc(a.note)}` : ''}</div>`
      : '';
    const proposal = a.proposalText
      ? `<details class="approval-proposal"><summary>Ver proposta pronta</summary><p>${esc(a.proposalText)}</p>${a.demoUrl ? `<a href="${esc(a.demoUrl)}" target="_blank" rel="noopener">Abrir demo pública ↗</a>` : ''}</details>`
      : '';
    const dispatchLabel = dispatch
      ? `<div class="files dispatch-state">Agente: ${esc(dispatch.agent || dispatch.provider || 'fila local')} · ${esc(dispatchStatusLabel[dispatch.status] || dispatch.status)}${dispatch.status === 'aguardando_evidencia' ? ' · abra a página autenticada e registre a confirmação' : ''}${dispatch.externalEvidence ? ` · evidência: ${esc(dispatch.externalEvidence)}` : ''}${['falha_agente','aguardando_agente'].includes(dispatch.status) ? ` <label class="dispatch-provider">Rota <select data-retry-provider="${esc(dispatch.id)}" aria-label="Agente para tentar novamente"><option value="">automática</option>${(state.aiProviders || []).filter((provider) => provider.endpointConfigured && provider.cotaDisponivel).map((provider) => `<option value="${esc(provider.id)}">${esc(provider.label)}</option>`).join('')}</select></label> <button class="btn ghost small" data-retry-dispatch="${esc(dispatch.id)}" type="button">Tentar agente</button>` : ''}</div>`
      : '';
    return `
      <article class="approval ${esc(a.status)}">
        <div class="approval-top">
          <div><div class="meta">${meta}</div><h3>${esc(a.title)}</h3><p>${esc(a.target)}</p></div>
          <span class="pill">${esc(statusLabel[a.status] || a.status)}</span>
        </div>
        <p class="desc">${esc(a.description)}</p>
        ${a.files?.length ? `<div class="files">${a.files.map((f) => `<code>${esc(f)}</code>`).join('')}</div>` : ''}
        ${proposal}
        ${decision}
        ${dispatchLabel}
        ${a.status === 'pendente' ? `<div class="actions"><button class="btn primary" data-approve="${esc(a.id)}">${a.actionType === 'candidatura' ? 'Aprovar e encaminhar' : 'Aprovar'}</button><button class="btn danger" data-reject="${esc(a.id)}">Rejeitar</button></div>` : ''}
      </article>`;
  }).join('');
  box.querySelectorAll('[data-approve]').forEach((b) => b.addEventListener('click', () => openApproval(b.dataset.approve, 'aprovar')));
  box.querySelectorAll('[data-reject]').forEach((b) => b.addEventListener('click', () => openApproval(b.dataset.reject, 'rejeitar')));
  box.querySelectorAll('[data-retry-dispatch]').forEach((b) => b.addEventListener('click', () => retryDispatch(b.dataset.retryDispatch, b)));
}

async function retryDispatch(id, button) {
  button.disabled = true;
  const selected = document.querySelector(`[data-retry-provider="${CSS.escape(id)}"]`);
  const providerId = selected?.value || '';
  toast(providerId ? `Testando ${selected.options[selected.selectedIndex].text}…` : 'Testando a rota automática de agentes…');
  try {
    const result = await api(`/api/proposal-dispatch/${encodeURIComponent(id)}/retry`, { method: 'POST', body: JSON.stringify(providerId ? { providerId } : {}) });
    toast(result.delivery?.status === 'despachada_ao_agente' ? `Encaminhado para ${result.delivery.providerLabel || result.delivery.providerId}.` : 'Nenhum agente respondeu; a fila local foi preservada.');
    await load();
  } catch (error) {
    if (error.name !== 'QueuedError') toast(`Falha na redundância: ${error.message}`);
  } finally { button.disabled = false; }
}

function renderTasks() {
  const box = $('#tasks');
  if (!state.tasks.length) { box.innerHTML = '<div class="empty">Nenhuma tarefa.</div>'; return; }
  box.innerHTML = state.tasks.map((t) => {
    const done = t.status === 'concluida' || t.status === 'cancelada';
    const next = t.status === 'pendente' ? 'em_andamento' : (t.status === 'em_andamento' ? 'concluida' : null);
    const nextLabel = t.status === 'pendente' ? 'Iniciar' : (t.status === 'em_andamento' ? 'Concluir' : null);
    return `
      <article class="task ${done ? 'done' : ''}">
        <div class="task-top"><h3>${esc(t.title)}</h3><span class="pill">${esc(priorityLabel[t.priority] || t.priority)}</span></div>
        <p>${esc(t.description || '')}</p>
        <div class="row">
          <span class="pill ${esc(t.source)}">${esc(t.source)}</span>
          <span class="pill">${esc(t.assignee)}</span>
          <span class="pill">${esc(statusLabel[t.status] || t.status)}</span>
          ${t.due ? `<span class="files">até ${esc(t.due)}</span>` : ''}
        </div>
        <div class="task-actions">
          ${next ? `<button class="btn ghost small" data-task="${esc(t.id)}" data-status="${next}">${nextLabel}</button>` : ''}
          ${!done ? `<button class="linkbtn" data-task="${esc(t.id)}" data-status="cancelada">cancelar</button>` : ''}
        </div>
      </article>`;
  }).join('');
  box.querySelectorAll('[data-task]').forEach((b) => b.addEventListener('click', async () => {
    try {
      await api(`/api/tarefas/${encodeURIComponent(b.dataset.task)}`, { method: 'PATCH', body: JSON.stringify({ status: b.dataset.status }) });
      toast('Tarefa atualizada.');
      await load();
    } catch (error) {
      if (error.name === 'QueuedError') { toast('Sem conexão. A tarefa ficou na fila.'); updateNetState(); }
      else toast(error.message);
    }
  }));
}

function renderHuman() {
  const box = $('#human');
  if (!state.pendencias.length) { box.innerHTML = '<div class="empty">Nenhuma pendência humana.</div>'; return; }
  box.innerHTML = state.pendencias.map((p) => `
    <div class="human"><strong>${esc(p.titulo)}</strong><p>${esc(p.instrucoes)}</p><p><em>${esc(p.resposta)}</em></p></div>
  `).join('');
}

function renderOpps() {
  const box = $('#opps');
  const globalRows = state.radar?.opportunities || [];
  const rows = globalRows.length ? globalRows.slice(0, 40) : state.opportunities.recent;
  if (!rows.length) { box.innerHTML = '<div class="empty">Nenhuma oportunidade.</div>'; return; }
  box.innerHTML = rows.map((o) => `
    <div class="opp">
      <span class="plat">${esc(o.platform || o.source || 'global')}</span>
      <a class="opp-main" href="${esc(o.url)}" target="_blank" rel="noopener">
        <strong>${esc(o.title)}</strong>
        <small>${esc(o.status || o.radarScore?.tier || '')} · ${esc(o.country || 'país desconhecido')} · ${esc(o.language || 'idioma desconhecido')} · score ${esc(o.radarScore?.total ?? '—')}</small>
      </a>
      <span class="val">${esc(o.budget || '—').slice(0, 42)}</span>
      ${o.id && !String(o.id).startsWith('radar-') ? `<button class="btn ghost small ia-btn" data-ia="${esc(o.id)}">Enviar para IA</button>` : ''}
    </div>
  `).join('');
  box.querySelectorAll('[data-ia]').forEach((b) => b.addEventListener('click', () => sendToIa(b.dataset.ia, b)));
}

function renderRadarStatus() {
  const box = $('#radarStatus');
  if (!box) return;
  const latest = (state.radar?.runs || [])[0];
  if (!latest) { box.textContent = 'Nenhuma varredura iniciada. A primeira execução usa o catálogo local em modo sombra.'; return; }
  const agg = latest.aggregator || {};
  box.textContent = `Última execução ${latest.status} · ${agg.normalized || 0} oportunidades normalizadas · ${agg.qualified || 0} qualificadas · ${agg.exploratory || 0} exploratórias · ${latest.gateIds?.length || 0} pendência(s) humana(s).`;
}

function beepGate() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.28);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
    navigator.vibrate?.([120, 80, 120]);
  } catch {}
}

function renderGates() {
  const box = $('#radarGates');
  if (!box) return;
  const gates = state.radar?.gates || [];
  const banner = $('#gateBanner');
  const bannerText = $('#gateBannerText');
  if (banner) banner.hidden = !gates.length;
  if (bannerText && gates.length) bannerText.textContent = `${gates.length} etapa(s) aguardando login, confirmação ou verificação humana.`;
  const known = (() => { try { return JSON.parse(localStorage.getItem(GATE_SEEN_KEY) || 'null'); } catch { return null; } })();
  const ids = gates.map((gate) => gate.id);
  if (known && ids.some((id) => !known.includes(id))) { beepGate(); toast('Há uma verificação do navegador aguardando você.'); }
  localStorage.setItem(GATE_SEEN_KEY, JSON.stringify(ids));
  if (!gates.length) { box.innerHTML = '<div class="empty">Nenhum login ou desafio aguardando você.</div>'; return; }
  box.innerHTML = gates.map((gate) => `
    <article class="task urgent">
      <div class="task-top"><h3>${esc(gate.platform)} · ${esc(gate.type)}</h3><span class="pill">ação humana</span></div>
      <p>${esc(gate.action)}. A varredura está pausada nesta etapa.</p>
      <div class="row"><button class="btn small" data-gate-open="${esc(gate.url)}">Abrir no navegador usado ↗</button><button class="btn primary small" data-gate-complete="${esc(gate.id)}">Concluí a etapa</button></div>
    </article>`).join('');
  box.querySelectorAll('[data-gate-complete]').forEach((button) => button.addEventListener('click', async () => {
    button.disabled = true;
    try {
      const completion = await api(`/api/browser/gates/${encodeURIComponent(button.dataset.gateComplete)}/complete`, { method: 'POST', body: JSON.stringify({ by: 'titular' }) });
      if (completion.run?.id && completion.run.status === 'running' && !(completion.run.gateIds || []).length) {
        await api(`/api/radar/runs/${encodeURIComponent(completion.run.id)}/resume`, { method: 'POST', body: '{}' });
        toast(`Pendência concluída em ${completion.clearedGateIds?.length || 1} execução(ões); a varredura foi retomada.`);
      } else {
        toast(completion.message || 'Pendência concluída.');
      }
      await load();
    } catch (error) { toast(`Não foi possível concluir: ${error.message}`); button.disabled = false; }
  }));
  box.querySelectorAll('[data-gate-open]').forEach((button) => button.addEventListener('click', () => {
    const popup = window.open(button.dataset.gateOpen, 'moneyia-human-gate', 'noopener,noreferrer');
    if (popup) { popup.focus(); return; }
    // Popup blockers still allow a direct navigation while keeping the Mesa.
    window.location.assign(button.dataset.gateOpen);
  }));
}

async function startRadar(button) {
  button.disabled = true;
  toast('Iniciando varredura global em modo sombra…');
  try {
    const result = await api('/api/radar/runs', { method: 'POST', body: JSON.stringify({ mode: 'shadow', shards: 6 }) });
    if (result.gates?.length) { beepGate(); toast('A varredura encontrou uma etapa humana; veja a fila do navegador.'); }
    else toast(`Varredura concluída: ${result.run?.aggregator?.normalized || 0} oportunidades normalizadas.`);
    await load();
  } catch (error) { toast(`Falha na varredura: ${error.message}`); }
  finally { button.disabled = false; }
}

async function createSendQueue(button) {
  button.disabled = true;
  toast('Montando fila visual de propostas…');
  try {
    const result = await api('/api/radar/send-queue', {
      method: 'POST',
      body: JSON.stringify({ limit: 30, mode: 'visual_review' })
    });
    toast(result.createdCount ? `${result.createdCount} pacote(s) na fila de revisão visual.` : 'Nenhum pacote novo elegível nesta leitura.');
    await load();
    document.querySelector('#approvals-title')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (error) { toast(`Falha ao criar fila: ${error.message}`); }
  finally { button.disabled = false; }
}

async function sendToIa(id, button) {
  button.disabled = true;
  try {
    const providerId = $('#iaProvider')?.value || 'chatgpt';
    const result = await api(`/api/oportunidades/${encodeURIComponent(id)}/enviar-ia`, { method: 'POST', body: JSON.stringify({ providerId }) });
    if (result.delivery === 'despachada') toast(`Encaminhado a ${result.provider}; aguardando retorno verificável.`);
    else if (result.delivery === 'aguardando_ponte') toast(`${result.provider || 'ChatGPT pago'} aguarda ponte; nada foi enviado.`);
    else if (result.delivery === 'already_queued') toast('Esta oportunidade já está na fila da IA.');
    else toast(`Falha no envio para ${result.provider || 'a IA'}.`);
    await load();
  } catch (error) {
    if (error.name === 'QueuedError') toast('Sem conexão. O envio para a IA ficou na fila.');
    else toast(error.message);
  } finally { button.disabled = false; }
}

function iaStatus(status) {
  return {
    pronta_para_colar: 'pronta para colar',
    aguardando_ponte: 'aguardando ponte',
    despachada: 'encaminhada; aguardando retorno',
    falha_dispatch: 'falha no dispatch',
    respondida: 'respondida'
  }[status] || status;
}

function renderIa() {
  const box = $('#iaQueue');
  const badge = $('#iaWebhook');
  renderIaProviders();
  if (badge) badge.textContent = state.aiWebhook ? 'IA conectada · ponte local ativa' : 'IA opcional · ponte local ativa';
  if (!state.ia?.length) {
    box.innerHTML = '<div class="empty">Nenhuma oportunidade enviada para a IA. Use o botão “Enviar para IA”.</div>';
    return;
  }
  box.innerHTML = [...state.ia].reverse().map((item) => `
    <article class="ia-item">
      <div class="ia-top">
        <div>
          <div class="meta"><span class="pill chatgpt">${esc(item.providerLabel || item.providerId || 'chatgpt')}</span><span class="pill">${esc(iaStatus(item.status))}</span></div>
          <h3>${esc(item.title)}</h3>
          <p>${esc(item.platform)} · ${esc(item.budget || 'orçamento desconhecido')}</p>
        </div>
        <span class="pill">${esc(item.id)}</span>
      </div>
      <details class="ia-prompt"><summary>Ver prompt</summary><pre>${esc(item.prompt)}</pre></details>
      ${item.retorno ? `<details class="ia-prompt"><summary>Ver retorno da IA</summary><pre>${esc(item.retorno)}</pre></details>` : ''}
      <div class="ia-actions">
        <a class="btn ghost small" href="${esc(item.url)}" target="_blank" rel="noopener">Abrir oportunidade</a>
        ${item.status !== 'respondida' ? `<button class="btn small" data-continue-ia="${esc(item.id)}">Continuar localmente</button><button class="btn ghost small" data-retry-ia="${esc(item.id)}">Tentar IA</button><button class="btn ghost small" data-return-ia="${esc(item.id)}">Colar retorno</button>` : ''}
      </div>
    </article>
  `).join('');
  box.querySelectorAll('[data-return-ia]').forEach((b) => b.addEventListener('click', () => openIaReturn(b.dataset.returnIa)));
  box.querySelectorAll('[data-continue-ia]').forEach((b) => b.addEventListener('click', () => continueLocally(b.dataset.continueIa, b)));
  box.querySelectorAll('[data-retry-ia]').forEach((b) => b.addEventListener('click', () => retryIa(b.dataset.retryIa, b)));
}

async function continueLocally(id, button) {
  button.disabled = true;
  try {
    const result = await api(`/api/bridge/ia/${encodeURIComponent(id)}/continuar`, { method: 'POST', body: '{}' });
    toast(result.delivery === 'local_fallback' ? 'Ponte local continuou o item e criou uma tarefa de revisão.' : 'Este item já foi respondido.');
    await load();
  } catch (error) {
    if (error.name === 'QueuedError') toast('Sem conexão com o servidor. O estado salvo continua disponível neste dispositivo.');
    else toast(error.message);
  } finally { button.disabled = false; }
}

async function retryIa(id, button) {
  button.disabled = true;
  try {
    const providerId = $('#iaProvider')?.value || 'chatgpt';
    const result = await api(`/api/bridge/ia/${encodeURIComponent(id)}/retry`, { method: 'POST', body: JSON.stringify({ providerId }) });
    toast(result.delivery === 'despachada' ? `Encaminhado a ${result.provider}.` : 'IA indisponível; o item continua na ponte local.');
    await load();
  } catch (error) {
    if (error.name === 'QueuedError') toast('Sem conexão. A tentativa ficou na fila local.');
    else toast(error.message);
  } finally { button.disabled = false; }
}

function openApproval(id, decision) {
  const a = state.approvals.find((row) => row.id === id);
  if (!a) return;
  pendingDecision = { id, decision };
  $('#modalKicker').textContent = decision === 'aprovar' ? 'Aprovar demanda' : 'Rejeitar demanda';
  $('#modalTitle').textContent = a.title;
  $('#modalText').textContent = `${a.source} · ${actionLabel[a.actionType] || a.actionType} · ${a.cost}. ${a.description}`;
  $('#modalNote').value = '';
  $('#modalApprove').style.display = decision === 'aprovar' ? '' : 'none';
  $('#modalReject').style.display = decision === 'rejeitar' ? '' : 'none';
  $('#modal').hidden = false;
  $('#modalNote').focus();
}

function closeModal() { $('#modal').hidden = true; pendingDecision = null; }

async function submitDecision(decision) {
  if (!pendingDecision) return;
  const button = decision === 'aprovar' ? $('#modalApprove') : $('#modalReject');
  button.disabled = true;
  try {
    const result = await api(`/api/aprovacoes/${encodeURIComponent(pendingDecision.id)}/decision`, {
      method: 'POST',
      body: JSON.stringify({ decision, by: 'titular', note: $('#modalNote').value.trim() })
    });
    closeModal();
    if (decision === 'aprovar' && result.dispatch) {
      toast(result.delivery?.status === 'despachada_ao_agente' ? 'Aprovada e encaminhada ao agente.' : 'Aprovada; tarefa do agente criada na ponte local.');
    } else {
      toast(decision === 'aprovar' ? 'Aprovação registrada.' : 'Rejeição registrada.');
    }
    await load();
  } catch (error) {
    if (error.name === 'QueuedError') {
      closeModal();
      toast('Sem conexão. A decisão ficou na fila e sobe quando voltar.');
      updateNetState();
    } else toast(error.message);
  }
  finally { button.disabled = false; }
}

function openTaskModal() {
  $('#taskForm').reset();
  $('#taskModal').hidden = false;
  $('#taskName').focus();
}
function closeTaskModal() { $('#taskModal').hidden = true; }

function openIaReturn(id) {
  const item = state.ia?.find((x) => x.id === id);
  if (!item) return;
  pendingIa = id;
  $('#iaModalTitle').textContent = item.title;
  $('#iaModalText').textContent = 'Cole o retorno do projeto ChatGPT moneyIA. Ao salvar, o Codex recebe uma tarefa com esse conteúdo.';
  $('#iaReturn').value = '';
  $('#iaModal').hidden = false;
  $('#iaReturn').focus();
}
function closeIaModal() { $('#iaModal').hidden = true; pendingIa = null; }

async function saveIaReturn() {
  if (!pendingIa) return;
  const text = $('#iaReturn').value.trim();
  if (!text) return toast('Cole o retorno antes de salvar.');
  const button = $('#iaSave');
  button.disabled = true;
  try {
    await api(`/api/ia/${encodeURIComponent(pendingIa)}/retorno`, { method: 'POST', body: JSON.stringify({ retorno: text }) });
    closeIaModal();
    toast('Retorno salvo; tarefa criada para o Codex.');
    await load();
  } catch (error) {
    if (error.name === 'QueuedError') {
      closeIaModal();
      toast('Sem conexão. O retorno ficou na fila.');
    } else toast(error.message);
  } finally { button.disabled = false; }
}

$('#refresh').addEventListener('click', load);
$('#modalClose').addEventListener('click', closeModal);
$('#modalCancel').addEventListener('click', closeModal);
$('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal') closeModal(); });
$('#modalApprove').addEventListener('click', () => submitDecision('aprovar'));
$('#modalReject').addEventListener('click', () => submitDecision('rejeitar'));
$('#openTask').addEventListener('click', openTaskModal);
$('#taskClose').addEventListener('click', closeTaskModal);
$('#taskCancel').addEventListener('click', closeTaskModal);
$('#taskModal').addEventListener('click', (e) => { if (e.target.id === 'taskModal') closeTaskModal(); });
$('#iaClose').addEventListener('click', closeIaModal);
$('#iaCancel').addEventListener('click', closeIaModal);
$('#iaSave').addEventListener('click', saveIaReturn);
$('#iaModal').addEventListener('click', (e) => { if (e.target.id === 'iaModal') closeIaModal(); });
$('#taskForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await api('/api/tarefas', { method: 'POST', body: JSON.stringify({
      title: $('#taskName').value.trim(),
      description: $('#taskDesc').value.trim(),
      assignee: $('#taskAssignee').value,
      priority: $('#taskPriority').value,
      source: 'manual'
    }) });
    closeTaskModal();
    toast('Tarefa criada.');
    await load();
  } catch (error) {
    if (error.name === 'QueuedError') {
      closeTaskModal();
      toast('Sem conexão. A tarefa ficou na fila.');
      updateNetState();
    } else toast(error.message);
  }
});
document.querySelectorAll('.seg-btn').forEach((b) => b.addEventListener('click', () => {
  approvalFilter = b.dataset.filter;
  document.querySelectorAll('.seg-btn').forEach((x) => x.classList.toggle('active', x === b));
  renderApprovals();
}));
setInterval(load, 15000);
setInterval(() => {
  $('#clock').textContent = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}, 1000);
$('#clock').textContent = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

$('#syncBtn').addEventListener('click', async () => {
  const result = await flushOutbox();
  toast(result.sent ? `${result.sent} operação(ões) sincronizada(s).` : 'Nada para sincronizar.');
  await load();
});
window.addEventListener('online', async () => {
  toast('Conexão voltou. Sincronizando fila…');
  const result = await flushOutbox();
  if (result.sent) toast(`${result.sent} operação(ões) sincronizada(s).`);
  await load();
});
window.addEventListener('offline', () => { updateNetState(); toast('Sem conexão. A mesa entrou em modo offline.'); });

let installPrompt = null;
window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  installPrompt = event;
  const btn = $('#installBtn');
  if (btn) { btn.hidden = false; btn.addEventListener('click', async () => { btn.hidden = true; installPrompt.prompt(); await installPrompt.userChoice; installPrompt = null; }, { once: true }); }
});
window.addEventListener('appinstalled', () => { const btn = $('#installBtn'); if (btn) btn.hidden = true; });

 if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
   navigator.serviceWorker.register(withBase('/sw.js')).catch(() => {});
}
updateNetState();
updateAutoForwardUi();
load();
