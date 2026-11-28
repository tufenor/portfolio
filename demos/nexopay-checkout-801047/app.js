const screens = ['checkout', 'login', 'overview'];
const labels = { checkout: 'Checkout', login: 'Acesso', overview: 'Visão geral', payments: 'Pagamentos', customers: 'Clientes', integrations: 'Integrações', settings: 'Configurações' };
const subtitles = { checkout: 'Crie uma experiência de pagamento clara, segura e sem atrito.', login: 'Um acesso simples, com sinais claros de segurança.', overview: 'Acompanhe os principais indicadores da sua operação.' };
let toastTimer;
function openScreen(screen) {
  const target = screens.includes(screen) ? screen : 'overview';
  document.querySelectorAll('.screen').forEach(el => { const on = el.id === `screen-${target}`; el.classList.toggle('active', on); el.hidden = !on; });
  document.querySelectorAll('.screen-tab').forEach(el => { const on = el.dataset.screen === target; el.classList.toggle('active', on); el.setAttribute('aria-selected', String(on)); });
  document.querySelectorAll('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.screen === target));
  document.querySelector('#crumb').textContent = labels[target];
  document.querySelector('#page-title').textContent = labels[target];
  document.querySelector('#page-subtitle').textContent = subtitles[target];
  document.querySelector('.sidebar').classList.remove('mobile-open');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function toast(message) { const el = document.querySelector('#toast'); el.textContent = message; el.classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('visible'), 2300); }
document.querySelectorAll('[data-screen]').forEach(el => el.addEventListener('click', () => openScreen(el.dataset.screen)));
document.querySelectorAll('[data-screen-link]').forEach(el => el.addEventListener('click', () => openScreen(el.dataset.screenLink)));
document.querySelectorAll('[data-toast]').forEach(el => el.addEventListener('click', () => toast(el.dataset.toast)));
document.querySelectorAll('[data-device]').forEach(el => el.addEventListener('click', () => { document.querySelectorAll('.device').forEach(d => d.classList.toggle('active', d === el)); document.querySelector('#store-preview').classList.toggle('mobile-preview', el.dataset.device === 'mobile'); }));
document.querySelectorAll('[data-qty]').forEach(el => el.addEventListener('click', () => { const qty = document.querySelector('#qty'); qty.textContent = Math.max(1, Number(qty.textContent) + Number(el.dataset.qty)); document.querySelector('#pay-button').firstChild.textContent = `Pagar R$ ${(489.9 * Number(qty.textContent)).toFixed(2).replace('.', ',')} `; }));
document.querySelector('#pay-button').addEventListener('click', () => toast('Demonstração: nenhum pagamento foi processado.'));
document.querySelector('#login-form').addEventListener('submit', ev => { ev.preventDefault(); toast('Demonstração: login não conectado a uma conta.'); });
document.querySelector('#show-password').addEventListener('click', ev => { const input = document.querySelector('#login-password'); input.type = input.type === 'password' ? 'text' : 'password'; ev.currentTarget.setAttribute('aria-label', input.type === 'password' ? 'Mostrar senha' : 'Ocultar senha'); });
document.querySelector('.mobile-menu').addEventListener('click', () => document.querySelector('.sidebar').classList.toggle('mobile-open'));
