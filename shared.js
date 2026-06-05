const $ = (id) => document.getElementById(id);

const RECORDS_CACHE_KEY = "reenvios_estornos_records_cache_v5";
const RECORDS_CACHE_TIME = 5 * 60 * 1000; // 5 minutos

function isAuthenticated() {
  return sessionStorage.getItem(CONFIG.SESSION_KEY) === "true";
}

function requireAuth() {
  if (!isAuthenticated()) window.location.href = "index.html";
}

function logout() {
  sessionStorage.removeItem(CONFIG.SESSION_KEY);
  window.location.href = "index.html";
}

async function sha256(text) {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function readCachedRecords() {
  try {
    const raw = localStorage.getItem(RECORDS_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed.records) ? parsed.records : [];
  } catch {
    localStorage.removeItem(RECORDS_CACHE_KEY);
    return [];
  }
}

function isCacheFresh() {
  try {
    const raw = localStorage.getItem(RECORDS_CACHE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return Date.now() - Number(parsed.time || 0) < RECORDS_CACHE_TIME;
  } catch {
    return false;
  }
}

function saveCachedRecords(records) {
  localStorage.setItem(
    RECORDS_CACHE_KEY,
    JSON.stringify({
      time: Date.now(),
      records: Array.isArray(records) ? records : [],
    })
  );
}

function clearRecordsCache() {
  localStorage.removeItem(RECORDS_CACHE_KEY);
}

async function fetchRecordsFromApi() {
  const url = new URL(CONFIG.WEB_APP_URL);
  url.searchParams.set("action", "list");
  url.searchParams.set("token", CONFIG.FORM_TOKEN);

  const response = await fetch(url.toString(), {
    method: "GET",
    cache: "no-store",
  });

  const result = await response.json();

  if (!result.ok && !result.success) {
    throw new Error(result.error || result.message || "Erro ao carregar dados.");
  }

  const records = result.records || [];
  saveCachedRecords(records);
  return records;
}

async function apiGetRecords(options = {}) {
  const force = Boolean(options.force);
  const background = Boolean(options.background);

  if (!force) {
    const cached = readCachedRecords();

    if (cached.length) {
      if (!isCacheFresh() && background) {
        fetchRecordsFromApi().catch(console.error);
      }

      return cached;
    }
  }

  return fetchRecordsFromApi();
}

async function apiRefreshRecords() {
  return fetchRecordsFromApi();
}

async function apiCreateRecord(payload) {
  const response = await fetch(CONFIG.WEB_APP_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ ...payload, action: "create", token: CONFIG.FORM_TOKEN }),
  });

  const result = await response.json();

  if (!result.ok && !result.success) {
    throw new Error(result.error || result.message || "Erro ao salvar.");
  }

  clearRecordsCache();
  return result;
}

function normalizeWhatsapp(value) {
  return String(value || "").replace(/[^\d+]/g, "").slice(0, 30);
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(value) {
  if (!value) return "";
  const [y, m, d] = String(value).slice(0, 10).split("-");
  return y && m && d ? `${d}/${m}/${y}` : escapeHtml(value);
}

function formatDateTime(value) {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? escapeHtml(value) : d.toLocaleString("pt-BR");
}

function parseBRL(value) {
  if (value === null || value === undefined || value === "") return 0;

  let text = String(value).trim();
  text = text.replace("R$", "").replace(/\s/g, "");

  if (!text) return 0;

  const hasComma = text.includes(",");
  const hasDot = text.includes(".");

  if (hasComma) {
    // Formato BR: 1.234,56 ou 24,90
    text = text.replace(/\./g, "").replace(",", ".");
  } else if (hasDot) {
    const parts = text.split(".");
    // Se tiver mais de um ponto, assume milhar: 1.234.567
    if (parts.length > 2) text = text.replace(/\./g, "");
  }

  const number = Number(text);
  return Number.isFinite(number) ? number : 0;
}

function formatBRL(value) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

// Mantém compatibilidade com versões antigas.
function moneyNumber(value) {
  return parseBRL(value);
}

function openWhatsapp(number) {
  const phone = String(number || "").replace(/\D/g, "");
  if (phone) window.open(`https://wa.me/55${phone}`, "_blank");
}

function copyText(text) {
  navigator.clipboard.writeText(String(text || ""));
}

function setLoadingText(id, text) {
  const el = $(id);
  if (el) el.textContent = text;
}
