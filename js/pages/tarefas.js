let allTarefas    = [];
let allUsuarios   = [];
let tarefaAberta  = null;

document.addEventListener('DOMContentLoaded', async () => {
  requireAuth();
  showUserInfo();
  await loadUsuarios();
  await loadTarefas();
  resetDiarias();

  document.getElementById('formTarefa').addEventListener('submit', handleCreate);
  document.getElementById('formComentario').addEventListener('submit', handleComentario);
  document.getElementById('filterStatus').addEventListener('change', renderTarefas);
  document.getElementById('filterPrior').addEventListener('change', renderTarefas);
  document.getElementById('tipoTarefa').addEventListener('change', togglePrazo);
  togglePrazo();
});

// ── Reset diárias ──
function resetDiarias() {
  const hoje = new Date().toISOString().slice(0, 10);
  allTarefas.forEach(async t => {
    if (t.resetar_diario && t.ultimo_reset !== hoje && t.status === 'concluida') {
      await dbUpdateTarefa(t.id, { status: 'pendente', ultimo_reset: hoje });
    }
  });
}

// ── Carrega usuários ──
async function loadUsuarios() {
  try { allUsuarios = await dbGetUsuarios() || []; } catch {}
  populateAtribuidoPara();
}

function populateAtribuidoPara() {
  const sel  = document.getElementById('atribuidoPara');
  const user = getSessionUser();
  if (!sel) return;

  if (isAdmin()) {
    sel.innerHTML = allUsuarios.map(u =>
      `<option value="${u.id}" data-nome="${escapeHtml(u.nome)}">${escapeHtml(u.nome)}</option>`
    ).join('');
  } else {
    sel.innerHTML = `<option value="${user.id}" data-nome="${escapeHtml(user.nome)}">${escapeHtml(user.nome)} (eu)</option>`;
  }
}

// ── Carrega tarefas ──
async function loadTarefas() {
  try {
    const user    = getSessionUser();
    const empresa = getEmpresaAtiva();
    const filtros = { empresa };
    if (!isAdmin()) filtros.atribuido_para = user.id;
    allTarefas = await dbGetTarefas(filtros) || [];
    renderTarefas();
    updateBadge();
  } catch(e) { console.error(e); }
}

function updateBadge() {
  const pendentes = allTarefas.filter(t => t.status === 'pendente').length;
  const badge = document.getElementById('tarefasBadge');
  if (badge) {
    badge.textContent = pendentes;
    badge.classList.toggle('hidden', pendentes === 0);
  }
}

// ── Renderiza ──
function getFiltered() {
  const status = document.getElementById('filterStatus').value;
  const prior  = document.getElementById('filterPrior').value;
  return allTarefas.filter(t => {
    if (status && t.status !== status) return false;
    if (prior  && t.prioridade !== prior) return false;
    return true;
  });
}

