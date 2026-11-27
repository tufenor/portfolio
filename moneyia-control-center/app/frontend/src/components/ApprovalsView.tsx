import React, { useState } from 'react';
import type { ApprovalItem } from '../types/moneyia';
import { IconCheckShield } from './Icons';

interface ApprovalsViewProps {
  approvals: ApprovalItem[];
  onDecideOne: (id: string, decision: 'aprovar' | 'rejeitar', note: string) => void;
  onDecideBatch: (ids: string[], decision: 'aprovar' | 'rejeitar', note: string) => void;
  busy: boolean;
}

export const ApprovalsView: React.FC<ApprovalsViewProps> = ({
  approvals,
  onDecideOne,
  onDecideBatch,
  busy
}) => {
  const [batchNote, setBatchNote] = useState('');
  const pending = approvals.filter((a) => a.status === 'pendente');

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
