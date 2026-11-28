(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const views = {
    overview: { label: "Visão geral", title: "A operação em um só lugar", subtitle: "Produção, estoque e pedidos para o time decidir o próximo passo com clareza." },
    production: { label: "Produção", title: "Produção do turno", subtitle: "Acompanhe lotes, etapas e previsão de saída." },
    inventory: { label: "Estoque", title: "Estoque da unidade", subtitle: "Insumos e embalagens com limites de reposição configuráveis." },
    orders: { label: "Pedidos", title: "Pedidos da semana", subtitle: "Separe o que está pronto e veja o que depende da produção." },
    customers: { label: "Clientes", title: "Clientes da unidade", subtitle: "Uma visão simples da carteira fictícia desta demonstração." },
    reports: { label: "Relatórios", title: "Relatórios operacionais", subtitle: "Indicadores simulados para organizar a conversa sobre dados." },
  };
  const defaults = { unitName: "Casa Brava", goal: 1100 };
  let settings = { ...defaults };
  try {
    const stored = JSON.parse(localStorage.getItem("casa-brava-demo-settings") || "null");
    if (stored && typeof stored === "object") settings = { ...settings, ...stored };
  } catch { /* the demo remains usable when storage is disabled */ }

  function showToast(message) {
    const toast = $("#toast");
    toast.textContent = message;
    toast.classList.add("is-visible");
    clearTimeout(showToast.timeout);
    showToast.timeout = setTimeout(() => toast.classList.remove("is-visible"), 2800);
  }

  function showView(name) {
    const view = views[name] ? name : "overview";
    $$("[data-screen]").forEach((panel) => {
      panel.hidden = panel.dataset.screen !== view;
      panel.classList.toggle("is-visible", panel.dataset.screen === view);
    });
    $$(".nav-item[data-view]").forEach((button) => {
      const active = button.dataset.view === view;
      button.classList.toggle("is-active", active);
      if (active) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });
    $("#breadcrumb").textContent = views[view].label;
    $("#page-title").textContent = views[view].title;
    $("#page-subtitle").textContent = views[view].subtitle;
    const newOrder = $("#new-order");
    newOrder.hidden = !["overview", "orders"].includes(view);
    if (view === "orders") $("#order-search")?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }

  function updateSettings() {
    const cleanName = String(settings.unitName || defaults.unitName).trim().slice(0, 36) || defaults.unitName;
    const goal = Math.max(100, Math.min(99999, Number(settings.goal) || defaults.goal));
    settings = { unitName: cleanName, goal };
    $("#brand-name").textContent = cleanName.toLowerCase();
    $$(".avatar").forEach((avatar) => {
      if (["CB", "LM"].includes(avatar.textContent.trim())) avatar.textContent = cleanName.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
    });
    $$(".metric-foot").forEach((foot) => {
      if (foot.textContent.includes("meta fictícia")) foot.innerHTML = `<span class="trend trend-good">No ritmo</span><span>meta de exemplo: ${goal.toLocaleString("pt-BR")}</span>`;
    });
    const percent = Math.min(100, Math.round((842 / goal) * 100));
    $(".donut").style.background = `conic-gradient(#789477 0 ${percent}%,#e9eee7 ${percent}% 100%)`;
    $(".donut").setAttribute("aria-label", `${percent} por cento da meta demonstrativa concluída`);
    $(".donut strong").textContent = `${percent}%`;
    const shiftMeta = $(".shift-summary > div:last-child strong");
    if (shiftMeta) shiftMeta.innerHTML = `842 <small>/ ${goal.toLocaleString("pt-BR")} un.</small>`;
    try { localStorage.setItem("casa-brava-demo-settings", JSON.stringify(settings)); } catch { /* local editing still works for this page view */ }
  }

  function openDialog(dialog) {
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  }

  function closeDialog(dialog) {
    if (typeof dialog.close === "function") dialog.close();
    else dialog.removeAttribute("open");
  }

  function openSettings() {
    $("#unit-name-input").value = settings.unitName;
    $("#unit-goal-input").value = settings.goal;
    openDialog($("#unit-dialog"));
  }

  $$(".nav-item[data-view]").forEach((button) => button.addEventListener("click", () => showView(button.dataset.view)));
  $$("[data-open-view]").forEach((button) => button.addEventListener("click", () => showView(button.dataset.openView)));
  $("#edit-unit").addEventListener("click", openSettings);
  $("#top-edit-unit").addEventListener("click", openSettings);
  $("#unit-form").addEventListener("submit", (event) => {
    event.preventDefault();
    settings.unitName = $("#unit-name-input").value;
    settings.goal = Number($("#unit-goal-input").value);
    updateSettings();
    closeDialog($("#unit-dialog"));
    showToast("Nome e meta salvos só neste navegador.");
  });
  $$("[data-close-dialog]").forEach((button) => button.addEventListener("click", () => closeDialog(button.closest("dialog"))));
  $$("dialog").forEach((dialog) => dialog.addEventListener("click", (event) => {
    if (event.target === dialog) closeDialog(dialog);
  }));

  const orderDialog = $("#order-dialog");
  function newOrder() {
    openDialog(orderDialog);
    $("#customer-input").focus();
  }
  $("#new-order").addEventListener("click", newOrder);
  $$("[data-new-order]").forEach((button) => button.addEventListener("click", newOrder));
  $("#order-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const customer = $("#customer-input").value.trim();
    const boxes = Math.max(1, Number($("#boxes-input").value) || 1);
    const id = `#CB-${2490 + $$("#all-orders-table tr").length}`;
    const row = document.createElement("tr");
    row.innerHTML = `<td><strong>${id}</strong><small>adicionado agora · exemplo local</small></td><td></td><td>${boxes} caixas</td><td>Data a combinar</td><td><span class="status status-neutral">Rascunho</span></td>`;
    row.children[1].textContent = customer;
    $("#all-orders-table").prepend(row);
    const overviewRow = document.createElement("tr");
    overviewRow.innerHTML = `<td><strong>${id}</strong><small>${boxes} caixas · valor não informado</small></td><td></td><td>A combinar</td><td><span class="status status-neutral">Rascunho local</span></td>`;
    overviewRow.children[1].textContent = customer;
    $("#orders-table").prepend(overviewRow);
    closeDialog(orderDialog);
    $("#order-form").reset();
    $("#boxes-input").value = "4";
    showToast("Pedido incluído no exemplo local. Nada foi enviado a um sistema real.");
  });

  $$("#new-batch, #new-stock").forEach((button) => button.addEventListener("click", () => showToast("Ação simulada. O protótipo não grava dados em um ERP.")));
  $$("[data-toast]").forEach((button) => button.addEventListener("click", () => showToast(button.dataset.toast)));
  $("#help-button").addEventListener("click", () => showToast("Protótipo estático; não conectado a banco de dados ou API."));
  $("#notice-close").addEventListener("click", () => $(".demo-notice").remove());

  $("#period-select").addEventListener("change", (event) => {
    const monthly = event.target.value === "30";
    const current = monthly ? [52, 61, 47, 70, 66, 58, 81] : [65, 72, 59, 81, 76, 52, 61];
    const prior = monthly ? [43, 49, 46, 57, 54, 61, 62] : [47, 53, 45, 60, 50, 38, 44];
    $$(".bar.current").forEach((bar, i) => bar.style.setProperty("--bar", `${current[i]}%`));
    $$(".bar.prior").forEach((bar, i) => bar.style.setProperty("--bar", `${prior[i]}%`));
    $(".chart-summary > span:nth-child(2)").textContent = monthly ? "produção no período selecionado · exemplo" : "produzidas no período selecionado";
    $(".chart-summary > strong").innerHTML = monthly ? "22.418 <small>unid.</small>" : "5.942 <small>unid.</small>";
    showToast(`Período de ${monthly ? "30" : "7"} dias selecionado · valores fictícios.`);
  });

  function exportCsv() {
    const lines = [["Pedido", "Cliente", "Itens", "Entrega", "Status"]];
    $$("#all-orders-table tr").forEach((row) => lines.push($$("td", row).map((cell) => cell.innerText.replace(/\s+/g, " ").trim())));
    const csv = lines.map((line) => line.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(";")).join("\r\n");
    const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "pedidos-casa-brava-demo.csv";
    anchor.click();
    URL.revokeObjectURL(url);
    showToast("CSV fictício baixado localmente.");
  }
  $("#export-orders").addEventListener("click", exportCsv);
  $("#report-export").addEventListener("click", exportCsv);
  $("#order-search").addEventListener("input", (event) => {
    const query = event.target.value.trim().toLocaleLowerCase("pt-BR");
    $$("#all-orders-table tr").forEach((row) => { row.hidden = !row.textContent.toLocaleLowerCase("pt-BR").includes(query); });
  });
  $("#reset-demo").addEventListener("click", () => {
    try { localStorage.removeItem("casa-brava-demo-settings"); } catch { /* ignored */ }
    location.reload();
  });

  updateSettings();
})();

