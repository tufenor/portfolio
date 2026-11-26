// Painel local de aprovações e tarefas do moneyIA + melhorias complementares
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  readApprovals, readTasks, readIa, createApproval, decideApproval,
  createTask, updateTask, createIaItem, setIaResponse, setIaDelivery,
  summarize, readAgentQuestions, createAgentQuestion, answerAgentQuestion,
  readEmailInbox, writeEmailInbox, readEmailWatchStatus, readInboxFeed, writeInboxFeed,
  readProposalDispatch, updateProposalDispatch
} from './store.mjs';
import { runAiCascade } from './ai-router.mjs';
import { analyzeEmails } from './email-intake.mjs';

const run = promisify(execFile);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = join(root, 'app', 'public');
const port = Number(process.env.MONEYIA_APP_PORT || 8899);
const host = process.env.MONEYIA_APP_HOST || '127.0.0.1';
const appUser = process.env.MONEYIA_APP_USER || '';
const appPass = process.env.MONEYIA_APP_PASSWORD || '';
const authEnabled = Boolean(appUser && appPass);

function isLoopback(addr = '') {
  return addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1';
}

function authorized(req) {
  if (!authEnabled) return isLoopback(req.socket.remoteAddress);
  const header = req.headers.authorization || '';
  if (!header.startsWith('Basic ')) return false;
  const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
  const idx = decoded.indexOf(':');
  if (idx < 0) return false;
  return decoded.slice(0, idx) === appUser && decoded.slice(idx + 1) === appPass;
}

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

const MCP_ACTIONS = {
  panorama: ['tools/panorama.mjs', []],
  healthcheck: ['tools/healthcheck.mjs', []],
  brief: ['tools/daily-brief.mjs', []],
  links: ['tools/links.mjs', []],
  respostas: ['tools/wa-watch.mjs', ['--json']],
  cadencia: ['tools/cadence.mjs', ['--dry', '--json']],
  dashboard: ['tools/build-dashboard.mjs', []],
  inicio: ['tools/chat-report.mjs', []]
};

function sendJson(res, code, value) {
  const body = JSON.stringify(value);
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > 1_500_000) {
        reject(new Error('body grande demais'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new Error('JSON inválido'));
      }
    });
    req.on('error', reject);
  });
}

