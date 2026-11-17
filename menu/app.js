/* Menu Studio — carrega a configuração, aplica idioma e tema, e renderiza o menu.
   Sem dependências. Funciona servido por HTTP (busca data/config.json)
   ou abrindo o arquivo e selecionando o JSON manualmente. */
(function () {
  'use strict';

  var CONFIG_URL = 'data/config.json';
  var STORAGE_LANG = 'menu-studio-lang';
  var STORAGE_THEME = 'menu-studio-theme';

  var state = { config: null, lang: 'pt', theme: 'light', category: 'all', query: '' };
  var $ = function (sel) { return document.querySelector(sel); };

  function ui(key) {
    var locale = state.config.locales[state.lang] || state.config.locales[state.config.defaultLanguage];
    return (locale.ui && locale.ui[key]) || key;
  }

  function t(path) {
    var locale = state.config.locales[state.lang] || {};
    var value = path.split('.').reduce(function (acc, part) {
      return acc && acc[part] !== undefined ? acc[part] : undefined;
    }, locale);
    return value === undefined ? '' : value;
  }

  function money(value) {
    var locale = state.config.locales[state.lang] || {};
    try {
      return new Intl.NumberFormat(locale.tag || 'pt-BR', {
        style: 'currency', currency: locale.currency || 'BRL', maximumFractionDigits: 0
      }).format(value);
    } catch (err) {
      return String(value);
    }
  }

  function applyStaticText() {
    document.documentElement.lang = (state.config.locales[state.lang] || {}).tag || 'pt-BR';
    document.querySelectorAll('[data-i18n]').forEach(function (node) {
      var key = node.getAttribute('data-i18n');
      var value = ui(key);
      if (value) node.textContent = value;
    });
    var search = $('#menu-search');
    if (search) search.placeholder = ui('searchPlaceholder');
    document.title = (state.config.brand.pageTitle && state.config.brand.pageTitle[state.lang]) || state.config.brand.name;
    $('#brand-name').textContent = state.config.brand.name;
    $('#footer-brand').textContent = state.config.brand.name;
    $('#brand-link').setAttribute('aria-label', ui('homeLabel'));

    $('#hero-eyebrow').textContent = t('hero.eyebrow');
    $('#hero-title').textContent = t('hero.title');
    $('#hero-description').textContent = t('hero.description');
    $('#hero-note').textContent = t('hero.note');
    $('#hero-signature').textContent = t('hero.signature');
    $('#art-caption').textContent = t('hero.artCaption');

    $('#menu-title').textContent = ui('menuTitle');
    $('#menu-intro').textContent = t('menu.intro');
    $('#menu-footnote').textContent = t('menu.footnote');

    $('#about-title').textContent = t('about.title');
    $('#about-description').textContent = t('about.description');
    $('#about-note').textContent = t('about.note');

    $('#contact-title').textContent = t('contact.title');
    $('#contact-description').textContent = t('contact.description');
    $('#contact-note').textContent = t('contact.note');
    $('#business-hours').textContent = t('visit.hours');
    $('#business-location').textContent = t('visit.location');

    var toggle = $('#theme-toggle');
    toggle.setAttribute('aria-label', state.theme === 'dark' ? ui('themeLight') : ui('themeDark'));
    toggle.setAttribute('aria-pressed', state.theme === 'dark' ? 'true' : 'false');
    $('#demo-strip').hidden = !state.config.demo;
    $('#language').value = state.lang;
  }

  function renderContact() {
    var contact = state.config.contact || { mode: 'disabled' };
    var link = $('#contact-link');
    var disabled = $('#contact-disabled');
    var href = '';
    if (contact.mode === 'whatsapp' && contact.whatsappNumber) {
      href = 'https://wa.me/' + String(contact.whatsappNumber).replace(/\D/g, '') +
        '?text=' + encodeURIComponent((contact.message && contact.message[state.lang]) || '');
    } else if (contact.mode === 'email' && contact.email) {
      href = 'mailto:' + contact.email;
    } else if (contact.mode === 'url' && contact.url) {
      href = contact.url;
    }
    if (href) {
      link.href = href;
      link.textContent = t('contact.button');
      link.hidden = false;
      disabled.hidden = true;
    } else {
      link.hidden = true;
      disabled.hidden = false;
      disabled.textContent = ui('contactDisabled');
    }
  }

  function renderCategories() {
    var wrap = $('#category-filters');
    wrap.textContent = '';
    var all = document.createElement('button');
    all.type = 'button';
    all.className = 'chip' + (state.category === 'all' ? ' is-active' : '');
    all.textContent = ui('allCategory');
    all.setAttribute('aria-pressed', state.category === 'all' ? 'true' : 'false');
    all.addEventListener('click', function () { state.category = 'all'; renderCategories(); renderMenu(); });
    wrap.appendChild(all);

    (state.config.categories || []).forEach(function (cat) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'chip' + (state.category === cat.id ? ' is-active' : '');
      btn.textContent = cat.label[state.lang] || cat.label.pt || cat.id;
      btn.setAttribute('aria-pressed', state.category === cat.id ? 'true' : 'false');
      btn.addEventListener('click', function () { state.category = cat.id; renderCategories(); renderMenu(); });
      wrap.appendChild(btn);
    });
  }

  function matches(item) {
    if (state.category !== 'all' && item.category !== state.category) return false;
    if (!state.query) return true;
    var haystack = [
      item.name, item.description, item.ingredients, item.tag
    ].map(function (v) { return (v && (v[state.lang] || v.pt)) || ''; }).join(' ').toLowerCase();
    return haystack.indexOf(state.query.toLowerCase()) !== -1;
  }

  function renderMenu() {
    var grid = $('#menu-grid');
    var template = $('#menu-card-template');
    var items = (state.config.items || []).filter(matches);
    grid.textContent = '';

    items.forEach(function (item) {
      var node = template.content.firstElementChild.cloneNode(true);
      var category = (state.config.categories || []).filter(function (c) { return c.id === item.category; })[0];
      node.querySelector('use').setAttribute('href', 'assets/menu-icons.svg#' + (item.illustration || 'coffee'));
      node.querySelector('.item-category').textContent = category ? (category.label[state.lang] || category.label.pt) : '';
      node.querySelector('.item-name').textContent = item.name[state.lang] || item.name.pt;
      node.querySelector('.item-price').textContent = money(item.prices[state.lang] || item.prices.pt);
      node.querySelector('.item-description').textContent = item.description[state.lang] || item.description.pt;
      node.querySelector('.item-tag').textContent = (item.tag && (item.tag[state.lang] || item.tag.pt)) || '';
      var summary = node.querySelector('summary');
      var detail = node.querySelector('.item-details p');
      var ingredients = item.ingredients && (item.ingredients[state.lang] || item.ingredients.pt);
      if (ingredients) {
        summary.textContent = ui('ingredients');
        detail.textContent = ingredients;
      } else {
        var details = node.querySelector('.item-details');
        if (details) details.remove();
      }
      grid.appendChild(node);
    });

    var count = items.length;
    $('#results-status').textContent = count === 1 ? ui('resultSingle') : ui('resultCount').replace('{count}', count);
    $('#empty-state').hidden = count !== 0;
    $('#menu-grid').hidden = count === 0;
  }

  function renderAll() {
    applyStaticText();
    renderContact();
    renderCategories();
    renderMenu();
  }

  function start(config) {
    if (!config || !config.locales) throw new Error('Configuração inválida.');
    state.config = config;
    state.lang = localStorage.getItem(STORAGE_LANG) ||
      (config.locales[config.defaultLanguage] ? config.defaultLanguage : 'pt');
    state.theme = localStorage.getItem(STORAGE_THEME) || 'light';
    document.documentElement.setAttribute('data-theme', state.theme);
    $('#setup-state').hidden = true;
    $('#site-app').hidden = false;
    document.body.setAttribute('data-state', 'ready');
    $('#loading-state').hidden = true;
    renderAll();
  }

  function fail(message) {
    document.body.setAttribute('data-state', 'setup');
    $('#loading-state').hidden = true;
    $('#site-app').hidden = true;
    $('#setup-state').hidden = false;
    $('#setup-message').textContent = 'Abra esta pasta com um servidor estático ou selecione o config.json para visualizar.';
    $('#setup-error').textContent = message || '';
  }

  function wire() {
    $('#language').addEventListener('change', function (e) {
      state.lang = e.target.value;
      localStorage.setItem(STORAGE_LANG, state.lang);
      renderAll();
    });
    $('#theme-toggle').addEventListener('click', function () {
      state.theme = state.theme === 'dark' ? 'light' : 'dark';
      localStorage.setItem(STORAGE_THEME, state.theme);
      document.documentElement.setAttribute('data-theme', state.theme);
      applyStaticText();
    });
    $('#menu-search').addEventListener('input', function (e) {
      state.query = e.target.value.trim();
      renderMenu();
    });
    $('#clear-search').addEventListener('click', function () {
      state.query = '';
      state.category = 'all';
      $('#menu-search').value = '';
      renderCategories();
      renderMenu();
    });
    $('#config-file').addEventListener('change', function (e) {
      var file = e.target.files && e.target.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        try { start(JSON.parse(reader.result)); }
        catch (err) { $('#setup-error').textContent = 'O arquivo não é um JSON válido do Menu Studio.'; }
      };
      reader.readAsText(file);
    });
  }

  function boot() {
    wire();
    fetch(CONFIG_URL, { cache: 'no-store' })
      .then(function (res) { if (!res.ok) throw new Error('HTTP ' + res.status); return res.json(); })
      .then(start)
      .catch(function () { fail(''); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
