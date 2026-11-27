// Confere cada envio em sua página individual usando o Chrome de trabalho já aberto.
// Somente leitura: não clica, não envia e não altera finance.json.
import { readFile, writeFile, rename } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const file = join(root, 'data', 'proposal-checks.json');
const port = Number(process.env.MONEYIA_CDP_PORT || 9333);
let running = false;
const readJson = async (path, fallback) => { try { return JSON.parse(await readFile(path, 'utf8')); } catch { return fallback; } };
const interestText = 'Página individual mostra Não estou mais interessado.';

function recordedInterest() {
  return {
    status: 'interesse_registrado',
    evidence: `${interestText} Confira o histórico da conta para verificar se uma proposta também foi enviada.`
  };
}

export async function sentProposals() {
  const lists = await Promise.all(['opportunities-brl.json', 'opportunities-usd.json'].map(name => readJson(join(root, 'data', name), [])));
  return lists.flat().filter(o => o.applicationStatus === 'proposta_enviada').map(o => ({ id: o.id, title: o.title, platform: o.platform, url: o.url, sentAt: o.applicationSentAt || null }));
}
export async function readChecks() {
  const checks = await readJson(file, {});
  for (const [id, check] of Object.entries(checks)) {
    if (check?.status === 'confirmada_na_plataforma' && check.evidence === interestText) {
      checks[id] = { ...check, ...recordedInterest() };
    }
  }
  return checks;
}

async function chromeOpen() {
  try { const r = await fetch(`http://127.0.0.1:${port}/json/version`, { signal: AbortSignal.timeout(2000) }); return r.ok; }
  catch { return false; }
}

function readPage(url) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [join(root, 'tools', 'browser.mjs'), 'text', url], { cwd: root, windowsHide: true });
    let out = '', err = '';
    const timer = setTimeout(() => { child.kill(); reject(new Error('tempo esgotado')); }, 25000);
    child.stdout.on('data', b => { out += b.toString(); if (out.length > 250000) child.kill(); });
    child.stderr.on('data', b => { err += b.toString(); });
    child.on('error', e => { clearTimeout(timer); reject(e); });
    child.on('close', code => { clearTimeout(timer); code === 0 ? resolve(out) : reject(new Error(err.slice(0, 250) || `Chrome saiu com código ${code}`)); });
  });
}

export function classifyPage(proposal, text) {
  const page = String(text || '').toLowerCase();
  if (/cloudflare|verificação de segurança|captcha|access denied|acesso negado/.test(page)) return { status: 'bloqueada', evidence: 'Página exige verificação de segurança.' };
  if (/conecte-se|faça login|entrar na conta|iniciar sessão/.test(page.slice(0, 1200)) && !/melhorar proposta|cancelar proposta|não estou mais interessado/.test(page)) return { status: 'sem_sessao', evidence: 'Página pede login.' };
  if (/99freelas/i.test(proposal.platform) && /melhorar proposta/.test(page) && /cancelar proposta/.test(page)) return { status: 'confirmada_na_plataforma', evidence: 'Página individual mostra Melhorar proposta e Cancelar proposta.' };
  if (/freelancer\.com\.br|prolinker/i.test(proposal.platform) && /não estou mais interessado/.test(page)) return recordedInterest();
  // Workana exige sinal inequívoco da conta; texto genérico de anúncio não basta.
  if (/workana/i.test(proposal.platform) && /sua proposta foi enviada|proposta enviada com sucesso/.test(page)) return { status: 'confirmada_na_plataforma', evidence: 'Página individual mostra confirmação de envio.' };
  return { status: 'inconclusiva', evidence: 'Nenhum sinal inequívoco de envio na página individual.' };
}

export async function verifyProposals(ids = null) {
  if (running) return { busy: true, checks: await readChecks() };
  running = true;
  try {
    const proposals = (await sentProposals()).filter(p => !ids || ids.includes(p.id));
    const checks = await readChecks();
    if (!(await chromeOpen())) {
      for (const p of proposals) checks[p.id] = { status: 'sem_sessao', evidence: 'Chrome de trabalho não está aberto na porta de depuração.', checkedAt: new Date().toISOString(), source: p.url };
    } else {
      for (const p of proposals) {
        try { checks[p.id] = { ...classifyPage(p, await readPage(p.url)), checkedAt: new Date().toISOString(), source: p.url }; }
        catch (e) { checks[p.id] = { status: 'erro', evidence: String(e.message).slice(0, 200), checkedAt: new Date().toISOString(), source: p.url }; }
      }
    }
    const tmp = `${file}.${process.pid}.tmp`;
    await writeFile(tmp, JSON.stringify(checks, null, 2) + '\n');
    await rename(tmp, file);
    return { busy: false, checks };
  } finally { running = false; }
}