const readJson = async (name, fallback) => {
  try {
    const raw = (await readFile(join(root, 'data', name), 'utf8')).replace(/^\uFEFF/, '');
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
};

async function allOpportunities() {
  const [brl, usd, globalOps] = await Promise.all([
    readJson('opportunities-brl.json', []),
    readJson('opportunities-usd.json', []),
    readJson('opportunities-global.json', [])
  ]);
  return [
    ...(Array.isArray(brl) ? brl : []),
    ...(Array.isArray(usd) ? usd : []),
    ...(Array.isArray(globalOps) ? globalOps : [])
  ];
}

async function findOpportunity(id) {
  return (await allOpportunities()).find((o) => o.id === id) || null;
}

function feedRowsFromAnalysis(analysis, source = 'gmail-cdp') {
  return (analysis.emails || []).map((row) => ({
    id: row.id,
    source,
    kind: row.kind,
    priority: row.priority,
    from: row.from,
    subject: row.subject,
    snippet: row.snippet,
    displayUrl: row.displayUrl,
    opportunityUrl: row.opportunityUrl,
    emailTs: row.emailTs,
    receivedAt: row.emailTs || new Date().toISOString(),
    status: row.status || 'new',
    reason: row.reason
  }));
}

async function ingestEmails(source, emails) {
  const analysis = analyzeEmails(Array.isArray(emails) ? emails : []);
  const previous = await readInboxFeed();
  const merged = new Map((Array.isArray(previous) ? previous : []).map((row) => [String(row.id), row]));
  for (const row of feedRowsFromAnalysis(analysis, source)) merged.set(String(row.id), row);
  const feed = [...merged.values()]
    .sort((a, b) => String(b.receivedAt || '').localeCompare(String(a.receivedAt || '')))
    .slice(0, 500);
  await writeInboxFeed(feed);
  await writeEmailInbox({ ...analysis, source, feedCount: feed.length });

  const tasks = [];
  const existing = await readTasks();
  for (const row of analysis.emails || []) {
    if (!['acceptance_or_client_reply', 'payment_received', 'account_security'].includes(row.kind)) continue;
    const marker = `email-intake:${row.id}`;
    if (existing.some((task) => String(task.description || '').includes(marker))) continue;
    const title = row.kind === 'payment_received'
      ? `Confirmar possível recebimento — ${row.subject}`
      : row.kind === 'acceptance_or_client_reply'
        ? `Verificar possível aceite/resposta — ${row.subject}`
        : `Revisar alerta de segurança — ${row.subject}`;
    tasks.push(await createTask({
      title: title.slice(0, 160),
      description: `${marker}\nFonte: ${row.source}\n${row.reason}\n${row.displayUrl || ''}`.slice(0, 2000),
      source: 'email-intake', assignee: 'titular', priority: row.priority
    }));
  }
  return { analysis, feedCount: feed.length, createdTasks: tasks.map((task) => task.id) };
}

function iaPrompt(o) {
  return [
    'Projeto moneyIA — analisar oportunidade.',
    '',
    `Título: ${o.title}`,
    `Plataforma: ${o.platform}`,
    `URL: ${o.url}`,
    `Orçamento: ${o.budget || 'desconhecido'}`,
    `Prioridade: ${o.priority || 'não definida'}`,
    `Estado verificado: ${o.status || 'não registrado'}`,
    `Verificação: ${o.verification || 'não registrada'}`,
    '',
    'Responda em português, curto e direto:',
    '1. Encaixe real no que o moneyIA consegue entregar.',
    '2. Riscos e o que não pode ser prometido.',
    '3. Preço-âncora e prazo condicionado a insumos.',
    '4. Próximo passo seguro (incluindo se vale ou não proposta).',
    '5. Se falta prova pública, diga qual e não invente experiência.',
    '',
    'Regras: sem promessa de renda, sem posição no Google, sem criar conta/KYC, sem disparo automático de WhatsApp.'
  ].join('\n');
}

async function sendToAiWebhook(item) {
  const url = process.env.MONEYIA_AI_WEBHOOK_URL;
  if (!url) return { status: 'pronta_para_colar', webhookStatus: null };
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(process.env.MONEYIA_AI_WEBHOOK_TOKEN ? { authorization: `Bearer ${process.env.MONEYIA_AI_WEBHOOK_TOKEN}` } : {})
      },
      body: JSON.stringify({ type: 'oportunidade_moneyia', item })
    });
    return { status: res.ok ? 'enviada' : 'falha_webhook', webhookStatus: res.status };
  } catch (error) {
    return { status: 'falha_webhook', webhookStatus: error.message };
  }
}

async function sendAgentAnswerWebhook(question, answer) {
  const url = process.env.MONEYIA_AGENT_WEBHOOK_URL;
  if (!url) return { status: 'local', webhookStatus: null };
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(process.env.MONEYIA_AGENT_WEBHOOK_TOKEN ? { authorization: `Bearer ${process.env.MONEYIA_AGENT_WEBHOOK_TOKEN}` } : {})
      },
      body: JSON.stringify({
        type: 'moneyia_titular_answer',
        question: { id: question.id, agent: question.agent, title: question.title, field: question.field, type: question.type },
        answer
      })
    });
    return { status: res.ok ? 'webhook' : 'falha_webhook', webhookStatus: res.status };
  } catch (error) {
    return { status: 'falha_webhook', webhookStatus: error.message };
  }
}

