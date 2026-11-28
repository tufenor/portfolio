const homes = [
  { id: 1, type: 'apartment', tag: 'Exclusivo', title: 'Apartamento com luz natural', neighborhood: 'Pinheiros · São Paulo', price: 1280000, deal: 'comprar', beds: 3, baths: 2, area: 118, photo: 'photo-1600607687939-ce8a6c25118c', alt: 'Sala ampla com luz natural e decoração contemporânea' },
  { id: 2, type: 'house', tag: 'Novo', title: 'Casa jardim em rua tranquila', neighborhood: 'Vila Madalena · São Paulo', price: 890000, deal: 'comprar', beds: 2, baths: 2, area: 146, photo: 'photo-1600585154340-be6161a56a0c', alt: 'Casa contemporânea com jardim e fachada em tons neutros' },
  { id: 3, type: 'apartment', tag: 'Visita virtual', title: 'Cobertura com varanda aberta', neighborhood: 'Alto de Pinheiros · São Paulo', price: 1460000, deal: 'comprar', beds: 3, baths: 3, area: 162, photo: 'photo-1600607687920-4e2a09cf159d', alt: 'Interior elegante de apartamento com varanda integrada' },
  { id: 4, type: 'apartment', tag: 'Bem localizado', title: 'Apê compacto, cheio de charme', neighborhood: 'Vila Mariana · São Paulo', price: 5200, deal: 'alugar', beds: 1, baths: 1, area: 74, photo: 'photo-1600566753086-00f18fb6b3ea', alt: 'Sala compacta e acolhedora em apartamento moderno' },
  { id: 5, type: 'house', tag: 'Jardim privativo', title: 'Casa térrea entre árvores', neighborhood: 'Alto da Lapa · São Paulo', price: 1190000, deal: 'comprar', beds: 3, baths: 2, area: 173, photo: 'photo-1600047509807-ba8f99d2cdde', alt: 'Casa térrea com fachada de madeira e paisagismo' },
  { id: 6, type: 'apartment', tag: 'Pronto para morar', title: 'Apartamento sereno e ensolarado', neighborhood: 'Sumaré · São Paulo', price: 6800, deal: 'alugar', beds: 2, baths: 2, area: 96, photo: 'photo-1600210492486-724fe5c67fb0', alt: 'Sala de apartamento iluminada com mobiliário contemporâneo' }
];

const priceLimits = { comprar: { current: 1500000, alternate: 1000000 }, alugar: { current: 7000, alternate: 6000 } };
let filter = 'all';
let sort = 'recommended';
let roomsMin = 0;
let locationQuery = 'são paulo';
let viewMode = 'all';
let savedIds = [];
try {
  const stored = JSON.parse(localStorage.getItem('moradaSaved') || '[]');
  if (Array.isArray(stored)) savedIds = stored.filter(Number.isInteger);
} catch { /* storage may be unavailable in private browsing */ }
const saved = new Set(savedIds);

