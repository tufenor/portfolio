const STORAGE_KEY = 'lumen-kpi-demo-v1';
const BASE = { revenue: 184520, margin: 32.4, orders: 1284, target: 235000 };
const CHANNELS = [
  { name: 'Loja virtual', share: 48, icon: 'W', className: 'channel-direct', value: .48 },
  { name: 'Marketplace', share: 32, icon: 'M', className: 'channel-market', value: .32 },
  { name: 'Redes sociais', share: 20, icon: 'S', className: 'channel-social', value: .20 },
];
const PRODUCTS = [
  { name: 'Kit Essencial', detail: 'Acessórios · 312 unidades', share: .31, monogram: 'KE' },
  { name: 'Caderno Horizonte', detail: 'Papelaria · 246 unidades', share: .24, monogram: 'CH' },
  { name: 'Luminária Alba', detail: 'Casa · 188 unidades', share: .18, monogram: 'LA' },
];
const PERIODS = { 7: { multiplier: .24, previous: .91 }, 30: { multiplier: 1, previous: .887 }, 90: { multiplier: 2.86, previous: .94 } };
let values = loadValues();
let importedRows = null;
let toastTimer;

function loadValues() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && ['revenue', 'margin', 'orders', 'target'].every(key => Number.isFinite(Number(saved[key])))) return { ...BASE, ...saved };
  } catch { /* local demo data only */ }
  return { ...BASE };
}
function money(value, digits = 0) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value); }
function integer(value) { return new Intl.NumberFormat('pt-BR').format(value); }
function number(value, digits = 1) { return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value); }
function currentPeriod() { return PERIODS[document.querySelector('#period-select').value] || PERIODS[30]; }
function localDateKey(date) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; }
function axisLabels(days, endDate = new Date()) { const end=new Date(endDate); end.setHours(12,0,0,0); const start=new Date(end); start.setDate(start.getDate()-days+1); const middle=new Date(start); middle.setDate(middle.getDate()+Math.floor((days-1)/2)); const fmt=date=>new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'short'}).format(date).replace('.',''); return [fmt(start),fmt(middle),fmt(end)]; }
function escapeHtml(value) { return String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char])); }
function csvNumber(value) {
  let text=String(value ?? '').trim().replace(/[R$\s%]/g,'');
  if(text.includes(',')&&text.includes('.')) text=text.replace(/\./g,'').replace(',','.');
  else if(text.includes(',')) text=text.replace(',','.');
  const parsed=Number(text);
  return Number.isFinite(parsed)?parsed:NaN;
}
function csvRowsForPeriod() {
  if(!importedRows?.length)return null;
  const days=Number(document.querySelector('#period-select').value)||30;
  const maxDate=Math.max(...importedRows.map(row=>row.date.getTime()));
  const end=new Date(maxDate);end.setHours(23,59,59,999);
  const start=new Date(end);start.setDate(start.getDate()-days+1);start.setHours(0,0,0,0);
  const previousStart=new Date(start);previousStart.setDate(previousStart.getDate()-days);
  const current=importedRows.filter(row=>row.date>=start&&row.date<=end);
  const previous=importedRows.filter(row=>row.date>=previousStart&&row.date<start);
  return {current,previous,days};
}
function summarizeRows(rows) {
  return rows.reduce((summary,row)=>{
    summary.revenue+=row.revenue;summary.orders+=row.orders;
    summary.marginWeighted+=row.revenue*row.margin;summary.marginBase+=row.revenue;
    return summary;
  },{revenue:0,orders:0,marginWeighted:0,marginBase:0});
}

