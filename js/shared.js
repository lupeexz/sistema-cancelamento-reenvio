const $ = (id) => document.getElementById(id);

const RECORDS_CACHE_KEY = "reenvios_estornos_records_cache_v5";
const RECORDS_CACHE_TIME = 5 * 60 * 1000;
const USER_KEY = "cr_user_v5";

// ── Auth ──
function getSessionUser() {
  try { return JSON.parse(sessionStorage.getItem(USER_KEY) || 'null'); }
  catch { return null; }
}

// ── Empresa / Multi-loja ──
const EMPRESAS = ['Barba Lenhador', 'Perito da Barba', 'Barba Completa'];

function getUserLojas() {
  const user = getSessionUser();
  if (!user) return [];
  if (user.role === 'admin') return EMPRESAS;
  return user.lojas || ['Barba Lenhador'];
}

function getEmpresaAtiva() {
  try {
    const stored = sessionStorage.getItem('cr_empresa_ativa');
    const lojas  = getUserLojas();
    if (stored && lojas.includes(stored)) return stored;
    return lojas[0] || 'Barba Lenhador';
  } catch { return 'Barba Lenhador'; }
}

function setEmpresaAtiva(empresa) {
  sessionStorage.setItem('cr_empresa_ativa', empresa);
}

// Iniciais da loja
function lojaInitials(nome) {
  return nome.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();
}

// Toggle dropdown
function toggleLojaDropdown() {
  const drop    = document.getElementById('lojaDropdown');
  const brand   = document.getElementById('brandLoja');
  const chevron = document.getElementById('brandChevron');
  if (!drop || !brand) return;

  const isHidden = drop.classList.contains('hidden');

  if (isHidden) {
    // Posiciona o dropdown abaixo do brand
    const rect = brand.getBoundingClientRect();
    drop.style.top  = (rect.bottom + 6) + 'px';
    drop.style.left = rect.left + 'px';
    drop.classList.remove('hidden');
    if (chevron) chevron.classList.add('open');
  } else {
    drop.classList.add('hidden');
    if (chevron) chevron.classList.remove('open');
  }
}

// Fecha dropdown ao clicar fora
document.addEventListener('click', e => {
  const brand = document.getElementById('brandLoja');
  const drop  = document.getElementById('lojaDropdown');
  if (!brand || !drop) return;
  if (!brand.contains(e.target) && !drop.contains(e.target)) {
    drop.classList.add('hidden');
    const chevron = document.getElementById('brandChevron');
    if (chevron) chevron.classList.remove('open');
  }
});

function renderEmpresaSelector() {
  const lojas  = getUserLojas();
  const ativa  = getEmpresaAtiva();

  // Atualiza brand header
  const brandNome   = document.getElementById('brandNome');
  const brandAvatar = document.getElementById('brandAvatar');
  if (brandNome)   brandNome.textContent   = ativa;
  if (brandAvatar) brandAvatar.textContent = lojaInitials(ativa);

  // Popula dropdown
  const list = document.getElementById('lojaDropdownList');
  if (!list) return;

  if (lojas.length <= 1) {
    const chevron = document.getElementById('brandChevron');
    if (chevron) chevron.style.display = 'none';
    list.innerHTML = '';
    return;
  }

  list.innerHTML = lojas.map(l => `
    <div class="loja-option ${l === ativa ? 'active' : ''}" onclick="trocarEmpresa('${l}')">
      <div class="loja-option-avatar">${lojaInitials(l)}</div>
      <span class="loja-option-nome">${l}</span>
      ${l === ativa ? '<span class="loja-option-check">✓</span>' : ''}
    </div>
  `).join('');
}

function trocarEmpresa(empresa) {
  setEmpresaAtiva(empresa);
  clearRecordsCache();
  window.location.reload();
}

