// ============================================================
//  lucro.js — Análise de Lucro
//  Puxa pedidos da Yampi, cruza com custos cadastrados
// ============================================================

const LUCRO_KEYS_KEY     = "lucro_api_keys_v1";
const LUCRO_PRODUCTS_KEY = "lucro_products_v1";
const LUCRO_ORDERS_KEY   = "lucro_orders_cache_v1";
const LUCRO_ORDERS_TTL   = 10 * 60 * 1000; // 10 min

const STATUS_LABELS = {
  approved:  { label: "Aprovado",   cls: "pill-ok"      },
  sent:      { label: "Enviado",    cls: "pill-ok"       },
  delivered: { label: "Entregue",   cls: "pill-ok"       },
  canceled:  { label: "Cancelado",  cls: "pill-danger"   },
  pending:   { label: "Pendente",   cls: ""              },
  waiting_payment: { label: "Aguard. pgto", cls: "" },
};

const PAGE_SIZE = 50;
let allOrders   = [];   // pedidos filtrados atualmente
let currentPage = 1;

// ── Storage helpers ──────────────────────────────────────────

function loadKeys() {
  try { return JSON.parse(localStorage.getItem(LUCRO_KEYS_KEY) || "{}"); }
  catch { return {}; }
}

function loadProducts() {
  try { return JSON.parse(localStorage.getItem(LUCRO_PRODUCTS_KEY) || "[]"); }
  catch { return []; }
}

function loadOrdersCache() {
  try {
    const raw = JSON.parse(localStorage.getItem(LUCRO_ORDERS_KEY) || "{}");
    if (!raw.time || Date.now() - raw.time > LUCRO_ORDERS_TTL) return null;
    return raw.orders || null;
  } catch { return null; }
}

function saveOrdersCache(orders) {
  localStorage.setItem(LUCRO_ORDERS_KEY, JSON.stringify({ time: Date.now(), orders }));
}

// ── Yampi API ────────────────────────────────────────────────

async function fetchYampiOrders(alias, token, secret, dateFrom, dateTo) {
  const all = [];
  let page  = 1;

  while (true) {
    const params = new URLSearchParams({
      limit: 100,
      page,
      include: "items",
    });
    if (dateFrom) params.set("date_from", dateFrom);
    if (dateTo)   params.set("date_to",   dateTo);

    const res = await fetch(
      `https://api.yampi.com.br/v2/${alias}/orders?${params}`,
      {
        headers: {
          "User-Token":      token,
          "User-Secret-Key": secret || "",
        }
      }
    );

    if (res.status === 401) throw new Error("Credenciais Yampi inválidas. Verifique em Configurações.");
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(`Yampi retornou ${res.status}: ${body.message || "erro desconhecido"}.`);
    }

    const data  = await res.json();
    const items = data?.data?.data || data?.data || [];
    if (!Array.isArray(items) || !items.length) break;

    all.push(...items);

    // Paginação
    const meta  = data?.data?.meta || data?.meta || {};
    const total = meta.total || 0;
    if (all.length >= total || items.length < 100) break;
    page++;
  }

  return all;
}

// ── Cálculo de lucro ─────────────────────────────────────────

function buildProductCostMap(products) {
  // Indexa por SKU (lower) e por nome normalizado
  const map = {};
  products.forEach(p => {
    const cost = parseFloat(String(p.cost || "0").replace(",", ".")) || 0;
    if (p.sku)  map[p.sku.toLowerCase().trim()]  = cost;
    if (p.name) map[p.name.toLowerCase().trim()] = cost;
  });
  return map;
}

function lookupCost(costMap, sku, name) {
  if (sku  && costMap[sku.toLowerCase().trim()]  !== undefined) return { cost: costMap[sku.toLowerCase().trim()],  found: true };
  if (name && costMap[name.toLowerCase().trim()] !== undefined) return { cost: costMap[name.toLowerCase().trim()], found: true };
  return { cost: 0, found: false };
}

