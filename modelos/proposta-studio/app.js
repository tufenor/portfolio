(() => {
  const configs = window.StudioConfigs || {};
  const validModels = Object.keys(configs);
  const query = new URLSearchParams(window.location.search);
  let model = validModels.includes(query.get('modelo')) ? query.get('modelo') : 'landing';

  const text = (selector, value) => {
    const node = document.querySelector(selector);
    if (node) node.textContent = value || '';
  };
  const list = (selector, values, render) => {
    const node = document.querySelector(selector);
    if (!node) return;
    node.replaceChildren(...values.map(render));
  };
  const item = (tag, className, value) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    node.textContent = value;
    return node;
  };

  function render(name) {
    model = validModels.includes(name) ? name : 'landing';
    const data = configs[model];
    document.documentElement.style.setProperty('--accent', data.accent);
    document.documentElement.style.setProperty('--accent-soft', data.accentSoft);
    document.title = `${data.label} — conceito editável`;
    text('#hero-focus', data.focus);
    text('#hero-summary', data.summary);
    text('#scope-short', data.scopeShort);
    text('#work-style', data.workStyle);
    text('#editable-note', data.editableNote);
    text('#canvas-kicker', data.canvasKicker);
    text('#canvas-title', data.canvasTitle);
    text('#canvas-detail', data.canvasDetail);
    text('#showcase-copy', data.showcase);
    text('#preview-url', data.preview.url);
    text('#preview-badge', data.preview.badge);
    text('#preview-title', data.preview.title);
    text('#preview-subtitle', data.preview.subtitle);
    const heroImage = document.querySelector('#hero-image');
    if (heroImage) {
      heroImage.src = data.image;
      heroImage.alt = data.imageAlt;
    }

    list('#route-list', data.route, ([number, title, detail]) => {
      const li = document.createElement('li');
      const marker = item('span', 'route-number', number);
      const body = document.createElement('div');
      body.append(item('h3', '', title), item('p', '', detail));
      li.append(marker, body);
      return li;
    });
    list('#checks-list', data.checks, (value) => {
      const li = item('li', '', value);
      li.prepend(item('span', 'check-mark', '✓'));
      return li;
    });
    list('#preview-rows', data.preview.rows, (value, index) => {
      const row = document.createElement('div');
      row.className = 'preview-row';
      row.style.setProperty('--row-delay', `${index * 120}ms`);
      row.append(item('span', 'row-dot', ''), item('span', '', value));
      return row;
    });
    list('#edit-grid', data.edits, (value, index) => {
      const article = document.createElement('article');
      article.innerHTML = `<span>${String(index + 1).padStart(2, '0')}</span><strong></strong>`;
      article.querySelector('strong').textContent = value;
      return article;
    });
    list('#brief-list', data.brief, (value) => item('li', '', value));

    document.querySelectorAll('.model-tab').forEach((button) => {
      const active = button.dataset.model === model;
      button.setAttribute('aria-selected', String(active));
      button.tabIndex = active ? 0 : -1;
      button.classList.toggle('is-active', active);
    });
    const next = new URL(window.location.href);
    next.searchParams.set('modelo', model);
    window.history.replaceState({}, '', next);
  }

  document.querySelectorAll('.model-tab').forEach((button) => {
    button.addEventListener('click', () => render(button.dataset.model));
    button.addEventListener('keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      event.preventDefault();
      const index = validModels.indexOf(model);
      const direction = event.key === 'ArrowRight' ? 1 : -1;
      const next = validModels[(index + direction + validModels.length) % validModels.length];
      render(next);
      document.querySelector(`[data-model="${next}"]`)?.focus();
    });
  });

  document.querySelector('#copy-link')?.addEventListener('click', async () => {
    const feedback = document.querySelector('#copy-feedback');
    try {
      await navigator.clipboard.writeText(window.location.href);
      if (feedback) feedback.textContent = 'Link copiado. A prévia abre no mesmo modelo selecionado.';
    } catch {
      if (feedback) feedback.textContent = 'Copie o endereço do navegador para compartilhar esta prévia.';
    }
  });

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) entry.target.classList.add('is-visible');
    });
  }, { threshold: 0.14 });
  document.querySelectorAll('.reveal').forEach((node) => observer.observe(node));
  render(model);
})();
