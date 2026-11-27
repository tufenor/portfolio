const byId = (id) => document.getElementById(id);
const setText = (id, value) => { byId(id).textContent = value; };
const example = new URL('config.json', location.href);

function configLink(value) {
  if (typeof value !== 'string' || !value.trim()) throw new Error('Link inválido.');
  const url = new URL(value, location.href);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('Use um link HTTP ou HTTPS.');
  }
  return url.href;
}

function sanitize(config) {
  const required = ['brand', 'eyebrow', 'title', 'intro', 'ctaLabel', 'contactNote'];
  const hasText = (record, fields) => record && fields.every(
    (key) => typeof record[key] === 'string' && record[key].trim()
  );
  if (!hasText(config, required)) throw new Error('Confira os campos de texto obrigatórios.');
  for (const [key, fields] of [['services', ['number', 'title', 'text']], ['faq', ['question', 'answer']]]) {
    const items = config[key];
    if (!Array.isArray(items) || !items.length || items.length > 30 || !items.every((item) => hasText(item, fields))) {
      throw new Error(`Confira os itens em ${key}.`);
    }
  }
  let heroImage = null;
  if (config.heroImage) {
    if (!hasText(config.heroImage, ['src', 'alt'])) throw new Error('Informe o endereço e a descrição da imagem.');
    heroImage = { src: configLink(config.heroImage.src), alt: config.heroImage.alt };
  }
  return { ...config, ctaUrl: config.ctaUrl ? configLink(config.ctaUrl) : '#contato', heroImage };
}

function element(tag, text) {
  const node = document.createElement(tag);
  node.textContent = text;
  return node;
}

function render(config) {
  for (const id of ['brand', 'eyebrow', 'title', 'intro', 'contactNote']) setText(id, config[id]);
  setText('footerBrand', config.brand);
  setText('heroCta', config.ctaLabel);
  byId('heroCta').setAttribute('href', config.ctaUrl);
  document.title = `${config.brand} — ${config.title}`;
  const image = byId('heroImage');
  image.hidden = !config.heroImage;
  if (config.heroImage) {
    image.alt = config.heroImage.alt;
    image.src = config.heroImage.src;
  } else {
    image.removeAttribute('src');
  }
  byId('services').replaceChildren(...config.services.map((service) => {
    const card = document.createElement('article');
    card.className = 'card';
    card.append(element('b', service.number), element('h3', service.title), element('p', service.text));
    return card;
  }));
  byId('faq').replaceChildren(...config.faq.map((item) => {
    const detail = document.createElement('details');
    detail.append(element('summary', item.question), element('p', item.answer));
    return detail;
  }));
}

async function loadExample() {
  const response = await fetch(example, { cache: 'no-store' });
  if (!response.ok) throw new Error('O exemplo não carregou.');
  render(sanitize(await response.json()));
}

async function loadSampleForEditor(message = '') {
  try {
    await loadExample();
    setText('editorStatus', message);
  } catch {
    setText('editorStatus', 'O exemplo está indisponível. Você pode carregar um JSON local.');
  }
}

loadSampleForEditor().finally(() => {
  byId('previewFile').disabled = false;
  byId('resetPreview').disabled = false;
});

byId('previewFile').addEventListener('change', async (event) => {
  const input = event.currentTarget;
  const [file] = input.files;
  if (!file) return;
  input.disabled = true;
  byId('resetPreview').disabled = true;
  try {
    if (file.size > 256_000) throw new Error('Use um JSON de até 256 KB.');
    render(sanitize(JSON.parse(await file.text())));
    setText('editorStatus', 'Prévia atualizada nesta página.');
  } catch {
    setText('editorStatus', 'Arquivo inválido. Confira os campos do JSON de exemplo.');
  } finally {
    input.value = '';
    input.disabled = false;
    byId('resetPreview').disabled = false;
  }
});

byId('resetPreview').addEventListener('click', async () => {
  byId('previewFile').disabled = true;
  byId('resetPreview').disabled = true;
  try {
    await loadSampleForEditor('Exemplo original restaurado.');
  } finally {
    byId('previewFile').disabled = false;
    byId('resetPreview').disabled = false;
  }
});

byId('leadForm').addEventListener('submit', (event) => {
  event.preventDefault();
  const valid = byId('name').value.trim() && byId('message').value.trim().length >= 10;
  setText('status', valid
    ? 'Pedido validado nesta demonstração.'
    : 'Preencha seu nome e escreva pelo menos 10 caracteres.');
});
