const $ = (id) => document.getElementById(id);

let allRecords = [];

document.addEventListener("DOMContentLoaded", () => {
  bindAuth();

  if (sessionStorage.getItem(CONFIG.SESSION_KEY) === "true") {
    showSystem();
  }

  if ($("entryForm")) bindFormPage();
  if ($("recordsBody")) bindDashboardPage();
});

function bindAuth() {
  $("loginForm")?.addEventListener("submit", handleLogin);
  $("logoutBtn")?.addEventListener("click", handleLogout);
}

function bindFormPage() {
  $("entryForm").addEventListener("submit", handleSubmit);
  $("tipo").addEventListener("change", syncRequiredFields);
  syncRequiredFields();
}

function bindDashboardPage() {
  $("refreshBtn")?.addEventListener("click", loadDashboard);

  $("filterMode")?.addEventListener("change", () => {
    const mode = $("filterMode").value;
    $("filterDateWrap").classList.toggle("hidden", mode !== "day");
    $("filterMonthWrap").classList.toggle("hidden", mode !== "month");
    renderDashboard();
  });

  ["filterDate", "filterMonth", "filterType"].forEach((id) => {
    $(id)?.addEventListener("input", renderDashboard);
    $(id)?.addEventListener("change", renderDashboard);
  });
}

function syncRequiredFields() {
  const isReenvio = $("tipo").value === "Reenvio";
  $("dataReenvio").required = isReenvio;
  $("novoCodigoRastreio").required = isReenvio;
}

async function handleLogin(event) {
  event.preventDefault();

  const password = $("passwordInput").value;
  const hash = await sha256(password);

  if (hash !== CONFIG.PASSWORD_SHA256) {
    $("loginError").classList.remove("hidden");
    return;
  }

  sessionStorage.setItem(CONFIG.SESSION_KEY, "true");
  showSystem();
}

function handleLogout() {
  sessionStorage.removeItem(CONFIG.SESSION_KEY);
  $("systemScreen").classList.add("hidden");
  $("loginScreen").classList.remove("hidden");
}

function showSystem() {
  $("loginScreen").classList.add("hidden");
  $("systemScreen").classList.remove("hidden");

  if ($("recordsBody")) {
    loadDashboard();
  }
}

