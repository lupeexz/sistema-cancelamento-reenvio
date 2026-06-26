// ============================================================
//  lucro-config.js — Configurações de Lucro
//  Gerencia chaves de API e custos de produtos
// ============================================================

const LUCRO_KEYS_KEY    = "lucro_api_keys_v1";
const LUCRO_PRODUCTS_KEY = "lucro_products_v1";

// ── Utilidades de storage ────────────────────────────────────

function loadKeys() {
  try { return JSON.parse(localStorage.getItem(LUCRO_KEYS_KEY) || "{}"); }
  catch { return {}; }
}

function saveKeys(keys) {
  localStorage.setItem(LUCRO_KEYS_KEY, JSON.stringify(keys));
}

function loadProducts() {
  try { return JSON.parse(localStorage.getItem(LUCRO_PRODUCTS_KEY) || "[]"); }
  catch { return []; }
}

function saveProducts(products) {
  localStorage.setItem(LUCRO_PRODUCTS_KEY, JSON.stringify(products));
}

// ── Produtos em memória ──────────────────────────────────────

let products = loadProducts(); // [{sku, name, cost}]

// ── Render tabela de produtos ────────────────────────────────

function renderProducts(filter = "") {
  const body   = $("prodTableBody");
  const empty  = $("prodEmpty");
  const wrap   = $("prodTableWrap");
  const query  = filter.toLowerCase();

  const filtered = products.filter(p =>
    !query ||
    (p.name || "").toLowerCase().includes(query) ||
    (p.sku  || "").toLowerCase().includes(query)
  );

  if (products.length === 0) {
    empty.classList.remove("hidden");
    wrap.classList.add("hidden");
    return;
  }

  empty.classList.add("hidden");
  wrap.classList.remove("hidden");

  body.innerHTML = filtered.map((p, i) => {
    const realIdx = products.indexOf(p);
    return `
    <tr>
      <td><span class="badge">${escapeHtml(p.sku || "—")}</span></td>
      <td>${escapeHtml(p.name)}</td>
      <td>
        <input
          type="text"
          class="prod-cost-input"
          data-idx="${realIdx}"
          value="${p.cost !== undefined && p.cost !== "" ? String(p.cost).replace(".", ",") : ""}"
          placeholder="0,00"
          style="width:140px"
        />
      </td>
      <td>
        <button class="secondary" style="padding:4px 10px;font-size:12px" onclick="removeProduct(${realIdx})">✕</button>
      </td>
    </tr>`;
  }).join("");
}

function removeProduct(idx) {
  products.splice(idx, 1);
  renderProducts($("searchProd").value);
}

// ── Salvar custos da tabela ──────────────────────────────────

function collectCostsFromTable() {
  document.querySelectorAll(".prod-cost-input").forEach(input => {
    const idx  = Number(input.dataset.idx);
    const raw  = input.value.trim().replace(",", ".");
    if (products[idx]) products[idx].cost = raw !== "" ? parseFloat(raw) || 0 : "";
  });
}

// ── Adicionar produto manual ─────────────────────────────────

function addManualProduct() {
  const sku  = prompt("SKU do produto (pode deixar vazio):", "") ?? "";
  const name = prompt("Nome do produto:", "");
  if (name === null) return;
  if (!name.trim()) { alert("Nome obrigatório."); return; }
  products.push({ sku: sku.trim(), name: name.trim(), cost: "" });
  renderProducts($("searchProd").value);
}

// ── Mensagens ────────────────────────────────────────────────

function showMsg(id, text, isError = false) {
  const el = $(id);
  if (!el) return;
  el.textContent  = text;
  el.className    = "message " + (isError ? "error" : "ok");
  el.classList.remove("hidden");
  setTimeout(() => { el.textContent = ""; el.className = "message"; }, 4000);
}

// ── Inicialização ────────────────────────────────────────────

