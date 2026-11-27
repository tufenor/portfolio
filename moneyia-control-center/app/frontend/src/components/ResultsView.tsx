import React, { useState } from 'react';
import type { IaQueueItem, OpportunityItem } from '../types/moneyia';
import { IconExternal, IconSpark } from './Icons';

interface ResultsViewProps {
  iaItems: IaQueueItem[];
  opportunities: OpportunityItem[];
  onSendToAi: (id: string) => void;
  onHuntNow: () => void;
  busy: boolean;
}

export const ResultsView: React.FC<ResultsViewProps> = ({
  iaItems,
  opportunities,
  onSendToAi,
  onHuntNow,
  busy
}) => {
  const [query, setQuery] = useState('');

  const consolidated = iaItems
      .slice()
      .reverse()
      .filter((item) => item.retorno || item.response)
      .map((item) => ({
        key: `ia-${item.opportunityId || item.id}`,
        badge: 'Análise IA',
        title: item.title || item.opportunityId || item.id,
        meta: `${item.platform || 'Canal'} · ${item.budget || 'Orçamento a confirmar'} · ${item.status}`,
        body: item.retorno || item.response || '',
        url: item.url,
        oppId: item.opportunityId
      }));
  const unique = consolidated.filter((row, index, all) => all.findIndex((candidate) => candidate.oppId === row.oppId) === index);
  const visible = unique.filter((row) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return `${row.badge} ${row.title} ${row.meta} ${row.body}`.toLowerCase().includes(q);
  });

  return (
    <section className="view-stack">
      <div className="section-banner">
        <div>
          <span className="kicker">ENTREGA CONSOLIDADA AO TITULAR</span>
          <h2>Resultados & oportunidades qualificadas</h2>
          <p>Os agentes prospectam e processam; aqui ficam apenas os resultados consolidados para decisão.</p>
        </div>
        <div className="action-row">
          <input
            type="search"
            className="field-control"
            placeholder="Filtrar resultado, moeda ou canal..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button type="button" className="btn btn-primary" disabled={busy} onClick={onHuntNow}>
            <IconSpark size={15} />
            <span>Analisar 3 oportunidades</span>
          </button>
        </div>
      </div>

      <div className="cards-grid">
        {visible.slice(0, 18).map((row) => (
          <article key={row.key} className="surface-card">
            <div className="card-header">
              <span className="status-tag status-ok">{row.badge}</span>
              {row.url && (
                <a href={row.url} target="_blank" rel="noopener noreferrer" className="link-inline">
                  <span>Origem</span>
                  <IconExternal size={13} />
                </a>
              )}
            </div>
            <h3 className="card-title">{row.title}</h3>
            <div className="card-meta">{row.meta}</div>
            {row.body && <div className="card-excerpt">{row.body.slice(0, 520)}</div>}
            {row.oppId && (
              <div className="card-actions">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={busy}
                  onClick={() => onSendToAi(row.oppId!)}
                >
                  Enviar para IA
                </button>
              </div>
            )}
          </article>
        ))}
        {!consolidated.length && (
          <div className="surface-card empty-state">Nenhum resultado encontrado para o filtro atual.</div>
        )}
      </div>
    </section>
  );
};
