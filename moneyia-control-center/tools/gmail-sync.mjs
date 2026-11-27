// Sincroniza alertas do Gmail aberto no Chrome de trabalho via CDP 9333.
// Leitura somente: não envia, arquiva nem marca mensagens.
const base = process.env.MONEYIA_APP_URL || 'http://127.0.0.1:8899';
const cdpCandidates = [...new Set([
  process.env.MONEYIA_CDP_URL,
  'http://127.0.0.1:9333',
  'http://127.0.0.1:9222'
].filter(Boolean))];

let tabs;
let cdp = null;
const errors = [];
for (const candidate of cdpCandidates) {
  try {
    const response = await fetch(`${candidate}/json/list`, { signal: AbortSignal.timeout(3000) });
    if (!response.ok) throw new Error(`CDP HTTP ${response.status}`);
    const rows = await response.json();
    if (Array.isArray(rows) && rows.length) { tabs = rows; cdp = candidate; break; }
    errors.push(`${candidate}: nenhuma aba disponível`);
  } catch (error) { errors.push(`${candidate}: ${error.message}`); }
}
if (!tabs) {
  console.error(`Chrome de trabalho não está disponível nos CDPs configurados (${errors.join(' | ')}). Nenhuma alteração foi feita.`);
  process.exit(2);
}
const tab = tabs.find((item) => item.type === 'page' && /mail\.google\.com/.test(item.url || ''));
if (!tab) {
  console.error(`Gmail não está aberto no Chrome de trabalho (${cdp}). Nenhuma alteração foi feita.`);
  process.exit(2);
}

const ws = new WebSocket(tab.webSocketDebuggerUrl);
let serial = 0;
const pending = new Map();
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) { pending.get(message.id)(message.result); pending.delete(message.id); }
};
const call = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++serial;
  const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout em ${method}`)); }, 10_000);
  pending.set(id, (value) => { clearTimeout(timer); resolve(value); });
  ws.send(JSON.stringify({ id, method, params }));
});
await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error(`CDP não abriu em ${cdp}`)), 5_000);
  ws.onopen = () => { clearTimeout(timer); resolve(); };
  ws.onerror = () => { clearTimeout(timer); reject(new Error(`falha no websocket CDP ${cdp}`)); };
});
// Gmail virtualizes the inbox rows; allow the authenticated page to finish
// rendering before reading the first page.
await new Promise((resolve) => setTimeout(resolve, 3000));
const result = await call('Runtime.evaluate', {
  returnByValue: true,
  expression: `JSON.stringify([...document.querySelectorAll('tr.zA, div[role="main"] tr')].slice(0, 80).map((row) => {
    const text = (selector) => (row.querySelector(selector)?.innerText || row.querySelector(selector)?.textContent || '').trim();
    const hrefs = [...row.querySelectorAll('a[href]')].map((a) => a.href).filter(Boolean);
    const link = hrefs.find((href) => /99freelas|workana|upwork|freelancer/.test(href)) || '';
    const gmailLink = hrefs.find((href) => href.includes('mail.google.com/mail/') && href.includes('#')) || '';
    const idFromLink = gmailLink.split('#').pop()?.split('/').slice(1)[0] || '';
    return { id: row.getAttribute('data-legacy-thread-id') || row.getAttribute('data-legacy-last-message-id') || row.getAttribute('data-thread-id') || idFromLink, from_: text('.yW, .bA4, [email]'), subject: text('.y6, .bog'), snippet: text('.y2, .y4'), email_ts: text('.xW, .bq3'), display_url: gmailLink, opportunityUrl: link, labels: [...row.classList] };
  }).filter((row) => row.subject || row.from_))`
});
ws.close();
if (result?.exceptionDetails) {
  throw new Error('A leitura do DOM do Gmail falhou; nenhuma alteração foi feita.');
}
const emails = JSON.parse(result?.result?.value || '[]');
if (!emails.length) {
  console.error(`Gmail aberto em ${cdp}, mas nenhuma linha da caixa foi renderizada. Nenhuma alteração foi feita.`);
  process.exit(2);
}
const response = await fetch(`${base}/api/emails/ingest`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ source: 'gmail-cdp', emails })
});
const body = await response.json().catch(() => ({}));
if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`);
console.log(JSON.stringify({ imported: emails.length, total: body.analysis?.total || 0, createdTasks: body.createdTasks || [] }));