function calcOrderProfit(order, costMap) {
  const items     = order.items?.data || order.items || [];
  const frete     = parseBRL(order.freight_value || order.shipping_value || 0);
  let   receita   = parseBRL(order.total || 0);
  let   custoProd = 0;
  const missing   = [];

  items.forEach(item => {
    const qty  = Number(item.quantity || 1);
    const sku  = String(item.sku  || item.product_sku  || "").trim();
    const name = String(item.name || item.product_name || "").trim();
    const { cost, found } = lookupCost(costMap, sku, name);
    custoProd += cost * qty;
    if (!found) missing.push(name || sku || "?");
  });

  const lucro  = receita - custoProd;
  const margem = receita > 0 ? (lucro / receita) * 100 : 0;

  return { frete, receita, custoProd, lucro, margem, missing };
}

// ── Filtros ──────────────────────────────────────────────────

function getDateRange() {
  const mode = $("filterPeriod").value;
  if (mode === "custom") {
    return { from: $("filterDateFrom").value, to: $("filterDateTo").value };
  }
  const days = Number(mode);
  const to   = new Date();
  const from = new Date(Date.now() - days * 86400000);
  return {
    from: from.toISOString().slice(0, 10),
    to:   to.toISOString().slice(0, 10),
  };
}

// ── Render tabela ────────────────────────────────────────────

function renderTable(orders) {
  const body      = $("tableBody");
  const count     = $("tableCount");
  const tableWrap = $("tableWrap");

  if (!orders.length) {
    tableWrap.classList.add("hidden");
    return;
  }

  tableWrap.classList.remove("hidden");
  count.textContent = `${orders.length} pedido${orders.length !== 1 ? "s" : ""}`;

  const start = (currentPage - 1) * PAGE_SIZE;
  const page  = orders.slice(start, start + PAGE_SIZE);

  const products = loadProducts();
  const costMap  = buildProductCostMap(products);

  body.innerHTML = page.map(order => {
    const { frete, receita, custoProd, lucro, margem } = calcOrderProfit(order, costMap);
    const lucroCls   = lucro >= 0 ? "color:var(--ok)" : "color:var(--danger)";
    const margemTxt  = margem.toFixed(1) + "%";
    const margemCls  = margem >= 30 ? "color:var(--ok)" : margem >= 10 ? "color:var(--warning)" : "color:var(--danger)";
    const statusKey  = String(order.status || "").toLowerCase();
    const statusInfo = STATUS_LABELS[statusKey] || { label: statusKey, cls: "" };
    const date       = formatDate((order.created_at || "").slice(0, 10));
    const customer   = escapeHtml(
      order.customer?.data?.name ||
      order.customer?.name ||
      order.billing?.name || "—"
    );
    const items = order.items?.data || order.items || [];
    const prodNames = items.slice(0, 2).map(i =>
      escapeHtml(i.name || i.product_name || "?")
    ).join(", ") + (items.length > 2 ? ` +${items.length - 2}` : "");

    return `
    <tr>
      <td><span class="badge">#${escapeHtml(String(order.number || order.id || "?"))}</span></td>
      <td>${date}</td>
      <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis">${customer}</td>
      <td style="max-width:220px;overflow:hidden;text-overflow:ellipsis;color:var(--muted)">${prodNames}</td>
      <td>${formatBRL(receita)}</td>
      <td>${formatBRL(custoProd)}</td>
      <td>${formatBRL(frete)}</td>
      <td style="${lucroCls};font-weight:700">${formatBRL(lucro)}</td>
      <td style="${margemCls}">${margemTxt}</td>
      <td><span class="badge ${statusInfo.cls}">${statusInfo.label}</span></td>
    </tr>`;
  }).join("");

  renderPagination(orders.length);
}

function renderPagination(total) {
  const bar       = $("paginationBar");
  const totalPages = Math.ceil(total / PAGE_SIZE);
  if (totalPages <= 1) { bar.innerHTML = ""; return; }

  let html = `<span style="color:var(--muted);font-size:12px;margin-right:8px">Página ${currentPage} de ${totalPages}</span>`;
  if (currentPage > 1) html += `<button class="secondary" style="padding:4px 12px;font-size:12px" onclick="goPage(${currentPage - 1})">← Ant.</button>`;
  if (currentPage < totalPages) html += `<button class="secondary" style="padding:4px 12px;font-size:12px" onclick="goPage(${currentPage + 1})">Próx. →</button>`;
  bar.innerHTML = html;
}

function goPage(n) {
  currentPage = n;
  renderTable(allOrders);
  $("tableWrap").scrollIntoView({ behavior: "smooth", block: "start" });
}