function init() {
  requireAuth();

  // Preenche campos de chaves
  const keys = loadKeys();
  $("yampiAlias").value  = keys.yampiAlias  || "";
  $("yampiToken").value  = keys.yampiToken  || "";
  $("yampiSecret").value = keys.yampiSecret || "";
  $("blingKey").value    = keys.blingKey    || "";

  renderProducts();

  // Busca
  $("searchProd").addEventListener("input", e => renderProducts(e.target.value));

  // Salvar chaves
  $("btnSaveKeys").addEventListener("click", () => {
    const keys = {
      yampiAlias:  $("yampiAlias").value.trim(),
      yampiToken:  $("yampiToken").value.trim(),
      yampiSecret: $("yampiSecret").value.trim(),
      blingKey:    $("blingKey").value.trim(),
    };
    saveKeys(keys);
    showMsg("keysMessage", "Chaves salvas com sucesso.");
  });

  // Testar Yampi
  $("btnTestYampi").addEventListener("click", async () => {
    const keys = loadKeys();
    if (!keys.yampiAlias || !keys.yampiToken) {
      showMsg("keysMessage", "Preencha o Alias e o Token da Yampi antes.", true);
      return;
    }
    $("btnTestYampi").disabled = true;
    $("btnTestYampi").textContent = "Testando…";
    try {
      const url = `https://api.yampi.com.br/v2/${keys.yampiAlias}/orders?limit=1`;
      const res = await fetch(url, {
        headers: {
          "User-Token": keys.yampiToken,
          "User-Secret-Key": keys.yampiSecret || "",
        }
      });
      if (res.ok) {
        showMsg("keysMessage", "✅ Conexão com a Yampi OK!");
      } else {
        const body = await res.json().catch(() => ({}));
        showMsg("keysMessage", `Erro ${res.status}: ${body.message || "Verifique suas credenciais."}`, true);
      }
    } catch (err) {
      showMsg("keysMessage", "Erro de rede. Verifique se há proxy/CORS bloqueando.", true);
    } finally {
      $("btnTestYampi").disabled = false;
      $("btnTestYampi").textContent = "Testar Yampi";
    }
  });

  // Importar produtos do Bling
  $("btnSyncBling").addEventListener("click", async () => {
    const keys = loadKeys();
    if (!keys.blingKey) {
      showMsg("keysMessage", "Preencha a API Key do Bling antes.", true);
      return;
    }
    $("btnSyncBling").disabled = true;
    $("btnSyncBling").textContent = "Importando…";
    try {
      await fetchBlingProducts(keys.blingKey);
      renderProducts($("searchProd").value);
      showMsg("keysMessage", `✅ ${products.length} produtos importados do Bling.`);
    } catch (err) {
      showMsg("keysMessage", `Erro ao importar do Bling: ${err.message}`, true);
    } finally {
      $("btnSyncBling").disabled = false;
      $("btnSyncBling").textContent = "Importar produtos do Bling";
    }
  });

  // Salvar custos
  $("btnSaveCosts").addEventListener("click", () => {
    collectCostsFromTable();
    saveProducts(products);
    showMsg("costsMessage", "Custos salvos com sucesso.");
  });

  // Adicionar manual
  $("btnAddProd").addEventListener("click", addManualProduct);

  // Âncora #produtos ao carregar
  if (window.location.hash === "#produtos") {
    setTimeout(() => $("produtos")?.scrollIntoView({ behavior: "smooth" }), 200);
  }
}

// ── Busca produtos do Bling (V3) ─────────────────────────────

async function fetchBlingProducts(apiKey) {
  let page = 1;
  const all = [];

  while (true) {
    const res = await fetch(
      `https://www.bling.com.br/Api/v3/produtos?pagina=${page}&limite=100&situacao=A`,
      { headers: { Authorization: `Bearer ${apiKey}` } }
    );

    if (res.status === 401) throw new Error("API Key inválida ou sem permissão.");
    if (!res.ok)           throw new Error(`Bling retornou ${res.status}.`);

    const data = await res.json();
    const items = data?.data || [];
    if (!items.length) break;

    items.forEach(item => {
      const sku  = String(item.codigo || "").trim();
      const name = String(item.nome   || "").trim();
      if (!name) return;

      // Mantém custo já cadastrado se SKU bater
      const existing = products.find(p => p.sku === sku && sku !== "");
      if (existing) {
        // Atualiza nome mas preserva custo
        const idx = products.indexOf(existing);
        products[idx].name = name;
      } else {
        all.push({ sku, name, cost: "" });
      }
    });

    if (items.length < 100) break;
    page++;
  }

  // Adiciona novos ao array
  all.forEach(p => products.push(p));
  saveProducts(products);
}

// ── Boot ─────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", init);
