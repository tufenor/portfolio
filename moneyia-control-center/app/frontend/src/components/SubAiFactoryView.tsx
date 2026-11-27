import React, { useState } from 'react';
import type { AiTier, SubAiAgent } from '../types/moneyia';
import { IconNetwork } from './Icons';

interface SubAiFactoryViewProps {
  subAis: SubAiAgent[];
  onCreateSubAi: (data: Omit<SubAiAgent, 'id' | 'createdAt' | 'runsCount'>) => void;
  onDeleteSubAi: (id: string) => void;
  onTriggerSubAi: (subAi: SubAiAgent) => void;
  busy: boolean;
}

export const SubAiFactoryView: React.FC<SubAiFactoryViewProps> = ({
  subAis,
  onCreateSubAi,
  onDeleteSubAi,
  onTriggerSubAi,
  busy
}) => {
  const [name, setName] = useState('');
  const [audience, setAudience] = useState('');
  const [channel, setChannel] = useState('');
  const [currency, setCurrency] = useState<SubAiAgent['currency']>('USD');
  const [tier, setTier] = useState<AiTier>('fast');
  const [directive, setDirective] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !audience.trim() || !channel.trim()) return;
    onCreateSubAi({
      name: name.trim(),
      audience: audience.trim(),
      channel: channel.trim(),
      currency,
      tier,
      directive:
        directive.trim() ||
        `Mapear demandas em ${currency} para ${audience.trim()} via ${channel.trim()}, entregando resumo objetivo com encaixe, preço-âncora e próximo passo sem prometer renda garantida.`
    });
    setName('');
    setAudience('');
    setChannel('');
    setDirective('');
  };

  return (
    <section className="view-stack">
      <div className="section-banner">
        <div>
          <span className="kicker">EXPANSÃO DE ALCANCE POR PÚBLICO E CANAL</span>
          <h2>Fábrica de Sub-IAs</h2>
          <p>Quando uma IA precisar de mais alcance em um nicho, moeda ou canal, instancie uma sub-IA dedicada aqui.</p>
        </div>
      </div>

      <form className="surface-card form-panel" onSubmit={handleSubmit}>
        <div className="form-grid-4">
          <label className="form-label">
            <span>Nome da Sub-IA</span>
            <input
              type="text"
              className="field-control"
              placeholder="Ex.: Especialista Freelas USD / Automação"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </label>
          <label className="form-label">
            <span>Público-alvo</span>
            <input
              type="text"
              className="field-control"
              placeholder="Ex.: Agências e founders internacionais"
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              required
            />
          </label>
          <label className="form-label">
            <span>Canal / Frente</span>
            <input
              type="text"
              className="field-control"
              placeholder="Ex.: Freelance Global, Landing Pages, Bots"
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              required
            />
          </label>
          <label className="form-label">
            <span>Moeda & Tier</span>
            <div className="split-inline">
              <select
                className="field-control"
                value={currency}
                onChange={(e) => setCurrency(e.target.value as SubAiAgent['currency'])}
              >
                <option value="USD">USD</option>
                <option value="CRYPTO">CRYPTO</option>
                <option value="BRL">BRL</option>
                <option value="BOB">BOB</option>
                <option value="GLOBAL">GLOBAL</option>
              </select>
              <select
                className="field-control"
                value={tier}
                onChange={(e) => setTier(e.target.value as AiTier)}
              >
                <option value="fast">fast</option>
                <option value="heavy">heavy</option>
              </select>
            </div>
          </label>
        </div>

        <label className="form-label">
          <span>Diretriz de atuação e entrega</span>
          <input
            type="text"
            className="field-control"
            placeholder="Defina como essa sub-IA deve filtrar oportunidades e formatar a entrega consolidada..."
            value={directive}
            onChange={(e) => setDirective(e.target.value)}
          />
        </label>

        <div className="action-row">
          <button type="submit" className="btn btn-primary" disabled={busy}>
            <IconNetwork size={15} />
            <span>Instanciar Sub-IA</span>
          </button>
        </div>
      </form>

      <div className="cards-grid">
        {subAis.map((sub) => (
          <article key={sub.id} className="surface-card">
            <div className="card-header">
              <span className="status-tag status-ok">{sub.currency} · {sub.tier}</span>
              <span className="muted-xs">{sub.runsCount} ciclos</span>
            </div>
            <h3 className="card-title">{sub.name}</h3>
            <div className="card-meta">Público: {sub.audience} · Canal: {sub.channel}</div>
            <p className="card-desc">{sub.directive}</p>
            <div className="card-actions">
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={busy}
                onClick={() => onTriggerSubAi(sub)}
              >
                Disparar Caça
              </button>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                disabled={busy}
                onClick={() => onDeleteSubAi(sub.id)}
              >
                Remover
              </button>
            </div>
          </article>
        ))}
        {!subAis.length && (
          <div className="surface-card empty-state">
            Nenhuma sub-IA instanciada ainda. Crie a primeira acima para ampliar alcance em um público específico.
          </div>
        )}
      </div>
    </section>
  );
};