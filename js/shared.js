const $ = (id) => document.getElementById(id);

const RECORDS_CACHE_KEY = "reenvios_estornos_records_cache_v5";
const RECORDS_CACHE_TIME = 5 * 60 * 1000;
const USER_KEY = "cr_user_v5";

// ── Auth ──
function getSessionUser() {
  try { return JSON.parse(sessionStorage.getItem(USER_KEY) || 'null'); }
  catch { return null; }
}

function setSessionUser(user) {
  sessionStorage.setItem(USER_KEY, JSON.stringify(user));
  sessionStorage.setItem(CONFIG.SESSION_KEY, "true");
}

function isAuthenticated() {
  return sessionStorage.getItem(CONFIG.SESSION_KEY) === "true" && !!getSessionUser();
}

function requireAuth() {
  if (!isAuthenticated()) {
    const inSubPage = window.location.pathname.includes('/pages/');
    window.location.href = inSubPage ? '../index.html' : 'index.html';
  }
}

function isAdmin() {
  return getSessionUser()?.role === 'admin';
}

function logout() {
  sessionStorage.removeItem(CONFIG.SESSION_KEY);
  sessionStorage.removeItem(USER_KEY);
  // Detecta se está em pages/ e ajusta o path
  const inSubPage = window.location.pathname.includes('/pages/');
  window.location.href = inSubPage ? '../index.html' : 'index.html';
}

// Mostra nome do usuário logado nos elementos .user-name-display
function showUserInfo() {
  const user = getSessionUser();
  if (!user) return;
  document.querySelectorAll('.user-name-display').forEach(el => el.textContent = user.nome);
  document.querySelectorAll('.user-role-display').forEach(el => {
    el.textContent = user.role === 'admin' ? 'Admin' : 'Atendente';
  });
  // Esconde itens admin-only se não for admin
  if (user.role !== 'admin') {
    document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
  }
  // Carrega badge de pendências
  loadPendingBadge();
}

// ── SHA-256 ──
async function sha256(text) {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ── Cache de registros ──
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
  } catch { return false; }
}

function saveCachedRecords(records) {
  localStorage.setItem(RECORDS_CACHE_KEY, JSON.stringify({ time: Date.now(), records: Array.isArray(records) ? records : [] }));
}

function clearRecordsCache() {
  localStorage.removeItem(RECORDS_CACHE_KEY);
}

// ── API Records (Google Sheets fallback + Supabase) ──
async function fetchRecordsFromApi() {
  if (isSupabaseReady()) {
    const rows = await dbGetRegistros();
    const records = (rows || []).map(r => ({
      criadoEm:           r.criado_em,
      tipo:               r.tipo,
      loja:               r.loja,
      dataPedido:         r.data_pedido,
      motivo:             r.motivo,
      fretesEstorno:      r.fretes_estorno,
      numeroPedido:       r.numero_pedido,
      whatsapp:           r.whatsapp,
      dataReenvio:        r.data_reenvio,
      novoCodigoRastreio: r.novo_codigo_rastreio,
      usuarioNome:        r.usuario_nome,
    }));
    saveCachedRecords(records);
    return records;
  }
  // Fallback Google Sheets
  const url = new URL(CONFIG.WEB_APP_URL);
  url.searchParams.set("action", "list");
  url.searchParams.set("token", CONFIG.FORM_TOKEN);
  const response = await fetch(url.toString(), { method: "GET", cache: "no-store" });
  const result   = await response.json();
  if (!result.ok && !result.success) throw new Error(result.error || "Erro ao carregar.");
  const records = result.records || [];
  saveCachedRecords(records);
  return records;
}

async function apiGetRecords(options = {}) {
  const force = Boolean(options.force);
  if (!force) {
    const cached = readCachedRecords();
    if (cached.length) {
      if (!isCacheFresh() && options.background) fetchRecordsFromApi().catch(console.error);
      return cached;
    }
  }
  return fetchRecordsFromApi();
}

async function apiRefreshRecords() { return fetchRecordsFromApi(); }

async function apiCreateRecord(payload) {
  // Se Supabase configurado, salva lá
  if (isSupabaseReady()) {
    const user = getSessionUser();
    await dbCreateRegistro({
      tipo:               payload.tipo,
      loja:               payload.loja,
      data_pedido:        payload.dataPedido || null,
      motivo:             payload.motivo,
      fretes_estorno:     payload.fretesEstorno,
      numero_pedido:      payload.numeroPedido,
      whatsapp:           payload.whatsapp,
      novo_codigo_rastreio: payload.novoCodigoRastreio,
      data_reenvio:       payload.dataReenvio || null,
      usuario_id:         user?.id || null,
      usuario_nome:       user?.nome || 'Sistema',
    });
    clearRecordsCache();
    return { ok: true };
  }
  // Fallback Google Sheets
  const response = await fetch(CONFIG.WEB_APP_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ ...payload, action: "create", token: CONFIG.FORM_TOKEN }),
  });
  const result = await response.json();
  if (!result.ok && !result.success) throw new Error(result.error || "Erro ao salvar.");
  clearRecordsCache();
  return result;
}

// ── Helpers ──
function normalizeWhatsapp(value) {
  return String(value || "").replace(/[^\d+]/g, "").slice(0, 30);
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
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
  if (!value && value !== 0) return 0;
  let text = String(value).trim().replace("R$", "").replace(/\s/g, "");
  if (!text) return 0;
  if (text.includes(",")) text = text.replace(/\./g, "").replace(",", ".");
  else if (text.split(".").length > 2) text = text.replace(/\./g, "");
  const number = Number(text);
  return Number.isFinite(number) ? number : 0;
}

function formatBRL(value) {
  return Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function openWhatsapp(number) {
  const phone = String(number || "").replace(/\D/g, "");
  if (phone) window.open(`https://wa.me/55${phone}`, "_blank");
}

function copyText(text) {
  navigator.clipboard.writeText(String(text || ""));
}

// ── Badge de solicitações pendentes (admin only) ──
async function loadPendingBadge() {
  if (!isAdmin() || !isSupabaseReady()) return;
  try {
    const all  = await dbGetSolicitacoes();
    const pend = (all || []).filter(s => s.status === 'pendente').length;
    const badge = document.getElementById('pendBadge');
    if (!badge) return;
    if (pend > 0) {
      badge.textContent = pend;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  } catch(e) { console.error(e); }
}