function renderMetrics() {
  const period = currentPeriod();
  const filtered=csvRowsForPeriod();
  const summary=filtered?summarizeRows(filtered.current):null;
  const previousSummary=filtered?summarizeRows(filtered.previous):null;
  const revenue = summary?summary.revenue:values.revenue * period.multiplier;
  const orders = summary?summary.orders:Math.round(values.orders * period.multiplier);
  const margin = summary?(summary.marginBase?summary.marginWeighted/summary.marginBase:0):values.margin;
  const ticket = orders ? revenue / orders : 0;
  document.querySelector('#metric-revenue').textContent = money(revenue);
  document.querySelector('#metric-margin').textContent = `${number(margin)}%`;
  document.querySelector('#metric-orders').textContent = integer(orders);
  document.querySelector('#metric-ticket').textContent = money(ticket, 2);
  document.querySelector('#chart-total').textContent = `${money(revenue / 1000, 1)} mil`;
  const labels=axisLabels(Number(document.querySelector('#period-select').value)||30, filtered?.current.length ? new Date(Math.max(...filtered.current.map(row=>row.date.getTime()))) : new Date());
  ['#axis-start','#axis-mid','#axis-end'].forEach((selector,index)=>document.querySelector(selector).textContent=labels[index]);
  if(filtered){
    const trendNodes=[...document.querySelectorAll('.metric-foot .trend')];
    const following=trendNodes.map(node=>node.nextElementSibling);
    const ratios=[
      previousSummary?.revenue?((revenue-previousSummary.revenue)/previousSummary.revenue*100):null,
      previousSummary?.marginBase?(margin-previousSummary.marginWeighted/previousSummary.marginBase):null,
      previousSummary?.orders?((orders-previousSummary.orders)/previousSummary.orders*100):null,
      previousSummary?.orders&&previousSummary?.revenue?((ticket-previousSummary.revenue/previousSummary.orders)/(previousSummary.revenue/previousSummary.orders)*100):null,
    ];
    ratios.forEach((change,index)=>{
      const node=trendNodes[index];
      if(change===null){node.textContent='—';node.className='trend trend-neutral';following[index].textContent='sem período anterior';return;}
      const positive=change>=0;node.textContent=`${positive?'↗':'↘'} ${number(Math.abs(change),1)}${index===1?' p.p.':'%'}`;node.className=`trend ${positive?'trend-up':'trend-down'}`;following[index].textContent='vs. período anterior';
    });
  }
  renderGoal(revenue);
  renderChannels(revenue, filtered?.current);
  renderProducts(revenue, filtered?.current);
  renderChart(revenue, importedRows, previousSummary?.revenue);
}

function renderGoal(revenue) {
  const percent = values.target > 0 ? Math.min(100, Math.round(revenue / values.target * 100)) : 0;
  const remaining = Math.max(0, values.target - revenue);
  const donut = document.querySelector('#goal-donut');
  donut.style.background = `conic-gradient(#208d70 0 ${percent}%, #eaf0ef ${percent}% 100%)`;
  donut.setAttribute('aria-label', `Meta demonstrativa atingida em ${percent} por cento`);
  document.querySelector('#goal-percent').textContent = `${percent}%`;
  document.querySelector('#goal-current').textContent = money(revenue);
  document.querySelector('#goal-target').textContent = money(values.target);
  document.querySelector('#goal-remaining').textContent = remaining ? `Faltam ${money(remaining)} para a meta` : 'Meta demonstrativa atingida';
}

function renderChannels(revenue, rows) {
  let channels=CHANNELS.map(channel=>({name:channel.name,share:channel.share,icon:channel.icon,className:channel.className,value:revenue*channel.value}));
  if(rows){
    const groups=new Map();
    rows.forEach(row=>{if(row.channel){const key=row.channel;groups.set(key,(groups.get(key)||0)+row.revenue);}});
    channels=[...groups].sort((a,b)=>b[1]-a[1]).map(([name,value],i)=>({name,share:revenue?Math.round(value/revenue*100):0,icon:name.slice(0,1).toUpperCase(),className:['channel-direct','channel-market','channel-social'][i%3],value}));
    if(!channels.length){document.querySelector('#channel-list').innerHTML='<p class="empty-data">Inclua uma coluna <code>canal</code> no CSV para dividir esta receita por origem.</p>';return;}
  }
  document.querySelector('#channel-list').innerHTML = channels.map(channel => `
    <div class="channel-row">
      <div class="channel-name"><span class="channel-icon ${channel.className}" aria-hidden="true">${escapeHtml(channel.icon)}</span>${escapeHtml(channel.name)}</div>
      <div class="channel-bar" role="img" aria-label="${channel.share}% da receita"><span style="width:${channel.share}%"></span></div>
      <div class="channel-value">${money(channel.value)}<small>${channel.share}% do total</small></div>
    </div>`).join('');
}

