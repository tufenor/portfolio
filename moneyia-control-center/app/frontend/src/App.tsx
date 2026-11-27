import React, { useCallback, useEffect, useState } from 'react';
import type { AiTier, MesaState, NavSection, SubAiAgent } from './types/moneyia';
import {
  answerQuestion,
  createNewTask,
  decideBatchApprovals,
  decideSingleApproval,
  fetchMesaState,
  runEngineAction,
  runMcpAction,
  runQueueBatch,
  startRadar,
  prepareRadarQueue,
  prepareProposalCheck,
  runSelfImprove,
  saveIaReturn,
  sendOpportunityToAi,
  syncAuthority,
  toggleTaskStatus
} from './api/client';
import {
  IconCheckShield,
  IconCpu,
  IconListFlow,
  IconMenu,
  IconNetwork,
  IconRadar,
  IconRefresh,
  IconSpark,
  IconTerminal
} from './components/Icons';
import { ResultsView } from './components/ResultsView';
import { AiReportView } from './components/AiReportView';
import { SubAiFactoryView } from './components/SubAiFactoryView';
import { HuntQueueView } from './components/HuntQueueView';
import { ApprovalsView } from './components/ApprovalsView';
import { TasksAgentView } from './components/TasksAgentView';
import { McpConsoleView } from './components/McpConsoleView';

const SUBAI_STORAGE_KEY = 'moneyia_ts_subais_v1';