async function handleSubmit(event) {
  event.preventDefault();

  if (!CONFIG.WEB_APP_URL || CONFIG.WEB_APP_URL.includes("COLE_AQUI")) {
    setMessage("Configure a URL do Google Apps Script no arquivo config.js.", "error");
    return;
  }

  const payload = {
    action: "create",
    token: CONFIG.FORM_TOKEN,
    website: $("website").value,
    tipo: $("tipo").value,
    loja: $("loja").value.trim(),
    dataPedido: $("dataPedido").value,
    motivo: $("motivo").value.trim(),
    fretesEstorno: $("fretesEstorno").value.trim(),
    numeroPedido: $("numeroPedido").value.trim(),
    whatsapp: normalizeWhatsapp($("whatsapp").value),
    novoCodigoRastreio: $("novoCodigoRastreio").value.trim(),
    dataReenvio: $("dataReenvio").value
  };

  const required = ["tipo", "loja", "dataPedido", "motivo", "numeroPedido", "whatsapp"];
  for (const field of required) {
    if (!payload[field]) {
      setMessage("Preencha todos os campos obrigatórios.", "error");
      return;
    }
  }

  if (payload.tipo === "Reenvio" && (!payload.dataReenvio || !payload.novoCodigoRastreio)) {
    setMessage("Para Reenvio, informe Data Reenvio e Novo Código de Rastreio.", "error");
    return;
  }

  $("submitBtn").disabled = true;
  setMessage("Salvando...", "");

  try {
    const response = await fetch(CONFIG.WEB_APP_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (!result.ok && !result.success) {
      throw new Error(result.error || result.message || "Erro ao salvar.");
    }

    $("entryForm").reset();
    syncRequiredFields();
    setMessage("Registro salvo com sucesso.", "ok");
  } catch (error) {
    setMessage(error.message || "Falha ao enviar os dados.", "error");
  } finally {
    $("submitBtn").disabled = false;
  }
}

async function loadDashboard() {
  if (!CONFIG.WEB_APP_URL || CONFIG.WEB_APP_URL.includes("COLE_AQUI")) return;

  try {
    const url = new URL(CONFIG.WEB_APP_URL);
    url.searchParams.set("action", "list");
    url.searchParams.set("token", CONFIG.FORM_TOKEN);

    const response = await fetch(url.toString());
    const result = await response.json();

    if (!result.ok && !result.success) {
      throw new Error(result.error || result.message || "Erro ao carregar dashboard.");
    }

    allRecords = result.records || [];
    renderDashboard();
  } catch (error) {
    console.error(error);
    if ($("recordsBody")) {
      $("recordsBody").innerHTML = `<tr><td colspan="10">Erro ao carregar dados: ${escapeHtml(error.message)}</td></tr>`;
    }
  }
}

function renderDashboard() {
  if (!$("recordsBody")) return;

  const filtered = getFilteredRecords();

  $("statCancelamento").textContent = filtered.filter((r) => r.tipo === "Cancelamento").length;
  $("statReenvio").textContent = filtered.filter((r) => r.tipo === "Reenvio").length;
  $("statTotal").textContent = filtered.length;

  renderCharts(filtered);

  const rows = filtered
    .sort((a, b) => String(b.criadoEm).localeCompare(String(a.criadoEm)))
    .map((r) => `
      <tr>
        <td><span class="tag ${r.tipo === "Reenvio" ? "tag-blue" : "tag-orange"}">${escapeHtml(r.tipo)}</span></td>
        <td>${escapeHtml(r.loja)}</td>
        <td>${formatDate(r.dataPedido)}</td>
        <td>${escapeHtml(r.motivo)}</td>
        <td>${escapeHtml(r.fretesEstorno)}</td>
        <td>${escapeHtml(r.numeroPedido)}</td>
        <td>${escapeHtml(r.whatsapp)}</td>
        <td>${escapeHtml(r.novoCodigoRastreio)}</td>
        <td>${formatDate(r.dataReenvio)}</td>
        <td>${formatDateTime(r.criadoEm)}</td>
      </tr>
    `).join("");

  $("recordsBody").innerHTML = rows || `<tr><td colspan="10">Nenhum registro encontrado para o filtro.</td></tr>`;
}

function getFilteredRecords() {
  const mode = $("filterMode")?.value || "all";
  const type = $("filterType")?.value || "all";
  const filterDate = $("filterDate")?.value || "";
  const filterMonth = $("filterMonth")?.value || "";

  return allRecords.filter((record) => {
    if (type !== "all" && record.tipo !== type) return false;

    const recordDate = record.dataPedido || "";
    if (mode === "day" && filterDate && recordDate !== filterDate) return false;
    if (mode === "month" && filterMonth && !recordDate.startsWith(filterMonth)) return false;

    return true;
  });
}

function renderCharts(records) {
  drawBarChart("chartTipo", [
    ["Cancelamento", records.filter((r) => r.tipo === "Cancelamento").length],
    ["Reenvio", records.filter((r) => r.tipo === "Reenvio").length]
  ]);

  drawBarChart("chartLojas", topCounts(records, "loja", 5));
  drawBarChart("chartMotivos", topCounts(records, "motivo", 5));
}

function topCounts(records, key, limit) {
  const counts = new Map();
  records.forEach((record) => {
    const value = String(record[key] || "Não informado").trim() || "Não informado";
    counts.set(value, (counts.get(value) || 0) + 1);
  });

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
}

function drawBarChart(canvasId, items) {
  const canvas = $(canvasId);
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  const padding = 34;
  const labelWidth = 120;
  const barGap = 14;
  const barHeight = 28;

  ctx.clearRect(0, 0, width, height);
  ctx.font = "13px system-ui, -apple-system, Segoe UI, sans-serif";

  if (!items.length || items.every((item) => item[1] === 0)) {
    ctx.fillStyle = "#64748b";
    ctx.fillText("Sem dados para o filtro selecionado.", padding, height / 2);
    return;
  }

  const max = Math.max(...items.map((item) => item[1]), 1);
  const chartWidth = width - padding * 2 - labelWidth;
  const startX = padding + labelWidth;
  let y = padding;

  items.forEach(([label, value], index) => {
    const safeLabel = label.length > 18 ? label.slice(0, 18) + "..." : label;
    const barWidth = Math.max((value / max) * chartWidth, value > 0 ? 8 : 0);

    ctx.fillStyle = "#334155";
    ctx.fillText(safeLabel, padding, y + 20);

    ctx.fillStyle = index % 2 === 0 ? "#2563eb" : "#0f766e";
    ctx.fillRect(startX, y, barWidth, barHeight);

    ctx.fillStyle = "#0f172a";
    ctx.fillText(String(value), startX + barWidth + 8, y + 20);

    y += barHeight + barGap;
  });
}

function normalizeWhatsapp(value) {
  return String(value || "").replace(/[^\d+]/g, "").slice(0, 30);
}

function setMessage(text, type) {
  const element = $("formMessage");
  if (!element) return;
  element.textContent = text;
  element.className = `message ${type || ""}`.trim();
}

function formatDate(value) {
  if (!value) return "";
  const [year, month, day] = String(value).slice(0, 10).split("-");
  if (!year || !month || !day) return escapeHtml(value);
  return `${day}/${month}/${year}`;
}

function formatDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return escapeHtml(value);
  return date.toLocaleString("pt-BR");
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function sha256(text) {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
