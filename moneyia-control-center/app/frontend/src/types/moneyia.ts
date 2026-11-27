export type AiTier = 'fast' | 'heavy';

export interface ApprovalItem {
  id: string;
  source?: string;
  title?: string;
  description?: string;
  actionType?: string;
  target?: string;
  cost?: string;
  files?: string[];
  status: string;
  createdAt?: string;
  decidedAt?: string | null;
  decidedBy?: string | null;
  note?: string;
  opportunityUrl?: string;
  proposalText?: string;
  demoUrl?: string;
  amount?: string;
}

export interface ProposalDispatchItem {
  id: string;
  approvalId?: string;
  opportunityId?: string;
  status: string;
  sent?: boolean;
  note?: string;
}

export interface TaskItem {
  id: string;
  title?: string;
  description?: string;
  source?: string;
  assignee?: string;
  priority?: 'alta' | 'media' | 'baixa' | string;
  status: string;
  createdAt?: string;
  updatedAt?: string;
  due?: string | null;
}

export interface IaQueueItem {
  id: string;
  opportunityId?: string;
  title?: string;
  platform?: string;
  url?: string;
  priority?: string;
  budget?: string;
  prompt?: string;
  status: string;
  webhookStatus?: string | null;
  retorno?: string | null;
  response?: string | null;
  createdAt?: string;
  respondedAt?: string | null;
}

export interface AgentQuestionItem {
  id: string;
  agent?: string;
  title?: string;
  prompt?: string;
  question?: string;
  type?: string;
  field?: string;
  options?: string[];
  required?: boolean;
  sensitive?: boolean;
  status: string;
  createdAt?: string;
}

export interface OpportunityItem {
  id: string;
  title?: string;
  platform?: string;
  priority?: string;
  status?: string;
  url?: string;
  checked?: string;
  budget?: string;
  currency?: string;
  locale?: string;
  verification?: string;
}

export interface FinanceSummary {
  confirmedReceived?: {
    BRL?: number;
    BOB?: number;
    USD?: number;
    [k: string]: number | undefined;
  };
  [k: string]: unknown;
}

export interface EmailSummary {
  scannedAt?: string | null;
  total?: number;
  feedCount?: number;
  counts?: Record<string, number>;
  watch?: { status?: string; lastSuccessAt?: string | null; lastError?: string | null };
}

export interface EngineCapabilities {
  radar?: boolean;
  bridgeAgent?: boolean;
  opportunityPackets?: boolean;
  proposalVerifier?: boolean;
  proposalApprovalQueue?: boolean;
  emailIntake?: boolean;
  aiCascade?: boolean;
  authSessionsCount?: number;
  radarOpportunitiesCount?: number;
  emailAlertsCount?: number;
}

export interface MesaState {
  now: string;
  summary?: {
    aprovacoesPendentes?: number;
    aprovacoesAprovadas?: number;
    aprovacoesRejeitadas?: number;
    tarefasPendentes?: number;
    tarefasEmAndamento?: number;
    tarefasConcluidas?: number;
  };
  approvals: ApprovalItem[];
  proposalDispatch?: ProposalDispatchItem[];
  tasks: TaskItem[];
  ia: IaQueueItem[];
  agentQuestions: AgentQuestionItem[];
  agentWebhook?: boolean;
  aiWebhook?: boolean;
  currencies?: string[];
  engines?: EngineCapabilities;
  opportunities: {
    brl?: number;
    usd?: number;
    global?: number;
    total?: number;
    recent: OpportunityItem[];
  };
  pendencias?: Array<{ id?: string; title?: string; status?: string; detail?: string }>;
  finance?: FinanceSummary;
  email?: EmailSummary;
  radar?: { runs?: Array<{ id: string; status: string; normalizedCount?: number; updatedAt?: string }>;
    gates?: Array<{ id: string; platform?: string; url?: string; status: string; type?: string }> };
  commercial?: { historicalSent: number; confirmedDispatches: number; contracts: number; received: { BRL: number; BOB: number; USD: number }; queue: Array<{ id: string; title: string; stage: string; nextAction: string; amount?: string; url?: string; demoUrl?: string }> };
  templates?: Array<{ id: string; name: string; description: string; exampleUrl: string; sourceUrl: string; editable: string[]; whenToUse: string }>;
}

export interface SubAiAgent {
  id: string;
  name: string;
  audience: string;
  channel: string;
  currency: 'USD' | 'CRYPTO' | 'BRL' | 'BOB' | 'GLOBAL';
  tier: AiTier;
  directive: string;
  createdAt: string;
  runsCount: number;
  lastProvider?: string;
}

export type NavSection =
  | 'results'
  | 'agents'
  | 'subais'
  | 'hunt'
  | 'approvals'
  | 'tasks'
  | 'engines';
