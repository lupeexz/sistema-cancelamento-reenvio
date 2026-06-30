// ── Supabase client wrapper ──
function isSupabaseReady() {
  return CONFIG.SUPABASE_URL &&
    !CONFIG.SUPABASE_URL.includes('COLE_AQUI') &&
    CONFIG.SUPABASE_ANON &&
    !CONFIG.SUPABASE_ANON.includes('COLE_AQUI');
}

async function sbFetch(path, options = {}) {
  const url    = CONFIG.SUPABASE_URL + '/rest/v1/' + path;
  const isNew  = CONFIG.SUPABASE_ANON.startsWith('sb_publishable_');

  const headers = {
    'Content-Type': 'application/json',
    'Prefer':       options.prefer !== undefined ? options.prefer : 'return=representation',
    ...(options.headers || {}),
  };

  if (isNew) {
    // Nova API do Supabase (chave publishable)
    headers['apikey']        = CONFIG.SUPABASE_ANON;
    headers['Authorization'] = 'Bearer ' + CONFIG.SUPABASE_ANON;
  } else {
    // API antiga (chave anon eyJ...)
    headers['apikey']        = CONFIG.SUPABASE_ANON;
    headers['Authorization'] = 'Bearer ' + CONFIG.SUPABASE_ANON;
  }

  const res = await fetch(url, {
    method:  options.method || 'GET',
    headers,
    body:    options.body,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.details || err.hint || `HTTP ${res.status}`);
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
  // Desvincula registros e tarefas antes de remover (evita erro de FK)
  try { await sbFetch(`registros?usuario_id=eq.${id}`, { method: 'PATCH', body: JSON.stringify({ usuario_id: null }), prefer: '' }); } catch {}
  try { await sbFetch(`produtos?criado_por=eq.${id}`, { method: 'PATCH', body: JSON.stringify({ criado_por: null }), prefer: '' }); } catch {}
  try { await sbFetch(`tarefas?criado_por=eq.${id}`, { method: 'PATCH', body: JSON.stringify({ criado_por: null }), prefer: '' }); } catch {}
  try { await sbFetch(`tarefas?atribuido_para=eq.${id}`, { method: 'PATCH', body: JSON.stringify({ status: 'pendente' }), prefer: '' }); } catch {}
  try { await sbFetch(`tarefa_comentarios?usuario_id=eq.${id}`, { method: 'PATCH', body: JSON.stringify({ usuario_id: null }), prefer: '' }); } catch {}
  return sbFetch(`usuarios?id=eq.${id}`, { method: 'DELETE', prefer: '' });
}

// ── REGISTROS ──
async function dbGetRegistros() {
  return sbFetch('registros?select=*&order=criado_em.desc');
}

async function dbGetRegistrosByEmpresa(empresa) {
  return sbFetch(`registros?select=*&empresa=eq.${encodeURIComponent(empresa)}&order=criado_em.desc`);
}

async function dbCreateRegistro(data) {
  return sbFetch('registros', { method: 'POST', body: JSON.stringify(data) });
}

// ── PRODUTOS ──
async function dbGetProdutosBanco() {
  return sbFetch('produtos?select=*&ativo=eq.true&order=nome.asc');
}

async function dbGetProdutosByEmpresa(empresa) {
  return sbFetch(`produtos?select=*&empresa=eq.${encodeURIComponent(empresa)}&ativo=eq.true&order=nome.asc`);
}

async function dbCreateProduto(data) {
  return sbFetch('produtos', { method: 'POST', body: JSON.stringify(data) });
}

async function dbDeleteProduto(id) {
  return sbFetch(`produtos?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify({ ativo: false }) });
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
  try {
    const existing = await sbFetch(`link_stats?nome_produto=eq.${encodeURIComponent(nome_produto)}&select=*`);
    if (existing?.length) {
      return sbFetch(`link_stats?id=eq.${existing[0].id}`, {
        method: 'PATCH',
        body: JSON.stringify({ contagem: existing[0].contagem + 1, atualizado_em: new Date().toISOString() }),
      });
    } else {
      return sbFetch('link_stats', { method: 'POST', body: JSON.stringify({ nome_produto, contagem: 1 }) });
    }
  } catch { /* silently fail */ }
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
  await dbCreateUsuario({
    nome:       sol.nome,
    email:      sol.email,
    senha_hash: sol.senha_hash,
    role:       'atendente',
    ativo:      true,
    lojas:      ['Barba Lenhador'],
  });
  await dbUpdateSolicitacao(sol.id, { status: 'aprovado' });
}

// ── MULTI-EMPRESA ──
async function getAllProductsMerged() {
  if (!isSupabaseReady()) return PRODUCTS;
  try {
    const empresa = getEmpresaAtiva();
    const dbProds = await dbGetProdutosByEmpresa(empresa);
    if (!dbProds || !dbProds.length) return PRODUCTS;
    return dbProds.map(p => ({
      nome:       p.nome,
      link_yampi: p.link_yampi,
      categoria:  p.categoria,
      id:         p.id,
    }));
  } catch { return PRODUCTS; }
}

// ── TAREFAS ──
async function dbGetTarefas(filtros = {}) {
  let query = 'tarefas?select=*&order=criado_em.desc';
  if (filtros.atribuido_para) query += `&atribuido_para=eq.${filtros.atribuido_para}`;
  if (filtros.empresa) query += `&empresa=eq.${encodeURIComponent(filtros.empresa)}`;
  return sbFetch(query);
}

async function dbCreateTarefa(data) {
  return sbFetch('tarefas', { method: 'POST', body: JSON.stringify(data) });
}

async function dbUpdateTarefa(id, data) {
  return sbFetch(`tarefas?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify({ ...data, atualizado_em: new Date().toISOString() }) });
}

async function dbDeleteTarefa(id) {
  return sbFetch(`tarefas?id=eq.${id}`, { method: 'DELETE', prefer: '' });
}

// ── COMENTÁRIOS ──
async function dbGetComentarios(tarefaId) {
  return sbFetch(`tarefa_comentarios?tarefa_id=eq.${tarefaId}&order=criado_em.asc`);
}

async function dbCreateComentario(data) {
  return sbFetch('tarefa_comentarios', { method: 'POST', body: JSON.stringify(data) });
}

// ── EDITAR / REMOVER REGISTRO ──
async function dbUpdateRegistro(id, data) {
  return sbFetch(`registros?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}

async function dbDeleteRegistro(id) {
  return sbFetch(`registros?id=eq.${id}`, { method: 'DELETE', prefer: '' });
}

// ── CLIENTES PENDENTES ──
async function dbGetClientesPendentes(empresa) {
  return sbFetch(`clientes_pendentes?select=*&empresa=eq.${encodeURIComponent(empresa)}&order=data_combinada.asc`);
}

async function dbCreateClientePendente(data) {
  return sbFetch('clientes_pendentes', { method: 'POST', body: JSON.stringify(data) });
}

async function dbDeleteClientePendente(id) {
  return sbFetch(`clientes_pendentes?id=eq.${id}`, { method: 'DELETE', prefer: '' });
}
