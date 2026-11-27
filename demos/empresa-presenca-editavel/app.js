(() => {
  const defaults = window.NorteaDemoDefaults;
  const storageKey = 'nortea-demo-v1';
  const textFields = ['brand', 'kicker', 'title', 'description', 'cta', 'serviceOne', 'serviceTwo', 'serviceThree', 'accent'];
  const fieldIds = {
    brand: 'edit-brand', kicker: 'edit-kicker', title: 'edit-title', description: 'edit-description',
    cta: 'edit-cta', serviceOne: 'edit-service-one', serviceTwo: 'edit-service-two',
    serviceThree: 'edit-service-three', accent: 'edit-color'
  };
  let model = readSaved();
  const dialog = document.querySelector('#editor-dialog');
  const toast = document.querySelector('#toast');
  let toastTimer;

  function readSaved() {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || '{}');
      return Object.fromEntries(textFields.map((key) => [key, typeof saved[key] === 'string' ? saved[key] : defaults[key]]));
    } catch {
      return { ...defaults };
    }
  }

  function render() {
    document.querySelector('#brand-name').textContent = model.brand;
    document.querySelector('#footer-brand-name').textContent = model.brand;
    document.querySelector('#hero-kicker').textContent = model.kicker;
    document.querySelector('#hero-description').textContent = model.description;
    document.querySelector('#hero-cta').textContent = model.cta;
    document.querySelector('#service-one').textContent = model.serviceOne;
    document.querySelector('#service-two').textContent = model.serviceTwo;
    document.querySelector('#service-three').textContent = model.serviceThree;
    const title = document.querySelector('#hero-title');
    const parts = model.title.split(/\s+(à altura\.?|com clareza\.?|no seu ritmo\.?)$/i);
    if (parts.length > 1) {
      title.replaceChildren(document.createTextNode(`${parts[0]} `));
      const em = document.createElement('em');
      em.textContent = parts[1];
      title.append(em);
    } else title.textContent = model.title;
    document.documentElement.style.setProperty('--accent', model.accent);
  }

  function fillEditor() {
    for (const [key, id] of Object.entries(fieldIds)) document.getElementById(id).value = model[key];
  }

  function notify(message) {
    toast.textContent = message;
    toast.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 3000);
  }

  function openEditor() {
    fillEditor();
    dialog.showModal();
  }

  document.querySelector('#open-editor').addEventListener('click', openEditor);
  document.querySelector('#open-editor-bottom').addEventListener('click', openEditor);
  document.querySelector('#save-preview').addEventListener('click', () => {
    model = Object.fromEntries(Object.entries(fieldIds).map(([key, id]) => [key, document.getElementById(id).value.trim() || defaults[key]]));
    try {
      localStorage.setItem(storageKey, JSON.stringify(model));
      render();
      document.querySelector('#editor-status').textContent = 'Prévia atualizada neste navegador. Exporte a configuração para reaproveitar os textos.';
      notify('Prévia atualizada neste navegador.');
    } catch {
      document.querySelector('#editor-status').textContent = 'O navegador não permitiu salvar. Exporte a configuração para guardar suas alterações.';
    }
  });
  document.querySelector('#export-config').addEventListener('click', () => {
    const blob = new Blob([`${JSON.stringify(model, null, 2)}\n`], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'configuracao-site.json';
    link.click();
    URL.revokeObjectURL(url);
    notify('Configuração exportada para o dispositivo.');
  });
  document.querySelector('#reset-preview').addEventListener('click', () => {
    model = { ...defaults };
    localStorage.removeItem(storageKey);
    render();
    fillEditor();
    document.querySelector('#editor-status').textContent = 'Conteúdo inicial restaurado apenas nesta prévia.';
    notify('Conteúdo inicial restaurado.');
  });
  document.querySelector('#contact-form').addEventListener('submit', (event) => {
    event.preventDefault();
    document.querySelector('#form-feedback').textContent = 'Demonstração: nada foi enviado. Na versão final, esse formulário será conectado ao canal escolhido pela empresa.';
  });

  const menuToggle = document.querySelector('#menu-toggle');
  const mobileNav = document.querySelector('#mobile-nav');
  menuToggle.addEventListener('click', () => {
    const expanded = menuToggle.getAttribute('aria-expanded') === 'true';
    menuToggle.setAttribute('aria-expanded', String(!expanded));
    menuToggle.setAttribute('aria-label', expanded ? 'Abrir menu' : 'Fechar menu');
    mobileNav.hidden = expanded;
  });
  mobileNav.addEventListener('click', (event) => {
    if (event.target.closest('a')) {
      mobileNav.hidden = true;
      menuToggle.setAttribute('aria-expanded', 'false');
      menuToggle.setAttribute('aria-label', 'Abrir menu');
    }
  });

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const revealItems = document.querySelectorAll('.reveal');
  if (reduceMotion || !('IntersectionObserver' in window)) revealItems.forEach((item) => item.classList.add('is-visible'));
  else {
    const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    }), { threshold: 0.12 });
    revealItems.forEach((item) => observer.observe(item));
  }
  render();
})();