async function state() {
  const [approvals, tasks, ia, questions, brl, usd, globalOps, finance, pendencias, emailInbox, emailWatch, inboxFeed, proposalDispatch] = await Promise.all([
    readApprovals(),
    readTasks(),
    readIa(),
    readAgentQuestions(),
    readJson('opportunities-brl.json', []),
    readJson('opportunities-usd.json', []),
    readJson('opportunities-global.json', []),
    readJson('finance.json', {}),
    readJson('pendencias.json', []),
    readEmailInbox(), readEmailWatchStatus(), readInboxFeed(), readProposalDispatch()
  ]);

  const bArr = Array.isArray(brl) ? brl : [];
  const uArr = Array.isArray(usd) ? usd : [];
  const gArr = Array.isArray(globalOps) ? globalOps : [];

  return {
    now: new Date().toISOString(),
    summary: summarize(approvals, tasks),
    approvals: approvals.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))),
    tasks: tasks.sort((a, b) => {
      const rank = { alta: 0, media: 1, baixa: 2 };
      return (rank[a.priority] ?? 9) - (rank[b.priority] ?? 9);
    }),
    ia,
    agentQuestions: questions.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))),
    agentWebhook: Boolean(process.env.MONEYIA_AGENT_WEBHOOK_URL),
    aiWebhook: Boolean(process.env.MONEYIA_AI_WEBHOOK_URL),
    currencies: ['USD', 'CRYPTO', 'BRL', 'BOB'],
    opportunities: {
      brl: bArr.length,
      usd: uArr.length,
      global: gArr.length,
      total: bArr.length + uArr.length + gArr.length,
      recent: [...bArr, ...uArr, ...gArr]
        .sort((a, b) => String(b.checked || '').localeCompare(String(a.checked || '')))
        .slice(0, 12)
        .map((o) => ({
          id: o.id,
          title: o.title,
          platform: o.platform,
          priority: o.priority,
          status: o.status,
          url: o.url,
          checked: o.checked,
          budget: o.budget
        }))
    },
    pendencias: (Array.isArray(pendencias) ? pendencias : []).filter((p) => p && p.status === 'pendente'),
    finance: finance && typeof finance === 'object' ? finance : {}
    ,email: {
      scannedAt: emailInbox.scannedAt || null,
      total: Number(emailInbox.total || 0),
      counts: emailInbox.counts || {},
      feedCount: Array.isArray(inboxFeed) ? inboxFeed.length : 0,
      watch: emailWatch
    },
    proposalDispatch: Array.isArray(proposalDispatch) ? proposalDispatch : [],
    bridge: { local: true, externalEvidenceRequired: true }
  };
}

async function serveFile(res, file) {
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': mime[extname(file)] || 'text/plain; charset=utf-8', 'cache-control': 'no-cache' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Não encontrado');
  }
}

async function serveStatic(req, res, pathname) {
  const safe = pathname === '/' ? '/index.html' : pathname;
  if (safe.includes('..')) return sendJson(res, 400, { error: 'caminho inválido' });
  return serveFile(res, join(publicDir, safe));
}

