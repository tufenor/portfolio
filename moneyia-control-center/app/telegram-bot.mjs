// Bot Telegram do moneyIA — aprovações, tarefas e oportunidades.
// Requer TELEGRAM_BOT_TOKEN e TELEGRAM_CHAT_ID no ambiente.
// Uso: node app/telegram-bot.mjs
// Nada é executado além de gravar decisões/tarefas nos JSON locais.
import { readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readApprovals, readTasks, decideApproval, createTask, summarize } from './store.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const token = process.env.TELEGRAM_BOT_TOKEN;
const allowedChat = process.env.TELEGRAM_CHAT_ID ? String(process.env.TELEGRAM_CHAT_ID) : null;
if (!token) {
  console.error('TELEGRAM_BOT_TOKEN ausente. Crie o bot no BotFather e defina a variável.');
  process.exit(2);
}

const API = `https://api.telegram.org/bot${token}`;
let offset = 0;
const seenFile = join(root, 'data', 'telegram-seen.json');
const seenOppsFile = join(root, 'data', 'telegram-seen-opps.json');

async function readJson(file, fallback) {
  try { return JSON.parse(await readFile(file, 'utf8')); } catch { return fallback; }
}
async function saveJson(file, value) {
  await writeFile(file, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

async function call(method, payload = {}) {
  const res = await fetch(`${API}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json().catch(() => ({}));
  if (!data.ok) throw new Error(`${method}: ${data.description || res.status}`);
  return data.result;
}

const send = (chatId, text) => call('sendMessage', { chat_id: chatId, text, disable_web_page_preview: true });

function isAllowed(chatId) {
  return allowedChat && String(chatId) === allowedChat;
}

function helpText() {
  return [
    'moneyIA — comandos',
    '',
    '/status — resumo',
    '/aprovacoes — fila de decisão',
    '/aprovar APR-002 — aprova uma demanda',
    '/rejeitar APR-002 — rejeita',
    '/tarefas — tarefas abertas',
    '/nova Texto da tarefa — cria tarefa',
    '/oportunidades — últimas oportunidades',
    '/id — mostra o chat id',
    '',
    'Aprovar registra a decisão. A execução continua com o agente responsável.'
  ].join('\n');
}

async function cmdStatus(chatId) {
  const [a, t] = await Promise.all([readApprovals(), readTasks()]);
  const s = summarize(a, t);
  await send(chatId, [
    'moneyIA — status',
    `Aprovações pendentes: ${s.aprovacoesPendentes}`,
    `Tarefas abertas: ${s.tarefasPendentes + s.tarefasEmAndamento}`,
    `Aprovadas: ${s.aprovacoesAprovadas} · rejeitadas: ${s.aprovacoesRejeitadas}`
  ].join('\n'));
}

async function cmdApprovals(chatId) {
  const rows = (await readApprovals()).filter((a) => a.status === 'pendente');
  if (!rows.length) return send(chatId, 'Nenhuma aprovação pendente.');
  await send(chatId, rows.map((a) => [
    `${a.id} · ${a.title}`,
    `${a.source} · ${a.actionType} · ${a.cost}`,
    `Alvo: ${a.target}`,
    `Para decidir: /aprovar ${a.id} ou /rejeitar ${a.id}`
  ].join('\n')).join('\n\n'));
}

async function cmdTasks(chatId) {
  const rows = (await readTasks()).filter((t) => ['pendente', 'em_andamento'].includes(t.status));
  if (!rows.length) return send(chatId, 'Nenhuma tarefa aberta.');
  await send(chatId, rows.map((t) => `${t.id} · [${t.status}] ${t.title} · ${t.assignee} · ${t.priority}`).join('\n'));
}

async function cmdOpps(chatId) {
  const read = async (name) => readJson(join(root, 'data', name), []);
  const [brl, usd] = await Promise.all([read('opportunities-brl.json'), read('opportunities-usd.json')]);
  const rows = [...brl, ...usd]
    .sort((a, b) => String(b.checked || '').localeCompare(String(a.checked || '')))
    .slice(0, 5);
  if (!rows.length) return send(chatId, 'Nenhuma oportunidade registrada.');
  await send(chatId, rows.map((o) => `• ${o.title}\n${o.platform} · ${o.priority} · ${o.status || ''}\n${o.url}`).join('\n\n'));
}

async function handle(message) {
  const chatId = message.chat?.id;
  const text = String(message.text || '').trim();
  if (!chatId || !text) return;
  if (!isAllowed(chatId)) {
    if (text === '/start' || text === '/id') {
      await send(chatId, `Chat ID: ${chatId}\nDefina TELEGRAM_CHAT_ID com este valor para autorizar decisões.`);
    }
    return;
  }
  if (text === '/start' || text === '/ajuda' || text === '/help') return send(chatId, helpText());
  if (text === '/id') return send(chatId, `Chat ID: ${chatId}`);
  if (text === '/status') return cmdStatus(chatId);
  if (text === '/aprovacoes') return cmdApprovals(chatId);
  if (text === '/tarefas') return cmdTasks(chatId);
  if (text === '/oportunidades') return cmdOpps(chatId);

  const decision = text.match(/^\/(aprovar|rejeitar)\s+(APR-\d{3})$/i);
  if (decision) {
    try {
      const row = await decideApproval(decision[2].toUpperCase(), decision[1].toLowerCase(), 'telegram', '');
      await send(chatId, `${row.id} ${row.title}\n→ ${row.status}`);
    } catch (error) {
      await send(chatId, `Não foi possível: ${error.message}`);
    }
    return;
  }

  const task = text.match(/^\/nova\s+(.+)$/is);
  if (task) {
    const row = await createTask({ title: task[1].slice(0, 160), description: 'Criada pelo Telegram.', source: 'telegram', assignee: 'codex', priority: 'media' });
    return send(chatId, `Tarefa criada: ${row.id} · ${row.title}`);
  }

  await send(chatId, 'Comando não reconhecido. Use /ajuda.');
}

async function poll() {
  try {
    const updates = await call('getUpdates', { offset, timeout: 25, allowed_updates: ['message'] });
    for (const update of updates) {
      offset = update.update_id + 1;
      await handle(update.message);
    }
  } catch (error) {
    console.error('poll:', error.message);
    await new Promise((r) => setTimeout(r, 5000));
  } finally {
    setTimeout(poll, 500);
  }
}

let seen = await readJson(seenFile, null);
let seenOpps = await readJson(seenOppsFile, null);

async function notifyLoop() {
  if (!allowedChat) return;
  try {
    const approvals = (await readApprovals()).filter((a) => a.status === 'pendente');
    const ids = new Set(approvals.map((a) => a.id));
    if (seen === null) {
      seen = [...ids];
      await saveJson(seenFile, seen);
    } else {
      const fresh = approvals.filter((a) => !seen.includes(a.id));
      for (const a of fresh) {
        await send(allowedChat, `Nova aprovação: ${a.id}\n${a.title}\n${a.source} · ${a.cost}\n/aprovar ${a.id} ou /rejeitar ${a.id}`);
        seen.push(a.id);
      }
      await saveJson(seenFile, seen);
    }

    const read = async (name) => readJson(join(root, 'data', name), []);
    const [brl, usd] = await Promise.all([read('opportunities-brl.json'), read('opportunities-usd.json')]);
    const opps = [...brl, ...usd];
    const oppIds = new Set(opps.map((o) => o.id));
    if (seenOpps === null) {
      seenOpps = [...oppIds];
      await saveJson(seenOppsFile, seenOpps);
    } else {
      const fresh = opps.filter((o) => !seenOpps.includes(o.id));
      for (const o of fresh) {
        await send(allowedChat, `Nova oportunidade: ${o.title}\n${o.platform} · ${o.priority}\n${o.url}`);
        seenOpps.push(o.id);
      }
      await saveJson(seenOppsFile, seenOpps);
    }
  } catch (error) {
    console.error('notify:', error.message);
  }
}

console.log(`Telegram bot iniciado. Chat autorizado: ${allowedChat || 'não definido (somente /start e /id)'}`);
if (!allowedChat) console.log('Defina TELEGRAM_CHAT_ID para habilitar decisões e notificações.');
poll();
setInterval(notifyLoop, 30000);
notifyLoop();