function renderProducts(revenue, rows) {
  let products=PRODUCTS.map(product=>({...product,value:revenue*product.share}));
  if(rows){
    const groups=new Map();
    rows.forEach(row=>{if(row.product){const prev=groups.get(row.product)||{value:0,units:0};prev.value+=row.revenue;prev.units+=row.orders;groups.set(row.product,prev);}});
    products=[...groups].sort((a,b)=>b[1].value-a[1].value).slice(0,4).map(([name,data],i)=>({name,detail:`${integer(data.units)} unidades`,value:data.value,share:revenue?data.value/revenue:0,monogram:name.slice(0,2).toUpperCase()}));
    if(!products.length){document.querySelector('#product-list').innerHTML='<p class="empty-data">Inclua uma coluna <code>produto</code> no CSV para mostrar os itens mais vendidos.</p>';return;}
  }
  document.querySelector('#product-list').innerHTML = products.map(product => `
    <div class="product-row">
      <span class="product-thumb" aria-hidden="true">${escapeHtml(product.monogram)}</span>
      <span class="product-meta"><strong>${escapeHtml(product.name)}</strong><small>${escapeHtml(product.detail)}</small></span>
      <span class="product-total">${money(product.value)}<small>${Math.round(product.share * 100)}% do total</small></span>
    </div>`).join('');
}

