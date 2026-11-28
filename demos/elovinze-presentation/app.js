(() => {
  const config = window.ELOVINZE_DEMO;
  if (config?.copy) {
    document.querySelectorAll('[data-copy]').forEach((element) => {
      const key = element.dataset.copy;
      if (config.copy[key] != null) element.textContent = config.copy[key];
    });
  }
  if (config?.images) {
    document.querySelectorAll('[data-demo-image]').forEach((image) => {
      const key = image.dataset.demoImage;
      if (config.images[key]) image.src = config.images[key];
    });
  }
  if (config?.cardUrl) {
    document.querySelectorAll('[data-card-link]').forEach((link) => { link.href = config.cardUrl; });
  }
  const toggle = document.querySelector('.menu-toggle');
  const nav = document.querySelector('#navigation');
  if (!toggle || !nav) return;
  const close = () => {
    toggle.setAttribute('aria-expanded', 'false');
    toggle.querySelector('.sr-only').textContent = 'Abrir menu';
    nav.classList.remove('is-open');
  };
  toggle.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', String(open));
    toggle.querySelector('.sr-only').textContent = open ? 'Fechar menu' : 'Abrir menu';
    nav.classList.toggle('is-open', open);
  });
  nav.addEventListener('click', (event) => {
    if (event.target.closest('a')) close();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') { close(); toggle.focus(); }
  });
})();