// ── KPIs ─────────────────────────────────────────────────────

function renderKPIs(orders) {
  const products = loadProducts();
  const costMap  = buildProductCostMap(products);

  let totalReceita = 0, totalCusto = 0, totalFrete = 0, totalLucro = 0;
  const missing = new Set();

  orders.forEach(order => {
    const { frete, receita, custoProd, lucro, missing: m } = calcOrderProfit(order, costMap);
    totalReceita += receita;
    totalCusto   += custoProd;
    totalFrete   += frete;
    totalLucro   += lucro;
    m.forEach(n => missing.add(n));
  });

  $("kpiPedidos").textContent = orders.length;
  $("kpiReceita").textContent = formatBRL(totalReceita);
  $("kpiCusto").textContent   = formatBRL(totalCusto);
  $("kpiFrete").textContent   = formatBRL(totalFrete);
  $("kpiLucro").textContent   = formatBRL(totalLucro);
  $("kpiLucro").style.color   = totalLucro >= 0 ? "var(--ok)" : "var(--danger)";

  // Produtos sem custo
  const missingWrap = $("missingCostWrap");
  const missingList = $("missingCostList");
  if (missing.size) {
    missingWrap.classList.remove("hidden");
    missingList.innerHTML = [...missing].map(n =>
      `<span class="pill pill-danger">${escapeHtml(n)}</span>`
    ).join("");
  } else {
    missingWrap.classList.add("hidden");
  }
}

// ── Estados de UI ────────────────────────────────────────────

function setState(state, msg = "") {
  ["stateEmpty","stateError","stateLoading","tableWrap","missingCostWrap"].forEach(id => {
    $(id)?.classList.add("hidden");
  });
  if (state === "empty")   $("stateEmpty").classList.remove("hidden");
  if (state === "error")   { $("stateError").classList.remove("hidden"); $("stateErrorMsg").textContent = msg; }
  if (state === "loading") $("stateLoading").classList.remove("hidden");
  if (state === "table")   renderTable(allOrders);
}

// ── Filtrar pedidos em cache ──────────────────────────────────

function applyFilters(orders) {
  const status = $("filterStatus").value;
  if (status === "all") return orders;
  return orders.filter(o => String(o.status || "").toLowerCase() === status);
}

// ── Sincronizar ──────────────────────────────────────────────

async function syncOrders(force = false) {
  const keys = loadKeys();
  if (!keys.yampiAlias || !keys.yampiToken) {
    setState("error", "Configure o Alias e o Token da Yampi em Configurações.");
    return;
  }

  const btn = $("btnSync");
  btn.disabled    = true;
  btn.textContent = "Carregando…";
  setState("loading");

  try {
    let orders;
    if (!force) {
      orders = loadOrdersCache();
    }

    if (!orders) {
      const { from, to } = getDateRange();
      orders = await fetchYampiOrders(keys.yampiAlias, keys.yampiToken, keys.yampiSecret, from, to);
      saveOrdersCache(orders);
    }

    allOrders   = applyFilters(orders);
    currentPage = 1;

    if (!allOrders.length) {
      setState("empty");
      $("kpiPedidos").textContent = "0";
    } else {
      setState("table");
      renderKPIs(allOrders);
    }

  } catch (err) {
    setState("error", err.message);
  } finally {
    btn.disabled    = false;
    btn.textContent = "Sincronizar pedidos";
  }
}

// ── Inicialização ────────────────────────────────────────────

function init() {
  requireAuth();

  // Período personalizado
  $("filterPeriod").addEventListener("change", e => {
    const custom = e.target.value === "custom";
    $("wrapDateFrom").classList.toggle("hidden", !custom);
    $("wrapDateTo").classList.toggle("hidden",   !custom);
  });

  $("btnSync").addEventListener("click", () => syncOrders(true));
  $("btnApplyFilter").addEventListener("click", () => syncOrders(true));

  // Tenta carregar do cache ao abrir
  const cached = loadOrdersCache();
  if (cached && cached.length) {
    allOrders = applyFilters(cached);
    currentPage = 1;
    setState("table");
    renderKPIs(allOrders);
  } else {
    setState("empty");
  }
}

document.addEventListener("DOMContentLoaded", init);
