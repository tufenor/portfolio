import React, { useState } from 'react';
import type { ApprovalItem, DispatchAutomation, ProposalDispatchItem } from '../types/moneyia';
import { IconCheckShield } from './Icons';

interface ApprovalsViewProps {
  approvals: ApprovalItem[];
  onDecideOne: (id: string, decision: 'aprovar' | 'rejeitar', note: string) => void;
  onDecideBatch: (ids: string[], decision: 'aprovar' | 'rejeitar', note: string) => void;
  busy: boolean;
  proposalDispatch: ProposalDispatchItem[];
  onPrepareCheck: (id: string) => void;
  dispatchAutomation?: DispatchAutomation;
  onConfigureDispatchAutomation: (enabled: boolean) => void;
  onRunDispatchNow: () => void;
}

export const ApprovalsView: React.FC<ApprovalsViewProps> = ({
  approvals,
  onDecideOne,
  onDecideBatch,
  busy,
  proposalDispatch,
  onPrepareCheck,
  dispatchAutomation,
  onConfigureDispatchAutomation,
  onRunDispatchNow
}) => {
  const [batchNote, setBatchNote] = useState('');
  const pending = approvals.filter((a) => a.status === 'pendente');
  const dispatchByApproval = new Map(proposalDispatch.map((row) => [row.approvalId, row]));
  const approvedCandidates = approvals.filter((item) => item.status === 'aprovada'
    && item.actionType === 'candidatura'
    && item.opportunityUrl?.startsWith('https://')
    && item.proposalText
    && item.demoUrl?.startsWith('https://'));
  const dispatches = proposalDispatch.filter((row) => !row.sent);

  return (
    <section className="view-stack">
      <div className="section-banner">
        <div>
          <span className="kicker">DECISÕES DA MESA</span>
          <h2>Mesa de aprovações</h2>
          <p>Veja a proposta, o valor e a demonstração antes de encaminhar ao agente. Cada decisão da fila é registrada em ordem.</p>
        </div>
        <div className="action-row">
          <input
            type="text"
            className="field-control"
            placeholder="Nota para decisão em lote..."
            value={batchNote}
            onChange={(e) => setBatchNote(e.target.value)}
          />
          <button
            type="button"
            className="btn btn-approve"
            disabled={busy || !pending.length}
            onClick={() => onDecideBatch(pending.map((p) => p.id), 'aprovar', batchNote)}
          >
            <IconCheckShield size={15} />
            <span>Aprovar ({pending.length})</span>
          </button>
          <button
            type="button"
            className="btn btn-danger"
            disabled={busy || !pending.length}
            onClick={() => onDecideBatch(pending.map((p) => p.id), 'rejeitar', batchNote)}
          >
            Rejeitar ({pending.length})
          </button>
        </div>
      </div>

      <div className="surface-card">
        <div className="row-top-flex">
          <div>
            <span className="kicker">FILA SERIAL COM JARVIS</span>
            <h3>Preparar uma proposta por vez</h3>
            <p className="card-excerpt">A fila abre o próximo projeto na sessão já logada a cada 5 minutos, prepara o pacote e deixa a confirmação visível no navegador. O contador de envio só muda quando a plataforma devolver evidência.</p>
          </div>
          <span className={`status-pill ${dispatchAutomation?.enabled ? 'status-ok' : ''}`}>
            {dispatchAutomation?.enabled ? 'Ativa' : 'Pausada'}
          </span>
        </div>
        <div className="action-row">
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy || !dispatchAutomation?.enabled}
            onClick={onRunDispatchNow}
          >
            Preparar próxima agora
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={busy}
            onClick={() => onConfigureDispatchAutomation(!dispatchAutomation?.enabled)}
          >
            {dispatchAutomation?.enabled ? 'Pausar fila' : 'Ativar fila a cada 5 min'}
          </button>
          {dispatchAutomation?.waitingFor && <span className="muted-xs">Aguardando confirmação: {dispatchAutomation.waitingFor}</span>}
          {!dispatchAutomation?.waitingFor && dispatchAutomation?.nextAt && <span className="muted-xs">Próxima checagem: {new Date(dispatchAutomation.nextAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>}
        </div>
      </div>

      <div className="surface-card">
        <div className="row-top-flex">
          <div>
            <span className="kicker">CONFERÊNCIA DE PROPOSTAS</span>
            <h3>Despachos aguardando prova</h3>
            <p className="card-excerpt">A fila mostra o que o agente tentou e o que ainda precisa ser conferido na plataforma. Preparar conferência cria apenas a tarefa local.</p>
          </div>
          <span className="status-pill">{dispatches.length} abertos</span>
        </div>
        <div className="scroll-stack compact-stack">
          {dispatches.map((dispatch) => (
            <div key={dispatch.id} className="list-row">
              <div>
                <strong>{dispatch.id} · {dispatch.approvalId || dispatch.opportunityId || 'proposta'}</strong>
                <div className="card-meta">
                  {dispatch.status === 'falha_agente'
                    ? 'Agente sem resposta'
                    : dispatch.status === 'navegador_acionado'
                      ? 'Navegador acionado · confirmação pendente'
                      : 'Aguardando evidência externa'} · {dispatch.note || 'Sem observação'}
                </div>
              </div>
              {dispatch.approvalId && <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => onPrepareCheck(dispatch.approvalId!)}>Preparar conferência</button>}
            </div>
          ))}
          {!dispatches.length && <div className="muted-xs">Nenhum despacho aberto.</div>}
        </div>
      </div>

      {approvedCandidates.length > 0 && (
        <div className="surface-card">
          <span className="kicker">APROVADAS SEM DESPACHO</span>
          <h3>Conferir antes do envio</h3>
          <div className="scroll-stack compact-stack">
            {approvedCandidates.slice(0, 30).map((item) => {
              const dispatch = dispatchByApproval.get(item.id);
              return (
                <div key={item.id} className="list-row">
                  <div>
                    <strong>{item.title || item.id}</strong>
                    <div className="card-meta">{dispatch ? `Despacho ${dispatch.status}` : 'Ainda sem despacho local'}</div>
                  </div>
                  <div className="action-row">
                    {item.demoUrl && <a className="link-inline" href={item.demoUrl} target="_blank" rel="noopener noreferrer">Demo</a>}
                    {item.opportunityUrl && <a className="link-inline" href={item.opportunityUrl} target="_blank" rel="noopener noreferrer">Anúncio</a>}
                    {!dispatch && <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => onPrepareCheck(item.id)}>Preparar conferência</button>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="scroll-stack">
        {pending.map((item) => (
          <div key={item.id} className="list-row column-row">
            <div className="row-top-flex">
              <div>
                <strong>{item.title || item.id}</strong>
                <div className="card-meta">
                  {item.source || 'sistema'} · {item.actionType || 'ação'} · {item.cost || 'R$ 0'} · {item.createdAt || ''}
                </div>
              </div>
              <div className="action-row">
                <button
                  type="button"
                  className="btn btn-approve btn-sm"
                  disabled={busy}
                  onClick={() => onDecideOne(item.id, 'aprovar', batchNote)}
                >
                  Aprovar
                </button>
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  disabled={busy}
                  onClick={() => onDecideOne(item.id, 'rejeitar', batchNote)}
                >
                  Rejeitar
                </button>
              </div>
            </div>
            {item.description && <div className="card-excerpt">{item.description.slice(0, 480)}</div>}
            {(item.proposalText || item.demoUrl || item.opportunityUrl) && (
              <details className="approval-details">
                <summary>Revisar pacote · {item.amount || 'valor a definir'}</summary>
                <div className="card-excerpt" style={{ whiteSpace: 'pre-wrap', marginTop: 10 }}>
                  {item.proposalText || 'Proposta ainda não registrada.'}
                </div>
                <div className="action-row" style={{ marginTop: 10 }}>
                  {item.demoUrl?.startsWith('https://') && <a className="link-inline" href={item.demoUrl} target="_blank" rel="noopener noreferrer">Abrir demonstração</a>}
                  {item.opportunityUrl?.startsWith('https://') && <a className="link-inline" href={item.opportunityUrl} target="_blank" rel="noopener noreferrer">Abrir anúncio</a>}
                </div>
              </details>
            )}
          </div>
        ))}
        {!pending.length && (
          <div className="surface-card empty-state">Nenhuma aprovação pendente no momento.</div>
        )}
      </div>
    </section>
  );
};