function readStoredSubAis(): SubAiAgent[] {
  try {
    const raw = localStorage.getItem(SUBAI_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeStoredSubAis(items: SubAiAgent[]) {
  try {
    localStorage.setItem(SUBAI_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // ignore storage errors
  }
}

function formatCurrency(val: number | undefined, symbol: string) {
  const num = Number(val || 0);
  return `${symbol} ${num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export const App: React.FC = () => {
  const [mesa, setMesa] = useState<MesaState | null>(null);
  const [activeNav, setActiveNav] = useState<NavSection>('results');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [tier, setTier] = useState<AiTier>('fast');
  const [autoSyncMs, setAutoSyncMs] = useState<number>(30000);
  const [subAis, setSubAis] = useState<SubAiAgent[]>(() => readStoredSubAis());
  const [busy, setBusy] = useState(false);
  const [logTitle, setLogTitle] = useState('Pronto');
  const [logBody, setLogBody] = useState('Console operacional ativo. Selecione uma ação para executar.');

  const pushLog = useCallback((title: string, payload: unknown) => {
    setLogTitle(`${title} · ${new Date().toLocaleTimeString('pt-BR')}`);
    setLogBody(typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2));
  }, []);

  const refreshState = useCallback(async (silent = false) => {
    const activeEl = document.activeElement;
    if (silent && activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
      return;
    }
    const data = await fetchMesaState();
    if (data && !('error' in data)) {
      setMesa(data);
    } else if (!silent) {
      pushLog('Aviso /api/state', data);
    }
  }, [pushLog]);

  useEffect(() => {
    void refreshState(false);
  }, [refreshState]);

  useEffect(() => {
    if (!autoSyncMs) return;
    const handle = window.setInterval(() => {
      void refreshState(true);
    }, autoSyncMs);
    return () => window.clearInterval(handle);
  }, [autoSyncMs, refreshState]);

  const executeBusy = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(true);
    pushLog(label, 'Executando...');
    try {
      const res = await fn();
      pushLog(label, res);
      await refreshState(false);
    } catch (err) {
      pushLog(`${label} (erro)`, err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleCreateSubAi = (item: Omit<SubAiAgent, 'id' | 'createdAt' | 'runsCount'>) => {
    const created: SubAiAgent = {
      ...item,
      id: `subai-${Date.now().toString(36)}`,
      createdAt: new Date().toISOString(),
      runsCount: 0
    };
    const next = [created, ...subAis];
    setSubAis(next);
    writeStoredSubAis(next);
    pushLog('Sub-IA criada', created);
  };

  const handleDeleteSubAi = (id: string) => {
    const next = subAis.filter((s) => s.id !== id);
    setSubAis(next);
    writeStoredSubAis(next);
    pushLog('Sub-IA removida', { id });
  };

  const handleTriggerSubAi = async (subAi: SubAiAgent) => {
    const next = subAis.map((s) =>
      s.id === subAi.id
        ? { ...s, runsCount: s.runsCount + 1, lastProvider: subAi.tier }
        : s
    );
    setSubAis(next);
    writeStoredSubAis(next);
    await executeBusy(`Sub-IA: ${subAi.name}`, () => runQueueBatch(3, subAi.tier));
  };

  const pendingApprovals = (mesa?.approvals || []).filter((a) => a.status === 'pendente');
  const openTasks = (mesa?.tasks || []).filter((t) => t.status !== 'concluida');
  const iaList = mesa?.ia || [];
  const opps = mesa?.opportunities || { recent: [] };
  const totalOpps = opps.total ?? ((opps.brl || 0) + (opps.usd || 0) + (opps.global || 0));
  const resultsCount = iaList.filter((i) => i.retorno || i.response).length;
  const commercial = mesa?.commercial;
  const rec = commercial?.received || mesa?.finance?.confirmedReceived || {};
  const email = mesa?.email;
  const emailStatus = email?.watch?.status || 'unknown';

  const navItems: Array<{ id: NavSection; label: string; count?: number; icon: React.ReactNode }> = [
    { id: 'results', label: 'Resultados Consolidados', count: resultsCount, icon: <IconSpark size={16} /> },
    { id: 'agents', label: 'Relatório por IA', count: 4 + subAis.length, icon: <IconCpu size={16} /> },
    { id: 'subais', label: 'Sub-IAs & Alcance', count: subAis.length, icon: <IconNetwork size={16} /> },
    { id: 'hunt', label: 'Caça & Fila IA', count: totalOpps, icon: <IconRadar size={16} /> },
    { id: 'approvals', label: 'Aprovações', count: pendingApprovals.length, icon: <IconCheckShield size={16} /> },
    { id: 'tasks', label: 'Tarefas & Agente', count: openTasks.length, icon: <IconListFlow size={16} /> },
    { id: 'engines', label: 'Motores & MCP', count: 8, icon: <IconTerminal size={16} /> }
  ];

  const selectNav = (id: NavSection) => {
    setActiveNav(id);
    setMobileMenuOpen(false);
  };

  return (
    <div className="app-frame">
      {mobileMenuOpen && (
        <div className="drawer-backdrop" onClick={() => setMobileMenuOpen(false)} />
      )}

      <aside className={`rail-nav ${mobileMenuOpen ? 'open' : ''}`}>
        <div className="rail-brand">
          <div className="brand-mark">m</div>
          <div>
            <div className="brand-name">moneyIA</div>
            <div className="brand-sub">MESA DE AGENTES TS/REACT</div>
          </div>
        </div>

        <div className="nav-group">
          <div className="nav-group-label">COMANDO & INTELIGÊNCIA</div>
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`nav-btn ${activeNav === item.id ? 'active' : ''}`}
              onClick={() => selectNav(item.id)}
            >
              <span className="nav-btn-left">
                {item.icon}
                <span>{item.label}</span>
              </span>
              {item.count !== undefined && <span className="nav-pill">{item.count}</span>}
            </button>
          ))}
        </div>

        <div className="rail-card">
          <div className="nav-group-label">RECEBIDO CONFIRMADO</div>
          <div className="kv-line"><span>BRL</span><strong>{formatCurrency(rec.BRL, 'R$')}</strong></div>
          <div className="kv-line"><span>USD</span><strong>{formatCurrency(rec.USD, 'US$')}</strong></div>
          <div className="kv-line"><span>BOB</span><strong>{formatCurrency(rec.BOB, 'Bs')}</strong></div>
        </div>

        <div className="rail-footer">
          <span className="status-dot" />
          <span>{mesa ? '127.0.0.1:8899 conectado' : 'Conectando...'}</span>
        </div>
      </aside>

      <div className="workspace-main">
        <header className="top-header">
          <div className="header-title-wrap">
            <button
              type="button"
              className="mobile-menu-btn"
              aria-label="Abrir menu"
              onClick={() => setMobileMenuOpen((v) => !v)}
            >
              <IconMenu size={20} />
            </button>
            <div>
              <div className="kicker">AUTOMAÇÃO DE AGENTES · RESULTADOS CONSOLIDADOS</div>
              <h1>
                Mesa de Controle <span className="accent-italic">moneyIA.</span>
              </h1>
            </div>
          </div>

          <div className="header-actions">
            <select
              className="field-control compact-select"
              value={autoSyncMs}
              onChange={(e) => setAutoSyncMs(Number(e.target.value))}
              aria-label="Auto-Sync"
            >
              <option value={0}>Manual</option>
              <option value={15000}>Sync 15s</option>
              <option value={30000}>Sync 30s</option>
              <option value={60000}>Sync 60s</option>
            </select>

            <select
              className="field-control compact-select"
              value={tier}
              onChange={(e) => setTier(e.target.value as AiTier)}
              aria-label="Tier da IA"
            >
              <option value="fast">tier: fast</option>
              <option value="heavy">tier: heavy</option>
            </select>

            <button
              type="button"
              className="btn btn-secondary"
              disabled={busy}
              onClick={() => void refreshState(false)}
            >
              <IconRefresh size={14} />
              <span>Atualizar</span>
            </button>

            <button
              type="button"
              className="btn btn-primary"
              disabled={busy}
              onClick={() => void executeBusy('Rodar Agentes (5)', () => runQueueBatch(5, tier))}
            >
              Rodar Agentes (5)
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              disabled={busy}
              onClick={() => void executeBusy('Sync Autoridade', syncAuthority)}
            >
              Sync Autoridade
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              disabled={busy}
              onClick={() => void executeBusy('Auto-Melhoria', runSelfImprove)}
            >
              Auto-Melhoria
            </button>
          </div>
        </header>

        <section className="kpi-grid">
          <button type="button" className="kpi-tile" onClick={() => selectNav('results')}>
            <span className="kpi-label">RESULTADOS CONSOLIDADOS</span>
            <strong className="kpi-num">{resultsCount}</strong>
            <span className="kpi-sub">Análises IA com retorno</span>
          </button>
          <button type="button" className="kpi-tile" onClick={() => selectNav('agents')}>
            <span className="kpi-label">IAS & SUB-IAS ATIVAS</span>
            <strong className="kpi-num">{4 + subAis.length}</strong>
            <span className="kpi-sub">4 núcleo · {subAis.length} sub-IAs</span>
          </button>
          <button type="button" className="kpi-tile" onClick={() => selectNav('hunt')}>
            <span className="kpi-label">OPORTUNIDADES MAPEADAS</span>
            <strong className="kpi-num">{totalOpps}</strong>
            <span className="kpi-sub">BRL {opps.brl || 0} · USD {opps.usd || 0} · GLB {opps.global || 0}</span>
          </button>
          <button type="button" className="kpi-tile" onClick={() => selectNav('approvals')}>
            <span className="kpi-label">APROVAÇÕES PENDENTES</span>
            <strong className="kpi-num">{pendingApprovals.length}</strong>
            <span className="kpi-sub">Decisão humana</span>
          </button>
          <button type="button" className="kpi-tile" onClick={() => selectNav('tasks')}>
            <span className="kpi-label">TAREFAS ABERTAS</span>
            <strong className="kpi-num">{openTasks.length}</strong>
            <span className="kpi-sub">Total: {(mesa?.tasks || []).length}</span>
          </button>
        </section>

        <section className="surface-card" style={{ marginBottom: '18px' }} aria-label="Leitura de e-mails">
          <div className="card-header">
            <div>
              <div className="kicker">ENTRADA DE E-MAIL · SOMENTE LEITURA</div>
              <strong>Feed de oportunidades e retornos</strong>
            </div>
            <span className={`status-chip ${emailStatus === 'ok' ? 'status-ok' : ''}`}>{emailStatus}</span>
          </div>
          <div className="muted-xs">
            {email?.feedCount ?? 0} itens no feed · {email?.total ?? 0} mensagens analisadas ·
            {' '}{email?.counts?.acceptance_or_client_reply ?? 0} possíveis respostas ·
            {' '}{email?.counts?.product_sale_signal ?? 0} possíveis pedidos ·
            {' '}{email?.counts?.payment_received ?? 0} possíveis recebimentos.
            {email?.watch?.lastError ? ' · Sinal técnico a conferir' : ''}
          </div>
        </section>

        {commercial && (
          <section className="surface-card commercial-panel" style={{ marginBottom: '18px' }}>
            <div className="card-header"><div><div className="kicker">CONVERSÃO COMERCIAL</div><strong>Envios, contratos e recebimentos separados</strong></div></div>
            <div className="kpi-grid compact-kpis">
              <div className="kpi-tile"><span className="kpi-label">ENVIOS HISTÓRICOS</span><strong className="kpi-num">{commercial.historicalSent}</strong><span className="kpi-sub">registro histórico</span></div>
              <div className="kpi-tile"><span className="kpi-label">DESPACHES CONFIRMADOS</span><strong className="kpi-num">{commercial.confirmedDispatches}</strong><span className="kpi-sub">evidência de plataforma</span></div>
              <div className="kpi-tile"><span className="kpi-label">CONTRATOS</span><strong className="kpi-num">{commercial.contracts}</strong><span className="kpi-sub">não confundir com proposta</span></div>
            </div>
            <div className="scroll-stack">
              {commercial.queue.map((item) => (
                <div className="list-row" key={item.id}>
                  <div>
                    <strong>{item.id} · {item.title}</strong>
                    <div className="card-meta">{item.stage} · {item.nextAction}{item.amount ? ` · ${item.amount}` : ''}</div>
                  </div>
                  <div className="action-row">
                    {item.stage === 'Aguardando decisão' && (
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => selectNav('approvals')}>
                        Revisar na Mesa
                      </button>
                    )}
                    {item.url && <a className="link-inline" href={item.url} target="_blank" rel="noreferrer">Fonte</a>}
                    {item.demoUrl && <a className="link-inline" href={item.demoUrl} target="_blank" rel="noreferrer">Demo</a>}
                  </div>
                </div>
              ))}
            </div>
            {mesa.templates && mesa.templates.length > 0 && <><div className="card-header" style={{ marginTop: '18px' }}><strong>Modelos reutilizáveis editáveis</strong></div><div className="cards-grid">{mesa.templates.map((t) => <article className="surface-card" key={t.id}><h3 className="card-title">{t.name}</h3><div className="card-excerpt">{t.description}</div><div className="card-meta">Usar quando: {t.whenToUse}<br />Campos: {t.editable.join(', ')}</div><div className="card-actions"><a className="btn btn-secondary btn-sm" href={t.exampleUrl} target="_blank" rel="noreferrer">Demo</a><a className="btn btn-secondary btn-sm" href={t.sourceUrl} target="_blank" rel="noreferrer">Fonte</a></div></article>)}</div></>}
          </section>
        )}

        <main className="view-container">
          {activeNav === 'results' && (
            <ResultsView
              iaItems={iaList}
              opportunities={opps.recent || []}
              onSendToAi={(id) => void executeBusy(`Enviar ${id} p/ IA`, () => sendOpportunityToAi(id))}
              onHuntNow={() => void executeBusy(`Caça (${tier})`, () => runQueueBatch(3, tier))}
              busy={busy}
            />
          )}

          {activeNav === 'agents' && (
            <AiReportView
              iaItems={iaList}
              subAis={subAis}
              onRunTier={(t) => void executeBusy(`Lote (${t})`, () => runQueueBatch(3, t))}
              busy={busy}
            />
          )}

          {activeNav === 'subais' && (
            <SubAiFactoryView
              subAis={subAis}
              onCreateSubAi={handleCreateSubAi}
              onDeleteSubAi={handleDeleteSubAi}
              onTriggerSubAi={(s) => void handleTriggerSubAi(s)}
              busy={busy}
            />
          )}

          {activeNav === 'hunt' && (
            <HuntQueueView
              opportunities={opps.recent || []}
              totalOpportunities={totalOpps}
              iaItems={iaList}
              onSendOpportunity={(id) => void executeBusy(`Enviar ${id} p/ IA`, () => sendOpportunityToAi(id))}
              onProcessBatch={(lim) => void executeBusy(`Lote (${lim})`, () => runQueueBatch(lim, tier))}
              onStartRadar={() => void executeBusy('Varredura do Radar', startRadar)}
              onPrepareQueue={() => void executeBusy('Preparar fila visual', prepareRadarQueue)}
              radarStatus={mesa?.radar?.runs?.[0]?.status}
              onSaveReturn={(id, txt) => void executeBusy(`Retorno ${id}`, () => saveIaReturn(id, txt))}
              busy={busy}
            />
          )}

          {activeNav === 'approvals' && (
            <ApprovalsView
              approvals={mesa?.approvals || []}
              proposalDispatch={mesa?.proposalDispatch || []}
              onDecideOne={(id, dec, note) =>
                void executeBusy(`${dec} ${id}`, () => decideSingleApproval(id, dec, note))
              }
              onDecideBatch={(ids, dec, note) =>
                void executeBusy(`Lote ${dec}`, () => decideBatchApprovals(ids, dec, note))
              }
              onPrepareCheck={(id) => void executeBusy(`Conferência ${id}`, () => prepareProposalCheck(id))}
              busy={busy}
            />
          )}

          {activeNav === 'tasks' && (
            <TasksAgentView
              tasks={mesa?.tasks || []}
              questions={mesa?.agentQuestions || []}
              onCreateTask={(title, prio) =>
                void executeBusy('Nova tarefa', () => createNewTask(title, prio))
              }
              onToggleTask={(id, nextSt) =>
                void executeBusy(`Tarefa ${id}`, () => toggleTaskStatus(id, nextSt))
              }
              onAnswerQuestion={(id, ans) =>
                void executeBusy(`Responder ${id}`, () => answerQuestion(id, ans))
              }
              busy={busy}
            />
          )}

          {activeNav === 'engines' && (
            <McpConsoleView
              engines={mesa?.engines}
              onRunMcp={(act) => void executeBusy(`MCP: ${act}`, () => runMcpAction(act))}
              onRunEngine={(eng) => void executeBusy(`Módulo: ${eng}`, () => runEngineAction(eng))}
              busy={busy}
            />
          )}
        </main>

        <section className="surface-card console-strip">
          <div className="card-header">
            <strong>Saída dos Agentes & Execução</strong>
            <div className="action-row">
              <span className="muted-xs">{logTitle}</span>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  if (navigator.clipboard) void navigator.clipboard.writeText(logBody).catch(() => {});
                }}
              >
                Copiar
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setLogTitle('Limpo');
                  setLogBody('');
                }}
              >
                Limpar
              </button>
            </div>
          </div>
          <div className="console-body">{logBody}</div>
        </section>
      </div>
    </div>
  );
};
