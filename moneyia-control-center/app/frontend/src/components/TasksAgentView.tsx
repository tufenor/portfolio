import React, { useState } from 'react';
import type { AgentQuestionItem, TaskItem } from '../types/moneyia';
import { IconListFlow } from './Icons';

interface TasksAgentViewProps {
  tasks: TaskItem[];
  questions: AgentQuestionItem[];
  onCreateTask: (title: string, priority: string) => void;
  onToggleTask: (id: string, nextStatus: string) => void;
  onAnswerQuestion: (id: string, answer: string) => void;
  busy: boolean;
}

export const TasksAgentView: React.FC<TasksAgentViewProps> = ({
  tasks,
  questions,
  onCreateTask,
  onToggleTask,
  onAnswerQuestion,
  busy
}) => {
  const [filter, setFilter] = useState<'todas' | 'aberta' | 'concluida'>('todas');
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState('media');
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const filteredTasks = tasks.filter((t) => {
    if (filter === 'aberta') return t.status !== 'concluida';
    if (filter === 'concluida') return t.status === 'concluida';
    return true;
  });

  const pendingQuestions = questions.filter((q) => q.status === 'pendente');

  const submitTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onCreateTask(title.trim(), priority);
    setTitle('');
  };

  return (
    <section className="view-stack">
      <div className="section-banner">
        <div>
          <span className="kicker">EXECUÇÃO E INTERAÇÃO COM AGENTES</span>
          <h2>Tarefas & perguntas pendentes</h2>
          <p>Crie tarefas operacionais, altere o status e responda solicitações dos agentes.</p>
        </div>
        <select
          className="field-control"
          value={filter}
          onChange={(e) => setFilter(e.target.value as 'todas' | 'aberta' | 'concluida')}
        >
          <option value="todas">Todas as tarefas</option>
          <option value="aberta">Abertas</option>
          <option value="concluida">Concluídas</option>
        </select>
      </div>

      <div className="two-col-grid">
        <div className="surface-card">
          <div className="card-header">
            <h3>Fila de Tarefas</h3>
            <span className="muted-xs">{filteredTasks.length} itens</span>
          </div>
          <form className="inline-reply" onSubmit={submitTask}>
            <input
              type="text"
              className="field-control grow"
              placeholder="Nova tarefa..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
            <select
              className="field-control"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
            >
              <option value="alta">Alta</option>
              <option value="media">Média</option>
              <option value="baixa">Baixa</option>
            </select>
            <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>
              <IconListFlow size={14} />
              <span>Criar</span>
            </button>
          </form>

          <div className="scroll-stack">
            {filteredTasks.slice(0, 18).map((t) => {
              const done = t.status === 'concluida';
              return (
                <div key={t.id} className="list-row">
                  <div className="list-row-main">
                    <strong>[{t.priority || 'media'}] {t.title || t.id}</strong>
                    <div className="card-meta">Status: {t.status} · Origem: {t.source || 'sistema'}</div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={busy}
                    onClick={() => onToggleTask(t.id, done ? 'aberta' : 'concluida')}
                  >
                    {done ? 'Reabrir' : 'Concluir'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="surface-card">
          <div className="card-header">
            <h3>Perguntas dos Agentes</h3>
            <span className="muted-xs">{pendingQuestions.length} pendentes</span>
          </div>
          <div className="scroll-stack">
            {pendingQuestions.map((q) => {
              const val = answers[q.id] || '';
              return (
                <div key={q.id} className="list-row column-row">
                  <strong>{q.title || q.prompt || q.id}</strong>
                  <div className="card-meta">Agente: {q.agent || 'agente'} · Tipo: {q.type || 'text'}</div>
                  <div className="inline-reply">
                    <input
                      type="text"
                      className="field-control grow"
                      placeholder="Responder ao agente..."
                      value={val}
                      onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                    />
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      disabled={busy || !val.trim()}
                      onClick={() => {
                        onAnswerQuestion(q.id, val.trim());
                        setAnswers((prev) => ({ ...prev, [q.id]: '' }));
                      }}
                    >
                      Responder
                    </button>
                  </div>
                </div>
              );
            })}
            {!pendingQuestions.length && (
              <div className="empty-state">Nenhuma pergunta pendente dos agentes.</div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};