function renderChart(revenue, rows, previousRevenue) {
  const valuesNow = [0.23,0.32,0.27,0.39,0.34,0.49,0.43,0.56,0.48,0.62,0.53,0.68,0.61,0.75,0.67,0.81,0.75,0.92];
  const valuesBefore = [0.2,0.29,0.25,0.33,0.29,0.43,0.38,0.46,0.4,0.5,0.48,0.58,0.53,0.63,0.58,0.71,0.67,0.78];
  const width = 680, height = 180, left = 42, right = 10, top = 9, bottom = 17;
  const plotWidth = width-left-right, plotHeight=height-top-bottom;
  const scaled = arr => arr.map((v,i) => [left + i*plotWidth/(arr.length-1), top+(1-v)*plotHeight]);
  const makePath = pts => pts.map(([x,y],i)=>`${i?'L':'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  let actualValues=valuesNow, priorValues=valuesBefore;
  if(rows){
    const days=Number(document.querySelector('#period-select').value)||30;
    const end=Math.max(...rows.map(row=>row.date.getTime()));
    const start=new Date(end);start.setDate(start.getDate()-days+1);start.setHours(0,0,0,0);
    const byDay=new Map();rows.forEach(row=>{const key=localDateKey(row.date);byDay.set(key,(byDay.get(key)||0)+row.revenue);});
    const grouped=[];for(let i=0;i<days;i++){const date=new Date(start);date.setDate(date.getDate()+i);grouped.push(byDay.get(localDateKey(date))||0);}
    const max=Math.max(1,...grouped);actualValues=grouped.map(v=>v/max);
    priorValues=grouped.map((_,i)=>{const date=new Date(start);date.setDate(date.getDate()-days+i);return Math.min(.88,((byDay.get(localDateKey(date))||0)/max)||0);});
  }
  const points = scaled(actualValues), previous = scaled(priorValues);
  const area = `${makePath(points)} L ${points.at(-1)[0].toFixed(1)} ${(height-bottom).toFixed(1)} L ${left} ${(height-bottom).toFixed(1)} Z`;
  const current = money(revenue);
  const grid = [0,1,2,3].map(i => {
    const y = top + i*plotHeight/3;
    const label = money(revenue*(1-i/3),0).replace(',00','');
    return `<line class="chart-gridline" x1="${left}" y1="${y}" x2="${width-right}" y2="${y}"/><text class="chart-label" x="0" y="${y+3}">${label}</text>`;
  }).join('');
  document.querySelector('#revenue-chart').innerHTML = `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="area-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#4da98d" stop-opacity=".18"/><stop offset="1" stop-color="#4da98d" stop-opacity="0"/></linearGradient></defs>${grid}<path class="chart-area" d="${area}"/><path class="chart-previous" d="${makePath(previous)}"/><path class="chart-line" d="${makePath(points)}"/><circle class="chart-point" cx="${points.at(-1)[0]}" cy="${points.at(-1)[1]}" r="4"/></svg><span class="sr-only">Faturamento atual de ${current}; comparação visual com o período anterior.</span>`;
}

function parseCsv(text) {
  const separator=(text.split(/\r?\n/,1)[0].match(/;/g)||[]).length>(text.split(/\r?\n/,1)[0].match(/,/g)||[]).length?';':',';
  const records=[];let row=[],cell='',quoted=false;
  for(let i=0;i<text.length;i++){
    const char=text[i];
    if(char==='"'&&quoted&&text[i+1]==='"'){cell+='"';i++;}
    else if(char==='"'){quoted=!quoted;}
    else if(char===separator&&!quoted){row.push(cell);cell='';}
    else if((char==='\n'||char==='\r')&&!quoted){if(char==='\r'&&text[i+1]==='\n')i++;row.push(cell);cell='';if(row.some(value=>value.trim()))records.push(row);row=[];}
    else cell+=char;
  }
  if(cell.length||row.length){row.push(cell);records.push(row);}
  if(records.length<2)throw new Error('O arquivo precisa ter cabeçalho e pelo menos uma linha.');
  const normalize=value=>String(value).trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
  const headers=records[0].map(normalize);
  const find=(names)=>headers.findIndex(header=>names.includes(header));
  const cols={date:find(['data','date','dia']),revenue:find(['receita','faturamento','revenue','sales']),margin:find(['margem','margin']),orders:find(['pedidos','orders','quantidade']),channel:find(['canal','channel','origem']),product:find(['produto','product','item'])};
  if(cols.date<0||cols.revenue<0||cols.margin<0||cols.orders<0)throw new Error('Cabeçalho obrigatório: data, receita, margem e pedidos.');
  const parsed=[];
  for(const valuesRow of records.slice(1)){
    const rawDate=String(valuesRow[cols.date]||'').trim();
    const dateMatch=rawDate.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)||rawDate.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if(!dateMatch)continue;
    const date=dateMatch[1].length===4?new Date(+dateMatch[1],+dateMatch[2]-1,+dateMatch[3]):new Date(+dateMatch[3],+dateMatch[2]-1,+dateMatch[1]);
    const revenue=csvNumber(valuesRow[cols.revenue]),margin=csvNumber(valuesRow[cols.margin]),orders=csvNumber(valuesRow[cols.orders]);
    if(Number.isNaN(revenue)||Number.isNaN(margin)||Number.isNaN(orders)||revenue<0||orders<0||margin<0||margin>100)continue;
    parsed.push({date,revenue,margin,orders,channel:cols.channel<0?'':String(valuesRow[cols.channel]||'').trim(),product:cols.product<0?'':String(valuesRow[cols.product]||'').trim()});
  }
  if(!parsed.length)throw new Error('Nenhuma linha válida. Confira os números e as datas.');
  return parsed;
}
async function importCsv(event) {
  const file=event.currentTarget.files?.[0];if(!file)return;
  try{
    const rows=parseCsv(await file.text());
    importedRows=rows;
    const latest=new Date(Math.max(...rows.map(row=>row.date.getTime())));
    document.querySelector('#last-updated').textContent=`CSV local · ${rows.length} linhas`;
    renderMetrics();
    showToast(`${rows.length} linhas lidas. Dados mantidos apenas nesta página.`);
  }catch(error){showToast(error.message||'Não foi possível ler o CSV.');}
  event.currentTarget.value='';
}

function openEditor() {
  const imported=csvRowsForPeriod();
  const summary=imported?summarizeRows(imported.current):null;
  document.querySelector('#input-revenue').value = summary?summary.revenue:values.revenue;
  document.querySelector('#input-margin').value = summary?(summary.marginBase?summary.marginWeighted/summary.marginBase:0):values.margin;
  document.querySelector('#input-orders').value = summary?summary.orders:values.orders;
  document.querySelector('#input-target').value = values.target;
  document.querySelector('#edit-dialog').showModal();
}
function showToast(message) {
  const toast = document.querySelector('#toast');
  toast.textContent = message;
  toast.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 2600);
}
function saveEditor(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity()) return;
  values = {
    revenue: Number(document.querySelector('#input-revenue').value),
    margin: Number(document.querySelector('#input-margin').value),
    orders: Number(document.querySelector('#input-orders').value),
    target: Number(document.querySelector('#input-target').value),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(values));
  importedRows=null;
  document.querySelector('#last-updated').textContent='Edição local · neste navegador';
  renderMetrics();
  document.querySelector('#edit-dialog').close();
  showToast('Indicadores atualizados neste navegador.');
}
function resetEditor() {
  values = { ...BASE };
  importedRows=null;
  document.querySelector('#last-updated').textContent='Exemplo restaurado';
  localStorage.removeItem(STORAGE_KEY);
  renderMetrics();
  openEditor();
  showToast('Exemplo restaurado.');
}
function exportCsv() {
  const period = currentPeriod();
  const filtered=csvRowsForPeriod();
  const summary=filtered?summarizeRows(filtered.current):null;
  const revenue=summary?summary.revenue:values.revenue*period.multiplier;
  const orders=summary?summary.orders:Math.round(values.orders*period.multiplier);
  const margin=summary?(summary.marginBase?summary.marginWeighted/summary.marginBase:0):values.margin;
  const rows = [
    ['Indicador','Valor','Observação'],
    ['Período selecionado',document.querySelector('#period-select').selectedOptions[0].text,'Demonstração'],
    ['Faturamento (BRL)',Math.round(revenue),importedRows?'Importado localmente':'Fictício'],
    ['Margem de lucro (%)',number(margin),importedRows?'Média ponderada pela receita':'Fictício'],
    ['Pedidos',orders,importedRows?'Importado localmente':'Fictício'],
    ['Ticket médio (BRL)',(revenue/Math.max(1,orders)).toFixed(2),'Calculado como faturamento ÷ pedidos'],
    ['Meta mensal (BRL)',values.target,'Fictício'],
  ];
  const csv = '\uFEFF'+rows.map(row=>row.map(value=>`"${String(value).replaceAll('"','""')}"`).join(';')).join('\n');
  const link=document.createElement('a');
  link.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  link.download='lumen-indicadores-demonstracao.csv';
  link.click();URL.revokeObjectURL(link.href);
  showToast('CSV demonstrativo baixado.');
}
function switchView(view) {
  const labels={overview:['Resumo do negócio','Acompanhe os indicadores que ajudam a decidir o próximo passo.'],revenue:['Faturamento','Compare a receita por período e canal.'],products:['Produtos','Veja os itens demonstrativos com maior participação na receita.']};
  const [title,subtitle]=labels[view]||labels.overview;
  document.querySelector('#page-title').textContent=title;
  document.querySelector('#page-subtitle').textContent=subtitle;
  document.querySelector('#breadcrumb-current').textContent=title;
  document.querySelectorAll('.nav-item').forEach(button=>{
    const active=button.dataset.view===view;
    button.classList.toggle('is-active',active);
    if(active)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');
  });
  const target=view==='revenue'?document.querySelector('.revenue-panel'):view==='products'?document.querySelector('.products-panel'):document.querySelector('.page-heading');
  target.scrollIntoView({behavior:'smooth',block:'start'});
}

document.querySelector('#period-select').addEventListener('change',renderMetrics);
document.querySelector('#today-label').textContent=new Intl.DateTimeFormat('pt-BR',{weekday:'long',day:'2-digit',month:'long'}).format(new Date()).toLocaleUpperCase('pt-BR');
document.querySelector('#last-updated').textContent=`Demonstração · ${new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'short'}).format(new Date()).replace('.','')}`;
document.querySelector('#import-csv').addEventListener('click',()=>document.querySelector('#csv-file').click());
document.querySelector('#csv-file').addEventListener('change',importCsv);
document.querySelector('#export-csv').addEventListener('click',exportCsv);
document.querySelector('#edit-data').addEventListener('click',openEditor);
document.querySelector('#edit-form').addEventListener('submit',saveEditor);
document.querySelector('#reset-demo').addEventListener('click',resetEditor);
document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>switchView(button.dataset.view)));
document.querySelector('#notice-close').addEventListener('click',()=>document.querySelector('.demo-notice').remove());
document.querySelector('#help-button').addEventListener('click',()=>showToast('Valores ilustrativos. Troque pelos dados autorizados no modo Editar dados.'));
renderMetrics();