function setSessionUser(user) {
  sessionStorage.setItem(USER_KEY, JSON.stringify(user));
  sessionStorage.setItem(CONFIG.SESSION_KEY, "true");
  // Garante que admin tem todas as lojas
  if (user.role === 'admin' && (!user.lojas || !user.lojas.length)) {
    user.lojas = ['Barba Lenhador', 'Perito da Barba', 'Barba Completa'];
    sessionStorage.setItem(USER_KEY, JSON.stringify(user));
  }
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
  document.querySelectorAll('.user-name-display').forEach(el => el.textContent = user.nome || '');
  document.querySelectorAll('.user-role-display').forEach(el => {
    el.textContent = user.role === 'admin' ? 'Admin' : 'Atendente';
  });
  // Esconde itens admin-only se não for admin
  if (user.role !== 'admin') {
    document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
  }
  // Carrega badge de pendências
  loadPendingBadge();
  // Renderiza seletor de empresa
  renderEmpresaSelector();
  // Verifica novas tarefas e notifica
  setTimeout(checkNovasTarefas, 1500);

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
    const empresa = getEmpresaAtiva();
    const isAdm   = getSessionUser()?.role === 'admin';
    const rows = isAdm
      ? await dbGetRegistros()
      : await dbGetRegistrosByEmpresa(empresa);
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
  if (!isSupabaseReady()) return;
  try {
    // Badge de solicitações (admin)
    if (isAdmin()) {
      const all  = await dbGetSolicitacoes();
      const pend = (all || []).filter(s => s.status === 'pendente').length;
      const badge = document.getElementById('pendBadge');
      if (badge) {
        badge.textContent = pend;
        badge.classList.toggle('hidden', pend === 0);
      }
    }

    // Badge de tarefas (todos)
    const user    = getSessionUser();
    const empresa = getEmpresaAtiva();
    let query = `tarefas?status=eq.pendente&empresa=eq.${encodeURIComponent(empresa)}`;
    if (!isAdmin()) query += `&atribuido_para=eq.${user.id}`;
    const tarefas = await sbFetch(query);
    const tBadge  = document.getElementById('tarefasBadge');
    if (tBadge) {
      const count = (tarefas || []).length;
      tBadge.textContent = count;
      tBadge.classList.toggle('hidden', count === 0);
    }
  } catch(e) { console.error(e); }
}

// ── Toast de notificação ──
function showToast(msg, type = 'info', duration = 5000) {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <div class="toast-icon">${type === 'tarefa' ? '📋' : type === 'ok' ? '✓' : 'ℹ️'}</div>
    <div class="toast-body">
      <div class="toast-titulo">Nova tarefa atribuída</div>
      <div class="toast-msg">${escapeHtml(msg)}</div>
    </div>
    <button class="toast-close" onclick="this.parentElement.remove()">✕</button>
  `;

  container.appendChild(toast);
  setTimeout(() => toast.classList.add('toast-show'), 10);
  setTimeout(() => {
    toast.classList.remove('toast-show');
    setTimeout(() => toast.remove(), 400);
  }, duration);
}

// ── Verifica novas tarefas e notifica ──
const TAREFAS_VISTAS_KEY = 'cr_tarefas_vistas_v1';

function getTarefasVistas() {
  try { return JSON.parse(localStorage.getItem(TAREFAS_VISTAS_KEY) || '[]'); }
  catch { return []; }
}

function marcarTarefaVista(id) {
  const vistas = getTarefasVistas();
  if (!vistas.includes(id)) {
    vistas.push(id);
    localStorage.setItem(TAREFAS_VISTAS_KEY, JSON.stringify(vistas.slice(-200)));
  }
}

async function checkNovasTarefas() {
  if (!isSupabaseReady() || !isAuthenticated()) return;
  try {
    const user    = getSessionUser();
    const empresa = getEmpresaAtiva();

    const tarefas = await sbFetch(
      `tarefas?atribuido_para=eq.${user.id}&empresa=eq.${encodeURIComponent(empresa)}&status=eq.pendente&order=criado_em.desc&limit=10`
    );

    (tarefas || []).forEach((t, i) => {
      setTimeout(() => showToast(t.titulo, 'tarefa'), i * 300);
    });
  } catch(e) { console.error(e); }
}
