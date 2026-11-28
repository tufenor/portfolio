const $ = (selector, root = document) => root.querySelectorAll(selector);
const one = (selector, root = document) => root.querySelector(selector);
const KEY = 'mansa-demo-801637-v2';
const defaults = {
  brand: 'mansa',
  headline: 'Seu banho. Seu tempo.',
  description: 'Um óleo botânico para transformar a rotina em um momento de pausa — com aroma leve, textura confortável e espaço para respirar.',
  cta: 'Conheça o óleo',
  price: 'R$ 79',
  hero: 'mansa-product.jpg',
  detail: 'mansa-product.jpg',
  texture: 'mansa-detail.jpg'
};
const textFields = { brand: 'brand', headline: 'headline', description: 'description', cta: 'cta', price: 'price' };

function toast(message) {
  const el = one('#toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove('show'), 2600);
}
function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}
function formatHeadline(value) {
  const clean = String(value || defaults.headline).trim().replace(/[.!?]+$/, '');
  const split = clean.indexOf('. ');
  if (split < 0) return escapeHtml(clean);
  const first = clean.slice(0, split).trim();
  const second = clean.slice(split + 2).trim().replace(/[.!?]+$/, '');
  return `${escapeHtml(first)}.<br><em>${escapeHtml(second)}.</em>`;
}
function apply(data) {
  Object.entries(textFields).forEach(([key, selector]) => {
    $(`[data-edit="${selector}"]`).forEach(el => {
      el.innerHTML = key === 'headline' ? formatHeadline(data[key]) : escapeHtml(data[key] || defaults[key]);
    });
  });
  ['hero', 'detail', 'texture'].forEach(key => {
    const image = one(`[data-edit-image="${key}"]`);
    if (image && data[key]) image.src = data[key];
    const input = one(`input[name="${key}"]`);
    if (input) input.value = data[key] || defaults[key];
  });
}
function fillForm(data) {
  const form = one('#edit-form');
  Object.keys(defaults).forEach(key => {
    if (form.elements[key]) form.elements[key].value = data[key] || defaults[key];
  });
}
function openEditor() {
  const box = one('#editor');
  box.classList.add('is-open');
  box.setAttribute('aria-hidden', 'false');
  one('#editor-close').focus();
}
function closeEditor() {
  const box = one('#editor');
  box.classList.remove('is-open');
  box.setAttribute('aria-hidden', 'true');
  one('#edit-open').focus();
}
function showDemoCheckout() {
  const dialog = one('#checkout-dialog');
  if (typeof dialog.showModal === 'function') dialog.showModal();
  else toast('Checkout ilustrativo — nenhum dado será enviado.');
}

try {
  const saved = JSON.parse(localStorage.getItem(KEY) || '{}');
  const data = { ...defaults, ...saved };
  apply(data);
  fillForm(data);
} catch {
  apply(defaults);
  fillForm(defaults);
}
one('#edit-open').addEventListener('click', openEditor);
one('#editor-close').addEventListener('click', closeEditor);
one('#editor-close-scrim').addEventListener('click', closeEditor);
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && one('#editor').classList.contains('is-open')) closeEditor();
});
one('#edit-form').addEventListener('submit', event => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const next = Object.fromEntries(Object.keys(defaults).map(key => [key, String(form.get(key) || '').trim()]));
  localStorage.setItem(KEY, JSON.stringify(next));
  apply({ ...defaults, ...next });
  toast('Prévia salva neste navegador.');
  closeEditor();
});
one('#edit-reset').addEventListener('click', () => {
  localStorage.removeItem(KEY);
  fillForm(defaults);
  apply(defaults);
  toast('Conteúdo original restaurado.');
});
['#buy-top', '#buy-hero', '#buy-detail', '#buy-last'].forEach(id => one(id)?.addEventListener('click', showDemoCheckout));
one('#dialog-ok').addEventListener('click', () => one('#checkout-dialog').close());
