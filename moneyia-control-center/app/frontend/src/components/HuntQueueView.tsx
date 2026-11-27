import React, { useState } from 'react';
import type { CaptureSummary, IaQueueItem, OpportunityItem } from '../types/moneyia';
import { IconExternal, IconRadar } from './Icons';

interface HuntQueueViewProps {
  opportunities: OpportunityItem[];
  totalOpportunities: number;
  capture?: CaptureSummary;
  iaItems: IaQueueItem[];
  onSendOpportunity: (id: string) => void;
  onProcessBatch: (limit: number) => void;
  onStartRadar: () => void;
  onPrepareQueue: (limit: number) => void;
  onOpenApprovals: () => void;
  radarStatus?: string;
  onSaveReturn: (id: string, text: string) => void;
  busy: boolean;
}

export const HuntQueueView: React.FC<HuntQueueViewProps> = ({
  opportunities,
  totalOpportunities,
  capture,
  iaItems,
  onSendOpportunity,
  onProcessBatch,
  onStartRadar,
  onPrepareQueue,
  onOpenApprovals,
  radarStatus,
  onSaveReturn,
  busy
}) => {
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(5);
  const [returnsMap, setReturnsMap] = useState<Record<string, string>>({});
  const packetBatchSize = Math.min(30, Math.max(1, capture?.unpacketed || capture?.eligible || 30));
  const queueLabel = capture?.unpacketed
    ? `Criar ${packetBatchSize} pacote${packetBatchSize === 1 ? '' : 's'} de envio`
    : capture?.packeted
      ? `Conferir ${capture.packeted} pacotes prontos`
      : 'Criar fila de envio';

  const filteredOpps = opportunities.filter((o) => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return `${o.title || ''} ${o.platform || ''} ${o.budget || ''} ${o.status || ''}`.toLowerCase().includes(s);
  });

  return (
    <section className="view-stack">
      <div className="section-banner">
        <div>
          <span className="kicker">PROSPECÇÃO DE RECEITA NA INTERNET</span>
          <h2>Caça de oportunidades & Fila IA</h2>
          <p>Varra as fontes disponíveis, gere pacote com demo e orçamento para cada escopo elegível e acompanhe o despacho sem misturar captação com envio comprovado.</p>
        </div>
        <div className="action-row">
          <input
            type="search"
            className="field-control"
            placeholder="Buscar vaga, moeda ou plataforma..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="field-control"
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
          >
            <option value={3}>Lote 3</option>
            <option value={5}>Lote 5</option>
            <option value={10}>Lote 10</option>
          </select>
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => onProcessBatch(limit)}>
            <IconRadar size={15} />
            <span>Processar Lote</span>
          </button>
          <button type="button" className="btn btn-secondary" disabled={busy} onClick={onStartRadar}>Iniciar varredura</button>
          <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => onPrepareQueue(packetBatchSize)}>{queueLabel}</button>
          <button type="button" className="btn btn-secondary" disabled={busy} onClick={onOpenApprovals}>Abrir propostas</button>
          <a className="btn btn-secondary" href="/dashboard#radar">Radar completo</a>
        </div>
      </div>

      {radarStatus && <p className="muted-xs">Última varredura: {radarStatus}. A fila só inclui pacotes elegíveis para revisão.</p>}

      {capture && (
        <div className="cards-grid compact-grid">
          <article className="surface-card">
            <span className="kicker">BASE RECUPERADA</span>
            <h3 className="card-title">{capture.raw} registros</h3>
            <div className="card-meta">{capture.mapped} oportunidades únicas depois de deduplicar fontes e URLs.</div>
          </article>
          <article className="surface-card">
            <span className="kicker">PACOTES</span>
            <h3 className="card-title">{capture.packeted}/{capture.eligible}</h3>
            <div className="card-meta">Com proposta, valor e demo. {capture.unpacketed} ainda precisam de preparo; {capture.notEligible} exigem revalidação antes de qualquer contato.</div>
          </article>
          <article className="surface-card">
            <span className="kicker">EVIDÊNCIA</span>
            <h3 className="card-title">{capture.confirmedDispatches} enviados confirmados</h3>
            <div className="card-meta">A Mesa só muda esse número após prova na plataforma ou no canal de origem.</div>
          </article>
        </div>
      )}

      <div className="two-col-grid">
        <div className="surface-card">
          <div className="card-header">
            <h3>Oportunidades Mapeadas</h3>
            <span className="muted-xs">{filteredOpps.length} de {totalOpportunities}</span>
          </div>
          <div className="scroll-stack">
            {filteredOpps.map((opp) => (
              <div key={opp.id} className="list-row">
                <div className="list-row-main">
                  <strong>{opp.title || opp.id}</strong>
                  <div className="card-meta">
                    {opp.platform || 'Canal'} · {opp.budget || 'Orçamento N/D'} · {opp.status || 'ativo'}
                  </div>
                  {opp.url && (
                    <a href={opp.url} target="_blank" rel="noopener noreferrer" className="link-inline">
                      <span>{opp.url}</span>
                      <IconExternal size={12} />
                    </a>
                  )}
                </div>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={busy}
                  onClick={() => onSendOpportunity(opp.id)}
                >
                  Enviar p/ IA
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="surface-card">
          <div className="card-header">
            <h3>Fila IA & Retorno</h3>
            <span className="muted-xs">{iaItems.length} itens</span>
          </div>
          <div className="scroll-stack">
            {iaItems
              .slice()
              .reverse()
              .slice(0, 14)
              .map((item) => {
                const replyText = item.retorno || item.response || '';
                const draftVal = returnsMap[item.id] || '';
                return (
                  <div key={item.id} className="list-row column-row">
                    <div>
                      <strong>{item.title || item.opportunityId || item.id}</strong>
                      <div className="card-meta">
                        Status: {item.status} · {item.platform || 'Plataforma'}
                      </div>
                    </div>
                    {replyText && <div className="card-excerpt">{replyText.slice(0, 480)}</div>}
                    <div className="inline-reply">
                      <input
                        type="text"
                        className="field-control grow"
                        placeholder="Colar retorno manual da IA..."
                        value={draftVal}
                        onChange={(e) => setReturnsMap((prev) => ({ ...prev, [item.id]: e.target.value }))}
                      />
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        disabled={busy || !draftVal.trim()}
                        onClick={() => {
                          onSaveReturn(item.id, draftVal.trim());
                          setReturnsMap((prev) => ({ ...prev, [item.id]: '' }));
                        }}
                      >
                        Salvar
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </div>
    </section>
  );
};
