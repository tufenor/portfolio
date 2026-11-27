import React, { useState } from 'react';
import type { CaptureSummary, IaQueueItem, OpportunityItem } from '../types/moneyia';
import { IconExternal, IconSpark } from './Icons';

interface ResultsViewProps {
  iaItems: IaQueueItem[];
  opportunities: OpportunityItem[];
  capture?: CaptureSummary;
  onSendToAi: (id: string) => void;
  onHuntNow: () => void;
  onOpenApprovals: () => void;
  busy: boolean;
}

export const ResultsView: React.FC<ResultsViewProps> = ({
  iaItems,
  opportunities,
  capture,
  onSendToAi,
  onHuntNow,
  onOpenApprovals,
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
          <p>Captação, análise, proposta e envio ficam separados: o volume mostra trabalho processado; somente evidência externa confirma um envio.</p>
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

      {capture && (
        <div className="cards-grid compact-grid">
          <article className="surface-card">
            <span className="kicker">CAPTAÇÃO</span>
            <h3 className="card-title">{capture.processed} processadas</h3>
            <div className="card-meta">{capture.analyzed} análises com retorno + {capture.mapped} oportunidades únicas mapeadas</div>
            <div className="card-excerpt">Base bruta: {capture.raw} registros ({capture.sources.brl} BRL · {capture.sources.usd} USD · {capture.sources.global} globais · {capture.sources.radar} radar).</div>
          </article>
          <article className="surface-card">
            <span className="kicker">PROPOSTAS</span>
            <h3 className="card-title">{capture.packeted} pacotes prontos</h3>
            <div className="card-meta">{capture.eligible} escopos elegíveis · {capture.unpacketed} sem pacote · {capture.notEligible} precisam de revalidação ou não entram no catálogo</div>
            <div className="card-excerpt">Cada pacote reúne uma proposta, valor-âncora e uma demo pública relacionada; a triagem evita mandar orçamento para anúncio fechado ou sem página confirmada.</div>
          </article>
          <article className="surface-card">
            <span className="kicker">DESPACHO</span>
            <h3 className="card-title">{capture.readyForReview} para revisar</h3>
            <div className="card-meta">{capture.approvedForDispatch} aprovados para despacho · {capture.confirmedDispatches} com envio confirmado pela plataforma</div>
            <div className="card-actions">
              <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={onOpenApprovals}>Abrir Mesa de propostas</button>
            </div>
          </article>
        </div>
      )}

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