function renderTarefas() {
  const items  = getFiltered();
  const list   = document.getElementById('tarefasList');
  const empty  = document.getElementById('tarefasEmpty');
  const chip   = document.getElementById('countChip');

  chip.innerHTML = `<span class="status-dot-green"></span>${allTarefas.length} tarefa${allTarefas.length !== 1 ? 's' : ''}`;

  if (!items.length) {
    list.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  const hoje     = new Date().toISOString().slice(0, 10);
  const amanha   = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

  list.innerHTML = items.map(t => {
    const priorCls  = t.prioridade === 'alta' ? 'tarefa-alta' : t.prioridade === 'media' ? 'tarefa-media' : 'tarefa-baixa';
    const statusCls = t.status === 'concluida' ? 'tarefa-concluida' : t.status === 'andamento' ? 'tarefa-andamento' : '';
    const vencendo  = t.prazo && t.prazo <= amanha && t.status !== 'concluida';
    const vencido   = t.prazo && t.prazo < hoje    && t.status !== 'concluida';

    return `
      <div class="tarefa-card ${statusCls} ${vencido ? 'tarefa-vencida' : vencendo ? 'tarefa-vencendo' : ''}" onclick="abrirTarefa('${t.id}')">
        <div class="tarefa-header">
          <div class="tarefa-titulo-wrap">
            <span class="tarefa-prior-dot ${priorCls}"></span>
            <span class="tarefa-titulo">${escapeHtml(t.titulo)}</span>
          </div>
          <div class="tarefa-badges">
            ${t.resetar_diario ? '<span class="tarefa-badge-diaria">🔄 Diária</span>' : ''}
            ${vencido   ? '<span class="tarefa-badge-vencida">⚠️ Vencida</span>'    : ''}
            ${vencendo  ? '<span class="tarefa-badge-vencendo">⏰ Hoje/Amanhã</span>' : ''}
            <span class="tarefa-status-badge tarefa-status-${t.status}">${t.status === 'pendente' ? 'Pendente' : t.status === 'andamento' ? 'Em andamento' : 'Concluída'}</span>
          </div>
        </div>
        <div class="tarefa-meta">
          <span>👤 ${escapeHtml(t.atribuido_para_nome || '—')}</span>
          ${t.prazo ? `<span>📅 ${formatDate(t.prazo)}</span>` : ''}
          <span>📝 ${escapeHtml(t.criado_por_nome || '—')}</span>
        </div>
        ${t.descricao ? `<p class="tarefa-desc">${escapeHtml(t.descricao)}</p>` : ''}
      </div>
    `;
  }).join('');
}

// ── Cria tarefa ──
function togglePrazo() {
  const tipo   = document.getElementById('tipoTarefa').value;
  const prazoW = document.getElementById('prazoWrap');
  if (prazoW) prazoW.style.display = tipo === 'prazo' ? 'block' : 'none';
}

async function handleCreate(e) {
  e.preventDefault();
  const user     = getSessionUser();
  const selEl    = document.getElementById('atribuidoPara');
  const selOpt   = selEl.options[selEl.selectedIndex];
  const tipo     = document.getElementById('tipoTarefa').value;

  const data = {
    titulo:              document.getElementById('tituloTarefa').value.trim(),
    descricao:           document.getElementById('descTarefa').value.trim(),
    tipo,
    prioridade:          document.getElementById('priorTarefa').value,
    status:              'pendente',
    prazo:               tipo === 'prazo' ? (document.getElementById('prazoTarefa').value || null) : null,
    resetar_diario:      tipo === 'diaria',
    ultimo_reset:        tipo === 'diaria' ? new Date().toISOString().slice(0, 10) : null,
    empresa:             getEmpresaAtiva(),
    criado_por:          user.id,
    criado_por_nome:     user.nome,
    atribuido_para:      selEl.value,
    atribuido_para_nome: selOpt?.dataset?.nome || selOpt?.text || '',
  };

  try {
    await dbCreateTarefa(data);
    document.getElementById('formTarefa').reset();
    togglePrazo();
    showMsg('Tarefa criada!', 'ok');
    await loadTarefas();
  } catch(e) { showMsg('Erro: ' + e.message, 'error'); }
}

// ── Modal tarefa ──
async function abrirTarefa(id) {
  tarefaAberta = allTarefas.find(t => t.id === id);
  if (!tarefaAberta) return;

  const t       = tarefaAberta;
  const user    = getSessionUser();
  const isAdm   = isAdmin();
  const overlay = document.getElementById('tarefaModal');

  document.getElementById('modalTituloTarefa').textContent   = t.titulo;
  document.getElementById('modalDescTarefa').textContent     = t.descricao || 'Sem descrição.';
  document.getElementById('modalAtribuidoPara').textContent  = t.atribuido_para_nome || '—';
  document.getElementById('modalCriadoPor').textContent      = t.criado_por_nome || '—';
  document.getElementById('modalPrazo').textContent          = t.prazo ? formatDate(t.prazo) : '—';
  document.getElementById('modalTipo').textContent           = t.resetar_diario ? '🔄 Diária' : '📅 Com prazo';
  document.getElementById('modalPrioridade').textContent     = t.prioridade === 'alta' ? '🔴 Alta' : t.prioridade === 'media' ? '🟡 Média' : '🟢 Baixa';

  // Status select
  const statusSel = document.getElementById('modalStatus');
  statusSel.value = t.status;

  // Botões admin
  document.getElementById('btnDeleteTarefa').style.display = isAdm ? 'block' : 'none';

  // Comentários
  await loadComentarios(id);

  overlay.classList.remove('hidden');
}

function fecharTarefaModal() {
  document.getElementById('tarefaModal').classList.add('hidden');
  tarefaAberta = null;
}

async function salvarStatusTarefa() {
  if (!tarefaAberta) return;
  const status = document.getElementById('modalStatus').value;
  try {
    await dbUpdateTarefa(tarefaAberta.id, { status });
    showMsg('Status atualizado!', 'ok');
    fecharTarefaModal();
    await loadTarefas();
  } catch(e) { showMsg('Erro: ' + e.message, 'error'); }
}

async function deletarTarefa() {
  if (!tarefaAberta || !confirm('Remover esta tarefa?')) return;
  try {
    await dbDeleteTarefa(tarefaAberta.id);
    fecharTarefaModal();
    await loadTarefas();
  } catch(e) { showMsg('Erro: ' + e.message, 'error'); }
}

// ── Comentários ──
async function loadComentarios(tarefaId) {
  try {
    const comentarios = await dbGetComentarios(tarefaId) || [];
    const list = document.getElementById('comentariosList');
    list.innerHTML = comentarios.length
      ? comentarios.map(c => `
          <div class="comentario">
            <div class="comentario-header">
              <strong>${escapeHtml(c.usuario_nome || '—')}</strong>
              <span class="comentario-data">${formatDateTime(c.criado_em)}</span>
            </div>
            <p class="comentario-texto">${escapeHtml(c.texto)}</p>
          </div>
        `).join('')
      : '<p style="color:var(--muted);font-size:13px">Nenhum comentário ainda.</p>';
  } catch(e) { console.error(e); }
}

async function handleComentario(e) {
  e.preventDefault();
  if (!tarefaAberta) return;
  const user  = getSessionUser();
  const texto = document.getElementById('textoComentario').value.trim();
  if (!texto) return;
  try {
    await dbCreateComentario({
      tarefa_id:    tarefaAberta.id,
      usuario_id:   user.id,
      usuario_nome: user.nome,
      texto,
    });
    document.getElementById('textoComentario').value = '';
    await loadComentarios(tarefaAberta.id);
  } catch(e) { showMsg('Erro: ' + e.message, 'error'); }
}

function showMsg(text, type) {
  const el = document.getElementById('formMsg');
  if (!el) return;
  el.textContent = text;
  el.className = `message ${type}`;
  setTimeout(() => { el.textContent = ''; el.className = 'message'; }, 3000);
}
