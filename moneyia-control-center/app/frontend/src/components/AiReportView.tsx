import React from 'react';
import type { AiTier, IaQueueItem, SubAiAgent } from '../types/moneyia';
import { IconCpu } from './Icons';

interface AiReportViewProps {
  iaItems: IaQueueItem[];
  subAis: SubAiAgent[];
  onRunTier: (tier: AiTier) => void;
  busy: boolean;
}

const CORE_ENGINES: Array<{
  id: string;
  name: string;
  tier: AiTier;
  audience: string;
  role: string;
}> = [
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    tier: 'fast',
    audience: 'Global · USD · CRYPTO · BRL · BOB',
    role: 'Triagem rápida, análise de encaixe, preço-âncora e síntese executiva'
  },
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    tier: 'heavy',
    audience: 'Escopos complexos & arquitetura',
    role: 'Análise profunda de propostas, estrutura técnica e plano de entrega'
  },
  {
    id: 'qwen3.5:4b',
    name: 'Ollama Local (qwen3.5:4b)',
    tier: 'fast',
    audience: 'Fila local contínua',
    role: 'Execução local rápida sem consumo de cota externa'
  },
  {
    id: 'qwen3.8:27b',
    name: 'Ollama Local (qwen3.8:27b)',
    tier: 'heavy',
    audience: 'Análise local densa',
    role: 'Raciocínio local detalhado e revisão de oportunidades'
  }
];

export const AiReportView: React.FC<AiReportViewProps> = ({
  iaItems,
  subAis,
  onRunTier,
  busy
}) => {
  const cards = [
    ...CORE_ENGINES.map((c) => ({
      id: c.id,
      name: c.name,
      tier: c.tier,
      audience: c.audience,
      role: c.role,
      kind: 'IA Núcleo'
    })),
    ...subAis.map((s) => ({
      id: s.id,
      name: s.name,
      tier: s.tier,
      audience: `${s.audience} · ${s.currency} · ${s.channel}`,
      role: s.directive || 'Sub-IA especializada em expansão de alcance e receita',
      kind: 'Sub-IA'
    }))
  ];

  return (
    <section className="view-stack">
      <div className="section-banner">
        <div>
          <span className="kicker">TELEMETRIA POR MODELO E AGENTE</span>
          <h2>Relatório individual de cada IA da mesa</h2>
          <p>Acompanhe o papel, o público atendido, os resultados na fila e acione cada nível conforme a necessidade.</p>
        </div>
        <div className="action-row">
          <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => onRunTier('fast')}>
            <IconCpu size={15} />
            <span>Rodar Tier Fast</span>
          </button>
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => onRunTier('heavy')}>
            <IconCpu size={15} />
            <span>Rodar Tier Heavy</span>
          </button>
        </div>
      </div>

      <div className="cards-grid">
        {cards.map((ai) => {
          const matches = iaItems.filter((i) =>
            `${i.retorno || ''} ${i.response || ''}`.toLowerCase().includes(ai.id.split(':')[0].split('-')[0])
          );
          const sample = matches[matches.length - 1] || iaItems[iaItems.length - 1];
          const sampleText = sample?.retorno || sample?.response || '';
          return (
            <article key={ai.id} className="surface-card">
              <div className="card-header">
                <span className="status-tag status-ok">{ai.kind} · {ai.tier}</span>
                <span className="muted-xs">{matches.length} citados</span>
              </div>
              <h3 className="card-title">{ai.name}</h3>
              <div className="card-meta">Alcance: {ai.audience}</div>
              <p className="card-desc">{ai.role}</p>
              {sampleText && (
                <div className="card-excerpt">
                  <strong>Último retorno na fila ({sample?.title || sample?.id}):</strong>
                  <div>{sampleText.slice(0, 340)}</div>
                </div>
              )}
              <div className="card-actions">
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={busy}
                  onClick={() => onRunTier(ai.tier)}
                >
                  Acionar ({ai.tier})
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
};