const server = createServer(async (req, res) => {
  if (!authorized(req)) {
    res.writeHead(401, { 'content-type': 'text/plain; charset=utf-8', 'www-authenticate': 'Basic realm="moneyIA", charset="UTF-8"' });
    return res.end('Autenticação necessária.');
  }

  const url = new URL(req.url, `http://127.0.0.1:${port}`);
  const path = url.pathname;

  try {
    if (req.method === 'GET' && path === '/api/health') {
      return sendJson(res, 200, { ok: true, service: 'moneyIA approvals', time: new Date().toISOString() });
    }
    if (req.method === 'GET' && path === '/api/state') {
      return sendJson(res, 200, await state());
    }
    if (req.method === 'GET' && path === '/api/emails') {
      return sendJson(res, 200, await readEmailInbox());
    }
    if (req.method === 'GET' && path === '/api/emails/watch') {
      return sendJson(res, 200, await readEmailWatchStatus());
    }
    if (req.method === 'GET' && path === '/api/inbox-feed') {
      return sendJson(res, 200, await readInboxFeed());
    }
    if (req.method === 'GET' && path === '/api/proposal-dispatch') {
      const rows = await readProposalDispatch();
      const status = url.searchParams.get('status');
      return sendJson(res, 200, status ? rows.filter((row) => row.status === status) : rows);
    }
    const dispatchClaim = path.match(/^\/api\/proposal-dispatch\/([^/]+)\/claim$/);
    if (req.method === 'POST' && dispatchClaim) {
      const body = await readBody(req);
      const rows = await readProposalDispatch();
      const row = rows.find((item) => item.id === decodeURIComponent(dispatchClaim[1]));
      if (!row) return sendJson(res, 404, { error: 'dispatch não encontrado' });
      if (row.status === 'enviada_com_evidencia') return sendJson(res, 409, { error: 'dispatch já possui evidência externa' });
      return sendJson(res, 200, await updateProposalDispatch(row.id, {
        agent: body.agent || 'jarvis', status: 'em_execucao',
        note: 'Agente assumiu a tarefa; envio externo ainda não confirmado.'
      }));
    }
    const dispatchEvidence = path.match(/^\/api\/proposal-dispatch\/([^/]+)\/evidence$/);
    if (req.method === 'POST' && dispatchEvidence) {
      const body = await readBody(req);
      const evidence = String(body.evidence || '').trim();
      if (!evidence) return sendJson(res, 400, { error: 'evidence é obrigatória' });
      const rows = await readProposalDispatch();
      const row = rows.find((item) => item.id === decodeURIComponent(dispatchEvidence[1]));
      if (!row) return sendJson(res, 404, { error: 'dispatch não encontrado' });
      return sendJson(res, 200, await updateProposalDispatch(row.id, {
        status: 'enviada_com_evidencia', sent: true,
        dispatchedAt: new Date().toISOString(), externalEvidence: evidence,
        note: 'Evidência externa registrada pelo agente; revisar na plataforma quando necessário.'
      }));
    }
    if (req.method === 'POST' && path === '/api/emails/ingest') {
      const body = await readBody(req);
      const result = await ingestEmails(String(body.source || 'gmail-cdp').slice(0, 60), body.emails);
      return sendJson(res, 200, { ok: true, ...result });
    }
    if (req.method === 'GET' && path === '/api/agent-questions') {
      const questions = await readAgentQuestions();
      const status = url.searchParams.get('status');
      return sendJson(res, 200, status ? questions.filter((q) => q.status === status) : questions);
    }
    if (req.method === 'GET' && (path === '/dashboard' || path === '/dashboard/')) {
      return serveFile(res, join(root, 'dashboard', 'index.html'));
    }

    if (req.method === 'POST' && path === '/api/aprovacoes/batch') {
      const { ids = [], decision, by = 'titular-batch', note = '' } = await readBody(req);
      if (!['aprovar', 'rejeitar'].includes(decision) || !Array.isArray(ids)) {
        return sendJson(res, 400, { error: 'Envie ids[] e decision (aprovar|rejeitar)' });
      }
      const results = [];
      for (const id of ids) results.push(await decideApproval(id, decision, by, note));
      return sendJson(res, 200, { ok: true, processed: results.length, results });
    }

    if (req.method === 'POST' && path === '/api/oportunidades/processar-fila') {
      const { limit = 3, tier = 'fast' } = await readBody(req);
      const ops = await allOpportunities();
      const queuedIds = new Set((await readIa()).map((i) => i.opportunityId));
      const pending = ops.filter((o) => !queuedIds.has(o.id)).slice(0, Number(limit) || 3);
      const processed = [];
      for (const op of pending) {
        const prompt = iaPrompt(op);
        const aiRes = await runAiCascade(prompt, { tier });
        const item = await createIaItem({
          opportunityId: op.id,
          title: op.title,
          platform: op.platform,
          url: op.url,
          priority: op.priority || 'media',
          budget: op.budget,
          prompt,
          status: aiRes.ok ? 'respondida' : 'falha_ia'
        });
        if (aiRes.ok) {
          await setIaResponse(item.id, `[${aiRes.provider}]\n${aiRes.text}`);
        }
        processed.push({ id: op.id, provider: aiRes.provider, ok: aiRes.ok, errors: aiRes.errors || [] });
      }
      return sendJson(res, 200, { ok: true, processed });
    }

    if (req.method === 'POST' && path === '/api/mcp/exec') {
      const { action } = await readBody(req);
      if (!MCP_ACTIONS[action]) {
        return sendJson(res, 404, { error: 'Ação desconhecida', disponiveis: Object.keys(MCP_ACTIONS) });
      }
      const [script, args] = MCP_ACTIONS[action];
      const { stdout, stderr } = await run(process.execPath, [join(root, script), ...args], { cwd: root, timeout: 180000 });
      return sendJson(res, 200, { ok: true, action, output: String(stdout || stderr || 'Concluído.').slice(0, 6000) });
    }

    if (req.method === 'POST' && path === '/api/autoridade/sync') {
      const { githubUser = process.env.GITHUB_USERNAME } = await readBody(req);
      if (!githubUser) return sendJson(res, 400, { error: 'Defina GITHUB_USERNAME ou envie githubUser' });
      const ghRes = await fetch(`https://api.github.com/users/${githubUser}/repos?sort=updated&per_page=10`);
      const repos = ghRes.ok ? await ghRes.json() : [];
      const arr = Array.isArray(repos) ? repos : [];
      const summary = arr.map((r) => `${r.name} (${r.language || 'Web'}): ${r.description || 'Projeto ativo'} - ${r.html_url}`).join('\n');
      const aiRes = await runAiCascade(`Com base nestes repositórios:\n${summary}\nCrie uma bio objetiva (PT, EN, ES) para portfólio e perfis freelance.`, { tier: 'fast' });
      await writeFile(join(root, 'data', 'authority-profile.json'), JSON.stringify({ updatedAt: new Date().toISOString(), githubUser, reposCount: arr.length, bio: aiRes.text }, null, 2));
      return sendJson(res, 200, { ok: aiRes.ok, provider: aiRes.provider, reposCount: arr.length, bio: aiRes.text, errors: aiRes.errors || [] });
    }

    if (req.method === 'POST' && path === '/api/self-improve') {
      const st = await state();
      const aiRes = await runAiCascade(`Estado atual: ${st.opportunities.total} oportunidades, ${st.approvals.length} aprovações, ${st.tasks.length} tarefas. Sugira 3 melhorias práticas e seguras.`, { tier: 'fast' });
      const task = await createTask({
        title: `Melhoria moneyIA (${new Date().toLocaleDateString('pt-BR')})`,
        description: `[${aiRes.provider}]\n${aiRes.text || (aiRes.errors || []).join('; ')}`.slice(0, 2000),
        source: 'self-improve',
        priority: 'alta'
      });
      return sendJson(res, 200, { ok: aiRes.ok, provider: aiRes.provider, task, errors: aiRes.errors || [] });
    }

    if (req.method === 'POST' && path === '/api/aprovacoes') {
      const body = await readBody(req);
      if (!body.title) return sendJson(res, 400, { error: 'title é obrigatório' });
      const row = await createApproval(body);
      return sendJson(res, 201, row);
    }

    if (req.method === 'POST' && path === '/api/agent-questions') {
      const body = await readBody(req);
      if (!String(body.title || body.prompt || body.question || '').trim()) {
        return sendJson(res, 400, { error: 'title ou prompt é obrigatório' });
      }
      const row = await createAgentQuestion(body);
      return sendJson(res, 201, row);
    }

    const answerQuestion = path.match(/^\/api\/agent-questions\/([^/]+)\/answer$/);
    if (req.method === 'POST' && answerQuestion) {
      const body = await readBody(req);
      const questions = await readAgentQuestions();
      const question = questions.find((q) => q.id === decodeURIComponent(answerQuestion[1]));
      if (!question) return sendJson(res, 404, { error: 'pergunta do agente não encontrada' });
      if (question.sensitive && !process.env.MONEYIA_AGENT_WEBHOOK_URL) {
        return sendJson(res, 409, { error: 'resposta sensível exige MONEYIA_AGENT_WEBHOOK_URL; nada foi armazenado' });
      }
      const delivery = await sendAgentAnswerWebhook(question, body.answer);
      if (delivery.status === 'falha_webhook') {
        return sendJson(res, 502, { error: 'não foi possível encaminhar ao agente', detail: delivery.webhookStatus });
      }
      const row = await answerAgentQuestion(question.id, body.answer, body.by || 'titular', delivery.status);
      return sendJson(res, 200, { question: row, delivery: delivery.status });
    }

    const sendIa = path.match(/^\/api\/oportunidades\/([^/]+)\/enviar-ia$/);
    if (req.method === 'POST' && sendIa) {
      const opportunity = await findOpportunity(decodeURIComponent(sendIa[1]));
      if (!opportunity) return sendJson(res, 404, { error: 'oportunidade não encontrada' });
      const existing = (await readIa()).find((r) => r.opportunityId === opportunity.id && r.status !== 'respondida');
      if (existing) return sendJson(res, 200, { item: existing, delivery: 'already_queued' });

      const prompt = iaPrompt(opportunity);
      let item = await createIaItem({
        opportunityId: opportunity.id,
        title: opportunity.title,
        platform: opportunity.platform,
        url: opportunity.url,
        priority: opportunity.priority,
        budget: opportunity.budget,
        prompt,
        status: 'pronta_para_colar'
      });
      const delivery = await sendToAiWebhook(item);
      if (delivery.status !== 'pronta_para_colar') item = await setIaDelivery(item.id, delivery.status, delivery.webhookStatus);
      return sendJson(res, 201, { item, delivery: delivery.status === 'pronta_para_colar' ? 'manual' : 'webhook' });
    }

    const iaReturn = path.match(/^\/api\/ia\/([^/]+)\/retorno$/);
    if (req.method === 'POST' && iaReturn) {
      const body = await readBody(req);
      if (!String(body.retorno || '').trim()) return sendJson(res, 400, { error: 'retorno é obrigatório' });
      const row = await setIaResponse(decodeURIComponent(iaReturn[1]), body.retorno);
      const task = await createTask({
        title: `Analisar retorno da IA — ${row.title}`.slice(0, 160),
        description: `Oportunidade: ${row.url}\n\nRetorno da IA:\n${row.retorno}`.slice(0, 2000),
        source: 'chatgpt',
        assignee: 'codex',
        priority: row.priority === 'alta' ? 'alta' : 'media'
      });
      return sendJson(res, 200, { item: row, task });
    }

    const decision = path.match(/^\/api\/aprovacoes\/([^/]+)\/decision$/);
    if (req.method === 'POST' && decision) {
      const body = await readBody(req);
      if (!['aprovar', 'rejeitar'].includes(body.decision)) return sendJson(res, 400, { error: 'decision deve ser aprovar ou rejeitar' });
      const row = await decideApproval(decodeURIComponent(decision[1]), body.decision, body.by || 'titular', body.note || '');
      return sendJson(res, 200, row);
    }

    if (req.method === 'POST' && path === '/api/tarefas') {
      const body = await readBody(req);
      if (!body.title) return sendJson(res, 400, { error: 'title é obrigatório' });
      const row = await createTask(body);
      return sendJson(res, 201, row);
    }

    const task = path.match(/^\/api\/tarefas\/([^/]+)$/);
    if (req.method === 'PATCH' && task) {
      const body = await readBody(req);
      const row = await updateTask(decodeURIComponent(task[1]), body);
      return sendJson(res, 200, row);
    }
    if (req.method === 'POST' && path === '/api/engines/run') {
      const body = await readBody(req);
      const eng = String(body.engine || '');
      const [authSess, radarOps, alerts] = await Promise.all([
        readJson('auth-sessions.json', []),
        readJson('radar-opportunities.json', []),
        readJson('email-alerts.json', {})
      ]);
      const aArr = Array.isArray(authSess) ? authSess : [];
      const rArr = Array.isArray(radarOps) ? radarOps : [];
      return sendJson(res, 200, {
        ok: true,
        engine: eng,
        checkedAt: new Date().toISOString(),
        authSessions: {
          total: aArr.length,
          autenticado: aArr.filter((x) => x && x.status === 'autenticado').length,
          aguardando2faOuLogin: aArr.filter((x) => x && x.status === 'aguardando_2fa_ou_login').length
        },
        radarOpportunitiesCount: rArr.length,
        emailAlerts: alerts
      });
    }


    if (path.startsWith('/api/')) return sendJson(res, 404, { error: 'endpoint não encontrado' });
    return serveStatic(req, res, path);
  } catch (error) {
    return sendJson(res, 500, { error: error.message || 'erro interno' });
  }
});

server.listen(port, host, () => {
  console.log(`moneyIA app em http://${host}:${port}`);
  console.log(`Autenticação: ${authEnabled ? 'Basic Auth ativa' : 'somente loopback'}`);
});
