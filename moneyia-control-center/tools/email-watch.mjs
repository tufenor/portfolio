// Verificador local de alertas de trabalho no Gmail.
// Usa a sessão já aberta no Chrome de trabalho via tools/gmail-sync.mjs.
// Leitura somente: não envia, arquiva, marca ou responde mensagens.
import { spawn } from 'node:child_process';
import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const once = process.argv.includes('--once');
const intervalArg = process.argv.find((arg) => arg.startsWith('--interval='));
const intervalMs = Math.max(60_000, Number(intervalArg?.split('=')[1] || 1800) * 1000);
const statusFile = join(root, 'data', 'email-watch-status.json');

async function saveStatus(value) {
  await mkdir(dirname(statusFile), { recursive: true });
  await writeFile(statusFile, JSON.stringify({ ...value, updatedAt: new Date().toISOString() }, null, 2) + '\n', 'utf8');
}

function runSync() {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [join(root, 'tools', 'gmail-sync.mjs')], {
      cwd: root, env: process.env, stdio: ['ignore', 'pipe', 'pipe']
    });
    let stdout = '', stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('close', (code) => resolve({ code, stdout: stdout.trim(), stderr: stderr.trim() }));
  });
}

async function tick() {
  const at = new Date().toISOString();
  await saveStatus({ status: 'checking', lastAttemptAt: at, intervalMs, source: 'gmail-cdp-readonly' });
  const result = await runSync();
  if (result.code === 0) {
    await saveStatus({ status: 'ok', lastAttemptAt: at, lastSuccessAt: new Date().toISOString(), lastError: null, intervalMs, source: 'gmail-cdp-readonly', detail: result.stdout || 'sem alteração' });
    console.log(`[${at}] Gmail sincronizado: ${result.stdout || 'sem alteração'}`);
  } else if (result.code === 2) {
    await saveStatus({ status: 'waiting_for_chrome', lastAttemptAt: at, lastError: result.stderr || result.stdout, intervalMs, source: 'gmail-cdp-readonly' });
    console.log(`[${at}] Gmail não está aberto no Chrome de trabalho; próxima tentativa agendada.`);
  } else {
    await saveStatus({ status: 'error', lastAttemptAt: at, lastError: result.stderr || result.stdout, intervalMs, source: 'gmail-cdp-readonly' });
    console.error(`[${at}] falha no sincronizador (${result.code}): ${result.stderr || result.stdout}`);
  }
}

await tick();
if (!once) {
  console.log(`Verificador ativo: nova leitura a cada ${Math.round(intervalMs / 60000)} min. Ctrl+C encerra.`);
  setInterval(tick, intervalMs);
}
