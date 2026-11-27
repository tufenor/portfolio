// El editor guarda una copia local que solo se muestra en modo de vista previa.
(() => {
  'use strict';
  if (new URLSearchParams(location.search).get('previa') !== '1') return;

  const key = 'moneyia:cafe-plaza:preview:v1';
  const categories = [['cafes', 'Cafés'], ['dulces', 'Dulces'], ['salados', 'Salados']];
  const text = (value) => typeof value === 'string' ? value.trim() : '';

  function create(tag, content, cssClass) {
    const el = document.createElement(tag);
    if (content) el.textContent = content;
    if (cssClass) el.className = cssClass;
    return el;
  }

  function imageSource(value) {
    const src = text(value);
    const local = /^img\/[a-z0-9_-]+\.(?:jpe?g|png|webp)$/i.test(src);
    const inline = /^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/]+=*$/i.test(src);
    return local || inline ? src : '';
  }

  function renderItem(item) {
    const row = create('article', '', 'item');
    const info = create('div');
    const src = imageSource(item.foto);
    if (src) {
      const photo = create('img', '', 'preview-item-photo');
      photo.src = src;
      photo.alt = text(item.nome);
      photo.loading = 'lazy';
      photo.width = 96;
      info.append(photo);
    }
    info.append(create('h3', text(item.nome)), create('p', text(item.detalhe)));
    row.append(info, create('span', text(item.preco), 'preco'));
    return row;
  }

  function renderMenu(data) {
    const section = document.querySelector('#menu');
    const tabs = section?.querySelector('.abas');
    const firstPanel = section?.querySelector('.painel');
    if (!tabs || !firstPanel) return;

    const parent = firstPanel.parentElement;
    parent.querySelectorAll('.painel').forEach((panel) => panel.remove());
    tabs.replaceChildren();
    const controls = [];
    for (const [id, label] of categories) {
      const items = Array.isArray(data[id]) ? data[id].filter((item) => item && text(item.nome)) : [];
      if (!items.length) continue;

      const first = controls.length === 0;
      const tab = create('button', label, first ? 'aba ativa' : 'aba');
      const panel = create('div', '', first ? 'painel ativo' : 'painel');
      tab.type = 'button';
      tab.id = 'preview-tab-' + id;
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-selected', String(first));
      panel.id = 'preview-panel-' + id;
      panel.setAttribute('role', 'tabpanel');
      panel.setAttribute('aria-labelledby', tab.id);
      tab.setAttribute('aria-controls', panel.id);
      for (const item of items) panel.appendChild(renderItem(item));
      tabs.appendChild(tab);
      parent.appendChild(panel);
      controls.push({ tab, panel });

      tab.addEventListener('click', () => {
        for (const control of controls) {
          const active = control.tab === tab;
          control.tab.classList.toggle('ativa', active);
          control.tab.setAttribute('aria-selected', String(active));
          control.panel.classList.toggle('ativo', active);
        }
      });
    }
    if (!controls.length) parent.appendChild(create('p', 'Todavía no hay ítems en esta vista previa.', 'painel ativo'));
  }

  document.addEventListener('DOMContentLoaded', () => {
    let data;
    try { data = JSON.parse(localStorage.getItem(key) || 'null'); } catch {}
    const hasPreview = Boolean(data && typeof data === 'object' && !Array.isArray(data));
    const note = create('aside', hasPreview ? 'Vista previa local. Los cambios aún no están publicados.' : 'Abre el editor y selecciona «Ver con cambios».');
    note.setAttribute('role', 'status');
    note.className = 'preview-local-notice';
    document.body.appendChild(note);
    if (!hasPreview) return;

    const name = text(data.negocio);
    const brand = document.querySelector('.marca-nome');
    if (name && brand) {
      brand.textContent = name;
      document.title = name + ' · Vista previa';
      brand.closest('a')?.setAttribute('aria-label', name + ' — inicio');
    }
    const title = document.querySelector('.hero h1');
    if (title && (text(data.titulo1) || text(data.titulo2))) {
      title.replaceChildren(document.createTextNode(text(data.titulo1)), document.createElement('br'), create('em', text(data.titulo2)));
    }
    const description = document.querySelector('.hero-conteudo p');
    if (description && typeof data.subtitulo === 'string') description.textContent = text(data.subtitulo);

    const tel = text(data.whatsapp).replace(/\D/g, '');
    if (/^591\d{8}$/.test(tel)) {
      document.querySelectorAll('a[href*="wa.me"]').forEach((link) => {
        link.href = 'https://wa.me/' + tel + '?text=Hola%2C%20quiero%20pedir';
      });
    }
    if (data.horario && typeof data.horario === 'object') {
      const fields = document.querySelectorAll('.linha-hora b');
      ['lv', 'sab', 'dom'].forEach((day, index) => {
        if (fields[index] && typeof data.horario[day] === 'string') fields[index].textContent = text(data.horario[day]);
      });
    }
    if (data.itens && typeof data.itens === 'object') renderMenu(data.itens);
  });
})();
