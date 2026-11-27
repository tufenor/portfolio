const form = document.querySelector('#briefing-form');
const result = document.querySelector('#briefing-result');
const summary = document.querySelector('#briefing-text');
const status = document.querySelector('#briefing-status');
const copy = document.querySelector('#copy-briefing');

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const fields = new FormData(form);
  const business = String(fields.get('business') || '').trim();
  if (!business) {
    status.textContent = 'Preencha o nome do negócio.';
    form.querySelector('#business').focus();
    return;
  }
  summary.value = [
    'Olá! Gostaria de um orçamento para o Menu Studio.',
    '',
    `Negócio: ${business}`,
    `Itens: ${fields.get('items') || 'A definir'}`,
    `Idiomas: ${fields.get('language')}`,
    `Cardápio em texto ou planilha: ${fields.get('material')}`
  ].join('\n');
  status.textContent = 'Resumo pronto para copiar.';
  result.hidden = false;
  summary.focus();
});

copy.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(summary.value);
    status.textContent = 'Resumo copiado. Cole o texto ao iniciar a conversa.';
  } catch {
    summary.focus();
    summary.select();
    status.textContent = 'Texto selecionado. Use o comando Copiar do seu dispositivo.';
  }
});

form.hidden = false;
