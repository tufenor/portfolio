// Vigia local do Gmail via CDP somente leitura. Não envia, marca ou arquiva e-mails.
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = join(root, 'data');
const statusFile = join(dataDir, 'email-watch-status.json');
const exec = promisify(execFile);
const arg = (name, fallback) => {
  const value = process.argv.find((item) => item.startsWith(`${name}=`));
  return value ? value.slice(name.length + 1) : fallback;
};
const intervalMs = Math.max(30_000, Number(arg('--interval', '1800')) * 1000);

async function status(value) {
  let previous = {};
  try { previous = JSON.parse(await readFile(statusFile, 'utf8')); } catch {}
  const next = { ...previous, ...value, intervalMs, source: 'gmail-cdp-readonly', updatedAt: new Date().toISOString() };
  await mkdir(dataDir, { recursive: true });
  const temp = `${statusFile}.${process.pid}.tmp`;
  await writeFile(temp, JSON.stringify(next, null, 2) + '\n', 'utf8');
  await rename(temp, statusFile).catch(async () => writeFile(statusFile, JSON.stringify(next, null, 2) + '\n', 'utf8'));
}

async function refreshAlerts() {
  let messages = [];
  try { messages = JSON.parse(await readFile(join(dataDir, 'inbox-feed.json'), 'utf8')); } catch {}
  const rows = Array.isArray(messages) ? messages : [];
  const keywords = ['accepted', 'approved', 'hired', 'invoice', 'payment', 'payout', 'paid', 'aceita', 'aprovada', 'pagamento', 'recebido', 'fatura'];
  const alerts = rows.map((m) => {
    const text = `${m.subject || ''} ${m.from || ''} ${m.snippet || ''}`.toLowerCase();
    const hits = keywords.filter((keyword) => text.includes(keyword));
    return { id: m.id || String(Date.now()), from: m.from || 'desconhecido', subject: m.subject || '(sem assunto)', receivedAt: m.receivedAt || null, matched: hits.length > 0, keywords: hits };
  });
  await writeFile(join(dataDir, 'email-alerts.json'), JSON.stringify({ checkedAt: new Date().toISOString(), total: rows.length, alerts }, null, 2), 'utf8');
}

async function once() {
  await status({ status: 'checking', lastAttemptAt: new Date().toISOString(), lastError: null });
  try {
    const result = await exec(process.execPath, [join(root, 'tools', 'gmail-sync.mjs')], { cwd: root, timeout: 45_000 });
    await refreshAlerts();
    await status({ status: 'ok', lastSuccessAt: new Date().toISOString(), lastResult: String(result.stdout || '').slice(0, 500), lastError: null });
  } catch (error) {
    const message = String(error.stderr || error.message || `falha na leitura (código ${error.code || 'desconhecido'})`).trim().slice(0, 500);
    const waiting = error.code === 2 || error.killed || /nenhuma linha|Gmail não está aberto|CDP|Chrome de trabalho|timed out/i.test(message);
    await status({ status: waiting ? 'waiting_for_gmail_rows' : 'error', lastError: message, lastSuccessAt: null });
  }
}

await once();
if (process.argv.includes('--once')) process.exit(0);
setInterval(once, intervalMs);
