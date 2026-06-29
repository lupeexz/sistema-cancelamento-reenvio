// ── Supabase client wrapper ──
// Detecta se Supabase está configurado
function isSupabaseReady() {
  return CONFIG.SUPABASE_URL && !CONFIG.SUPABASE_URL.includes('COLE_AQUI');
}

// Request helper
async function sbFetch(path, options = {}) {
  const url = CONFIG.SUPABASE_URL + '/rest/v1/' + path;
  const res  = await fetch(url, {
    ...options,
    headers: {
      'apikey':        CONFIG.SUPABASE_ANON,
      'Authorization': 'Bearer ' + CONFIG.SUPABASE_ANON,
      'Content-Type':  'application/json',
      'Prefer':        options.prefer || 'return=representation',
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.details || `HTTP ${res.status}`);
  }
  return res.status === 204 ? null : res.json();
}

// ── USUÁRIOS ──
async function dbGetUsuarios() {
  return sbFetch('usuarios?select=*&order=nome.asc');
}

async function dbGetUsuario(email) {
  const rows = await sbFetch(`usuarios?email=eq.${encodeURIComponent(email)}&select=*`);
  return rows?.[0] || null;
}

async function dbCreateUsuario(data) {
  return sbFetch('usuarios', { method: 'POST', body: JSON.stringify(data) });
}

async function dbUpdateUsuario(id, data) {
  return sbFetch(`usuarios?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}

async function dbDeleteUsuario(id) {
  return sbFetch(`usuarios?id=eq.${id}`, { method: 'DELETE', prefer: '' });
}

// ── REGISTROS ──
async function dbGetRegistros() {
  return sbFetch('registros?select=*&order=criado_em.desc');
}

async function dbCreateRegistro(data) {
  return sbFetch('registros', { method: 'POST', body: JSON.stringify(data) });
}

// ── PRODUTOS ──
async function dbGetProdutos() {
  return sbFetch('produtos?select=*&ativo=eq.true&order=nome.asc');
}

async function dbCreateProduto(data) {
  return sbFetch('produtos', { method: 'POST', body: JSON.stringify(data) });
}

async function dbDeleteProduto(id) {
  return sbFetch(`produtos?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify({ ativo: false }), prefer: '' });
}

// ── HISTÓRICO LINKS ──
async function dbSaveHistoricoLink(data) {
  return sbFetch('historico_links', { method: 'POST', body: JSON.stringify(data) });
}

async function dbGetHistoricoLinks(limit = 100) {
  return sbFetch(`historico_links?select=*&order=criado_em.desc&limit=${limit}`);
}

// ── LINK STATS ──
async function dbIncrementStat(nome_produto) {
  // Upsert: incrementa se existir, cria se não
  const existing = await sbFetch(`link_stats?nome_produto=eq.${encodeURIComponent(nome_produto)}&select=*`);
  if (existing?.length) {
    const row = existing[0];
    return sbFetch(`link_stats?id=eq.${row.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ contagem: row.contagem + 1, atualizado_em: new Date().toISOString() }),
    });
  } else {
    return sbFetch('link_stats', { method: 'POST', body: JSON.stringify({ nome_produto, contagem: 1 }) });
  }
}

async function dbGetTopStats(limit = 6) {
  return sbFetch(`link_stats?select=*&order=contagem.desc&limit=${limit}`);
}

// ── SOLICITAÇÕES ──
async function dbGetSolicitacoes() {
  return sbFetch('solicitacoes?select=*&order=criado_em.desc');
}

async function dbCreateSolicitacao(data) {
  return sbFetch('solicitacoes', { method: 'POST', body: JSON.stringify(data) });
}

async function dbUpdateSolicitacao(id, data) {
  return sbFetch(`solicitacoes?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify(data), prefer: '' });
}

async function dbAprovarSolicitacao(sol) {
  // Cria usuário e marca solicitação como aprovada
  await dbCreateUsuario({
    nome:       sol.nome,
    email:      sol.email,
    senha_hash: sol.senha_hash,
    role:       'atendente',
    ativo:      true,
  });
  await dbUpdateSolicitacao(sol.id, { status: 'aprovado' });
}

// ── PRODUTOS DO BANCO ──
async function dbGetProdutosBanco() {
  return sbFetch('produtos?select=*&ativo=eq.true&order=nome.asc');
}

// Mescla produtos do banco com os locais (banco tem prioridade)
async function getAllProductsMerged() {
  if (!isSupabaseReady()) return PRODUCTS;
  try {
    const dbProds = await dbGetProdutosBanco();
    if (!dbProds || !dbProds.length) return PRODUCTS;
    // Converte formato do banco para o formato local
    return dbProds.map(p => ({
      nome:       p.nome,
      link_yampi: p.link_yampi,
      categoria:  p.categoria,
      id:         p.id,
      origem:     'banco',
    }));
  } catch {
    return PRODUCTS;
  }
}

// ── MULTI-EMPRESA ──
async function dbGetRegistrosByEmpresa(empresa) {
  return sbFetch(`registros?select=*&empresa=eq.${encodeURIComponent(empresa)}&order=criado_em.desc`);
}

async function dbGetProdutosByEmpresa(empresa) {
  return sbFetch(`produtos?select=*&empresa=eq.${encodeURIComponent(empresa)}&ativo=eq.true&order=nome.asc`);
}