const money = n => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(n);
const image = (id, width = 900) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=82`;
const purposeSelect = document.getElementById('purposeSelect');
const currentLimit = () => priceLimits[purposeSelect.value].current;

function matchesSearch(home) {
  const query = locationQuery.trim().toLocaleLowerCase('pt-BR').replace(', sp', '');
  return !query || home.neighborhood.toLocaleLowerCase('pt-BR').includes(query);
}

function baseHomes() {
  return homes.filter(home => home.deal === purposeSelect.value
    && home.price <= currentLimit()
    && home.beds >= roomsMin
    && matchesSearch(home));
}

function visibleHomes() {
  let list = baseHomes();
  if (viewMode === 'saved') list = list.filter(home => saved.has(home.id));
  if (filter !== 'all') list = list.filter(home => home.type === filter);
  if (sort === 'price') list.sort((a, b) => a.price - b.price);
  return list;
}

function priceFilterLabel() {
  const limit = currentLimit();
  const label = limit >= 1000000
    ? `R$ ${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(limit / 1000000)} mi`
    : `R$ ${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(limit)} mil`;
  return `Até ${label} <span aria-hidden="true">⌄</span>`;
}

function render() {
  const base = baseHomes();
  const list = visibleHomes();
  const grid = document.getElementById('propertyGrid');
  document.getElementById('resultCount').textContent = String(list.length).padStart(2, '0');
  document.getElementById('allCount').textContent = String(base.length).padStart(2, '0');
  document.getElementById('apartmentCount').textContent = String(base.filter(home => home.type === 'apartment').length).padStart(2, '0');
  document.getElementById('houseCount').textContent = String(base.filter(home => home.type === 'house').length).padStart(2, '0');
  document.getElementById('savedCount').textContent = saved.size;
  document.getElementById('priceFilter').innerHTML = priceFilterLabel();
  document.getElementById('roomsFilter').setAttribute('aria-pressed', String(roomsMin > 0));
  document.getElementById('resultsTitle').innerHTML = viewMode === 'saved'
    ? 'Seus espaços <em>favoritos.</em>'
    : 'Espaços para <em>viver bem.</em>';
  document.querySelector('.result-count').lastChild.textContent = viewMode === 'saved'
    ? ' imóveis salvos'
    : ' imóveis que combinam com sua busca';

  grid.innerHTML = list.length ? list.map((home, index) => `
    <article class="property-card" data-open="${home.id}">
      <div class="property-image">
        <img class="property-photo" src="${image(home.photo)}" alt="${home.alt}" width="900" height="600" loading="${index === 0 ? 'eager' : 'lazy'}">
        <span class="tag">${home.tag}</span>
        <button class="favorite ${saved.has(home.id) ? 'saved' : ''}" data-save="${home.id}" aria-label="${saved.has(home.id) ? 'Remover dos' : 'Adicionar aos'} favoritos" aria-pressed="${saved.has(home.id)}">${saved.has(home.id) ? '♥' : '♡'}</button>
      </div>
      <div class="property-content">
        <h3 class="property-title">${home.title}</h3>
        <p class="property-location"><span aria-hidden="true">⌖</span> ${home.neighborhood}</p>
        <div class="features"><span>${home.area} m²</span><span>${home.beds} quartos</span><span>${home.baths} banhos</span></div>
        <div class="property-bottom">
          <div><div class="price-label">${home.deal === 'alugar' ? 'ALUGUEL MENSAL' : 'A PARTIR DE'}</div><div class="price">${money(home.price)}${home.deal === 'alugar' ? ' <small>/ mês</small>' : ''}</div></div>
          <a href="#detalhes" class="details-link" data-open="${home.id}" aria-haspopup="dialog">Ver imóvel ↗</a>
        </div>
      </div>
    </article>`).join('') : viewMode === 'saved'
      ? '<div class="empty-state"><strong>Sua lista está vazia.</strong>Toque no coração de um imóvel para guardá-lo aqui.</div>'
      : '<div class="empty-state"><strong>Nenhum espaço por aqui ainda.</strong>Tente ajustar os filtros para ampliar sua busca.</div>';
}

function setViewMode(mode) {
  viewMode = mode;
  document.getElementById('exploreNav').classList.toggle('active', mode === 'all');
  document.getElementById('savedNav').classList.toggle('active', mode === 'saved');
  if (mode === 'all') {
    document.getElementById('exploreNav').setAttribute('aria-current', 'page');
    document.getElementById('savedNav').removeAttribute('aria-current');
  } else {
    document.getElementById('savedNav').setAttribute('aria-current', 'page');
    document.getElementById('exploreNav').removeAttribute('aria-current');
  }
  render();
}

function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('show'), 2600);
}

function openHome(id) {
  const home = homes.find(item => item.id === Number(id));
  if (!home) return;
  document.getElementById('dialogContent').innerHTML = `
    <img class="dialog-image" src="${image(home.photo, 1100)}" alt="${home.alt}" width="1100" height="730">
    <div class="dialog-body">
      <div class="eyebrow muted">${home.tag} · ${home.neighborhood}</div>
      <h3 id="dialogTitle">${home.title}</h3>
      <p>Um espaço pensado para uma rotina mais leve, com ambientes bem distribuídos e luz natural ao longo do dia.</p>
      <div class="features"><span>${home.area} m²</span><span>${home.beds} quartos</span><span>${home.baths} banheiros</span></div>
      <div class="price">${money(home.price)}${home.deal === 'alugar' ? ' <small>/ mês</small>' : ''} <small>· valor fictício</small></div>
      <button class="dialog-cta" data-contact="${home.id}">Tenho interesse · solicitar visita</button>
    </div>`;
  document.getElementById('propertyDialog').showModal();
}

document.addEventListener('click', event => {
  const favoriteButton = event.target.closest('[data-save]');
  if (favoriteButton) {
    event.stopPropagation();
    const id = Number(favoriteButton.dataset.save);
    if (saved.has(id)) saved.delete(id); else saved.add(id);
    try { localStorage.setItem('moradaSaved', JSON.stringify([...saved])); } catch { /* current session still works */ }
    render();
    showToast(saved.has(id) ? 'Imóvel adicionado aos favoritos.' : 'Imóvel removido dos favoritos.');
    return;
  }

  const contactButton = event.target.closest('[data-contact]');
  if (contactButton) {
    document.getElementById('propertyDialog').close();
    showToast('Demonstração: solicitação de visita registrada localmente.');
    return;
  }

  const openTarget = event.target.closest('[data-open]');
  if (openTarget) {
    event.preventDefault();
    openHome(openTarget.dataset.open);
  }
});

document.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('[data-filter]').forEach(item => item.classList.remove('selected'));
  button.classList.add('selected');
  filter = button.dataset.filter;
  render();
}));

document.getElementById('searchBtn').addEventListener('click', () => {
  const location = document.getElementById('locationInput').value.trim();
  if (!location) {
    showToast('Digite uma cidade ou bairro para buscar.');
    document.getElementById('locationInput').focus();
    return;
  }
  locationQuery = location.toLocaleLowerCase('pt-BR');
  setViewMode('all');
  showToast(`Busca atualizada para ${location}.`);
});

document.getElementById('typeSelect').addEventListener('change', event => {
  const values = { todos: 'all', casa: 'house', apartamento: 'apartment' };
  filter = values[event.target.value] || 'all';
  document.querySelectorAll('[data-filter]').forEach(button => button.classList.toggle('selected', button.dataset.filter === filter));
  render();
});

purposeSelect.addEventListener('change', () => {
  roomsMin = 0;
  document.getElementById('roomsFilter').classList.remove('selected');
  render();
  showToast(purposeSelect.value === 'alugar' ? 'Exibindo imóveis disponíveis para aluguel.' : 'Exibindo imóveis disponíveis para compra.');
});

document.getElementById('mapToggle').addEventListener('click', event => {
  const button = event.currentTarget;
  const open = button.getAttribute('aria-pressed') !== 'true';
  button.setAttribute('aria-pressed', String(open));
  document.querySelector('.content-grid').classList.toggle('map-open', open);
  button.innerHTML = open ? '<span aria-hidden="true">⌖</span> Ocultar mapa' : '<span aria-hidden="true">⌖</span> Ver mapa';
});

document.getElementById('priceFilter').addEventListener('click', () => {
  const option = priceLimits[purposeSelect.value];
  [option.current, option.alternate] = [option.alternate, option.current];
  render();
});

document.getElementById('roomsFilter').addEventListener('click', event => {
  roomsMin = roomsMin === 2 ? 0 : 2;
  event.currentTarget.classList.toggle('selected', roomsMin > 0);
  render();
});

document.getElementById('sortBtn').addEventListener('click', event => {
  sort = sort === 'recommended' ? 'price' : 'recommended';
  event.currentTarget.setAttribute('aria-pressed', String(sort === 'price'));
  event.currentTarget.innerHTML = sort === 'price' ? 'Menor preço <span aria-hidden="true">⌄</span>' : 'Recomendados <span aria-hidden="true">⌄</span>';
  render();
});

document.getElementById('closeDialog').addEventListener('click', () => document.getElementById('propertyDialog').close());
document.getElementById('clearSearch').addEventListener('click', () => {
  document.getElementById('locationInput').value = '';
  locationQuery = '';
  setViewMode('all');
  document.getElementById('locationInput').focus();
});
document.getElementById('profileBtn').addEventListener('click', () => showToast('Perfil de demonstração · sem conta conectada.'));
document.getElementById('aboutCta').addEventListener('click', () => showToast('Protótipo navegável: explore filtros, mapa e favoritos.'));
document.getElementById('savedNav').addEventListener('click', event => {
  event.preventDefault();
  setViewMode('saved');
  document.getElementById('buscar').scrollIntoView({ behavior: 'smooth', block: 'start' });
});
document.getElementById('exploreNav').addEventListener('click', event => {
  event.preventDefault();
  setViewMode('all');
  document.getElementById('buscar').scrollIntoView({ behavior: 'smooth', block: 'start' });
});

render();
