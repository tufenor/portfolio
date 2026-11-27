import React from 'react';
import type { EngineCapabilities } from '../types/moneyia';
import { IconTerminal } from './Icons';

interface McpConsoleViewProps {
  engines?: EngineCapabilities;
  onRunMcp: (action: string) => void;
  onRunEngine: (engine: string) => void;
  busy: boolean;
}

const MCP_ACTIONS = [
  'panorama',
  'healthcheck',
  'brief',
  'links',
  'respostas',
  'cadencia',
  'dashboard',
  'inicio'
];

const BACKEND_ENGINES: Array<{ id: string; label: string; desc: string }> = [
  { id: 'radar-scan', label: 'Radar de Oportunidades', desc: 'Varre oportunidades globais e sinais de demanda' },
  { id: 'packets-build', label: 'Pacotes de Oportunidade', desc: 'Monta pacotes estruturados para triagem e proposta' },
  { id: 'verifier-check', label: 'Verificador de Propostas', desc: 'Confere consistência, evidências e restrições de escopo' },
  { id: 'approval-queue', label: 'Fila de Aprovação de Propostas', desc: 'Organiza itens prontos para revisão humana na mesa' },
  { id: 'email-intake', label: 'Leitura / Triagem de E-mails', desc: 'Consolida alertas e retornos registrados' },
  { id: 'bridge-agent', label: 'Ponte de Agentes', desc: 'Verifica conectividade e handoff entre agentes' }
];

export const McpConsoleView: React.FC<McpConsoleViewProps> = ({
  engines,
  onRunMcp,
  onRunEngine,
  busy
}) => {
  return (
    <section className="view-stack">
      <div className="section-banner">
        <div>
          <span className="kicker">MÓDULOS BACKEND PROGRAMADOS & MCP</span>
          <h2>Motores operacionais & comandos MCP / JARVIS</h2>
          <p>Acione os scripts e módulos já programados no backend do moneyIA.</p>
        </div>
      </div>

      <div className="two-col-grid">
        <div className="surface-card">
          <div className="card-header">
            <h3>Módulos do Backend (app/*.mjs & data/)</h3>
            <span className="muted-xs">
              Sessões: {engines?.authSessionsCount ?? 0} · Alertas: {engines?.emailAlertsCount ?? 0}
            </span>
          </div>
          <div className="cards-grid compact-grid">
            {BACKEND_ENGINES.map((eng) => (
              <div key={eng.id} className="list-row column-row">
                <strong>{eng.label}</strong>
                <div className="card-meta">{eng.desc}</div>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={busy}
                  onClick={() => onRunEngine(eng.id)}
                >
                  Executar Módulo
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="surface-card">
          <div className="card-header">
            <h3>Comandos MCP / JARVIS</h3>
            <span className="muted-xs">8 rotinas</span>
          </div>
          <div className="mcp-actions-grid">
            {MCP_ACTIONS.map((act) => (
              <button
                key={act}
                type="button"
                className="btn btn-secondary"
                disabled={busy}
                onClick={() => onRunMcp(act)}
              >
                <IconTerminal size={14} />
                <span>{act}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};