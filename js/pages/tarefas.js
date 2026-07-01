let allTarefas = [];
let statusTab = 'pendente'; // aba ativa

const DIAS_NOMES = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

document.addEventListener('DOMContentLoaded', () => {
  requireAuth();
  showUserInfo();
  loadTarefas();
  loadUsuariosSelect();

  document.getElementById('tipoTarefa').addEventListener('change', toggleTipoFields);
  document.getElementById('formTarefa').addEventListener('submit', handleCriarTarefa);

  // Limita seleção de dias a 3
  document.getElementById('diasSemanaPicker').addEventListener('change', e => {
    if (e.target.type !== 'checkbox') return;
    const checked = document.querySelectorAll('#diasSemanaPicker input:checked');
    if (checked.length > 3) {
      e.target.checked = false;
      showMsg('Máximo de 3 dias por semana.', 'error');
    }
  });
});

// ── Aba ativa ──
function setTabStatus(status) {
  statusTab = status;
  document.querySelectorAll('.tarefa-tab').forEach(b => b.classList.remove('active'));
  document.getElementById('tab' + status.charAt(0).toUpperCase() + status.slice(1))?.classList.add('active');
  renderTarefas();
}

// ── Tipo de tarefa ──
function toggleTipoFields() {
  const tipo = document.getElementById('tipoTarefa').value;
  document.getElementById('prazoWrap').style.display       = tipo === 'prazo'    ? '' : 'none';
  document.getElementById('diasSemanaWrap').style.display  = tipo === 'semanal'  ? '' : 'none';
}

// ── Carrega tarefas ──
async function loadTarefas() {
  try {
    const hoje    = new Date().toISOString().slice(0, 10);
    const diaSem  = new Date().getDay(); // 0=dom ... 6=sab
    const empresa = getEmpresaAtiva();
    const user    = getSessionUser();
    const isAdm   = isAdmin();

    const rows = await (isAdm
      ? sbFetch(`tarefas?empresa=eq.${encodeURIComponent(empresa)}&order=criado_em.desc`)
      : sbFetch(`tarefas?empresa=eq.${encodeURIComponent(empresa)}&atribuido_para=eq.${user.id}&order=criado_em.desc`)
    );

    allTarefas = rows || [];

    // Reset automático
    const resets = [];
    for (const t of allTarefas) {
      if (t.status !== 'concluida') continue;

      const deveResetar =
        (t.tipo === 'diaria'  && t.ultimo_reset !== hoje) ||
        (t.tipo === 'semanal' && Array.isArray(t.dias_semana) && t.dias_semana.includes(diaSem) && t.ultimo_reset !== hoje);

      if (deveResetar) {
        resets.push(sbFetch(`tarefas?id=eq.${t.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ status: 'pendente', ultimo_reset: hoje })
        }));
        t.status      = 'pendente';
        t.ultimo_reset = hoje;
      }
    }
    if (resets.length) await Promise.all(resets);

    renderTarefas();
  } catch(e) { console.error(e); }
}

// ── Renderiza ──
function renderTarefas() {
  const hoje   = new Date().toISOString().slice(0, 10);
  const amanha = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

  const pendente  = allTarefas.filter(t => t.status === 'pendente');
  const andamento = allTarefas.filter(t => t.status === 'andamento');
  const concluida = allTarefas.filter(t => t.status === 'concluida');

  document.getElementById('countPendente').textContent  = pendente.length;
  document.getElementById('countAndamento').textContent = andamento.length;
  document.getElementById('countConcluida').textContent = concluida.length;

  const lista = statusTab === 'pendente'  ? pendente
              : statusTab === 'andamento' ? andamento
              : concluida;

  const empty = document.getElementById('tarefasEmpty');
  const grid  = document.getElementById('tarefasList');

  if (!lista.length) {
    const msgs = {
      pendente:  'Nenhuma tarefa pendente! 🎉',
      andamento: 'Nenhuma tarefa em andamento.',
      concluida: 'Nenhuma tarefa concluída ainda.',
    };
    empty.querySelector ? (empty.querySelector('div + *') || empty).textContent = '' : null;
    empty.innerHTML = `<div class="links-empty-icon">✅</div>${msgs[statusTab]}`;
    empty.classList.remove('hidden');
    grid.innerHTML = '';
    return;
  }
  empty.classList.add('hidden');

  grid.innerHTML = lista.map(t => {
    const vencendo = t.prazo && t.prazo <= amanha && t.status !== 'concluida';
    const vencido  = t.prazo && t.prazo < hoje    && t.status !== 'concluida';

    const priorIcon = t.prioridade === 'alta' ? '🔴' : t.prioridade === 'media' ? '🟡' : '🟢';

    let tipoLabel = '';
    if (t.tipo === 'diaria')  tipoLabel = '<span class="tarefa-badge-diaria">🔄 Diária</span>';
    if (t.tipo === 'semanal' && Array.isArray(t.dias_semana)) {
      const nomes = t.dias_semana.sort().map(d => DIAS_NOMES[d]).join(', ');
      tipoLabel = `<span class="tarefa-badge-diaria">📆 ${nomes}</span>`;
    }

    const statusNext = t.status === 'pendente' ? 'andamento'
                     : t.status === 'andamento' ? 'concluida'
                     : 'pendente';
    const statusLabel = t.status === 'pendente'  ? '⏳ Pendente'
                      : t.status === 'andamento' ? '🔵 Em andamento'
                      : '✅ Concluída';

    return `
      <div class="tarefa-card ${vencido ? 'tarefa-vencida' : vencendo ? 'tarefa-vencendo' : ''}" onclick="abrirTarefaModal('${t.id}')">
        <div class="tarefa-card-header">
          <div class="tarefa-titulo">${escapeHtml(t.titulo)}</div>
          <span class="tarefa-prioridade ${t.prioridade}">${priorIcon}</span>
        </div>
        ${t.descricao ? `<p class="tarefa-desc">${escapeHtml(t.descricao)}</p>` : ''}
        <div class="tarefa-meta">
          ${tipoLabel}
          ${t.prazo ? `<span>📅 ${formatDate(t.prazo)}</span>` : ''}
          <span>👤 ${escapeHtml(t.atribuido_para_nome || '—')}</span>
        </div>
        <div style="display:flex;gap:8px;margin-top:4px" onclick="event.stopPropagation()">
          <button class="mini tarefa-status-btn ${t.status}" onclick="avancarStatus('${t.id}','${statusNext}')" style="flex:1;justify-content:center">
            ${t.status === 'concluida' ? '↩ Reabrir' : t.status === 'andamento' ? '✅ Concluir' : '▶ Iniciar'}
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// ── Avança status ──
async function avancarStatus(id, novoStatus) {
  const hoje = new Date().toISOString().slice(0, 10);
  try {
    await sbFetch(`tarefas?id=eq.${id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        status: novoStatus,
        ultimo_reset: novoStatus === 'concluida' ? hoje : undefined,
      })
    });
    const t = allTarefas.find(t => t.id === id);
    if (t) t.status = novoStatus;
    renderTarefas();
  } catch(e) { console.error(e); }
}

// ── Carrega checkboxes de usuários ──
async function loadUsuariosSelect() {
  try {
    const users = await dbGetUsuarios();
    const user  = getSessionUser();
    const wrap  = document.getElementById('atribuidoPara');
    wrap.innerHTML = (users || []).map(u => `
      <label class="atribuir-check">
        <input type="checkbox" value="${u.id}" data-nome="${escapeHtml(u.nome)}" ${u.id === user.id ? 'checked' : ''}>
        <span>${escapeHtml(u.nome)}${u.id === user.id ? ' (eu)' : ''}</span>
      </label>
    `).join('');
  } catch(e) { console.error(e); }
}

// ── Cria tarefa ──
async function handleCriarTarefa(e) {
  e.preventDefault();
  const user    = getSessionUser();
  const tipo    = document.getElementById('tipoTarefa').value;

  // Pega todos os usuários selecionados
  const checked = [...document.querySelectorAll('#atribuidoPara input:checked')];
  if (!checked.length) { showMsg('Selecione ao menos uma pessoa.', 'error'); return; }

  let diasSemana = null;
  if (tipo === 'semanal') {
    const dias = [...document.querySelectorAll('#diasSemanaPicker input:checked')];
    diasSemana = dias.map(c => parseInt(c.value));
    if (!diasSemana.length) { showMsg('Selecione ao menos 1 dia da semana.', 'error'); return; }
  }

  const titulo = document.getElementById('tituloTarefa').value.trim();
  if (!titulo) { showMsg('Título é obrigatório.', 'error'); return; }

  const base = {
    titulo,
    descricao:           document.getElementById('descTarefa').value.trim(),
    tipo,
    prioridade:          document.getElementById('priorTarefa').value,
    status:              'pendente',
    prazo:               tipo === 'prazo' ? (document.getElementById('prazoTarefa').value || null) : null,
    resetar_diario:      tipo === 'diaria',
    dias_semana:         diasSemana,
    ultimo_reset:        (tipo === 'diaria' || tipo === 'semanal') ? new Date().toISOString().slice(0, 10) : null,
    empresa:             getEmpresaAtiva(),
    criado_por:          user.id,
    criado_por_nome:     user.nome,
  };

  try {
    // Cria uma tarefa por pessoa selecionada
    await Promise.all(checked.map(cb => sbFetch('tarefas', {
      method: 'POST',
      body: JSON.stringify({
        ...base,
        atribuido_para:      cb.value,
        atribuido_para_nome: cb.dataset.nome,
      })
    })));

    document.getElementById('formTarefa').reset();
    toggleTipoFields();
    // Marca o "eu" como checked novamente após reset
    const myChk = document.querySelector(`#atribuidoPara input[value="${user.id}"]`);
    if (myChk) myChk.checked = true;

    const qtd = checked.length;
    showMsg(`Tarefa criada para ${qtd} pessoa${qtd > 1 ? 's' : ''}!`, 'ok');
    await loadTarefas();
  } catch(err) { showMsg('Erro: ' + err.message, 'error'); }
}

// ── Modal de tarefa ──
let modalTarefaId = null;

function abrirTarefaModal(id) {
  const t = allTarefas.find(t => t.id === id);
  if (!t) return;
  modalTarefaId = id;

  document.getElementById('modalTituloTarefa').textContent     = t.titulo;
  document.getElementById('modalDescTarefa').textContent       = t.descricao || '—';
  document.getElementById('modalAtribuidoPara').textContent    = t.atribuido_para_nome || '—';
  document.getElementById('modalCriadoPor').textContent        = t.criado_por_nome || '—';
  document.getElementById('modalPrazo').textContent            = t.prazo ? formatDate(t.prazo) : '—';
  document.getElementById('modalPrioridade').textContent       = t.prioridade || '—';

  let tipoTxt = t.tipo === 'diaria' ? '🔄 Diária'
              : t.tipo === 'semanal' && Array.isArray(t.dias_semana)
                ? `📆 Semanal (${t.dias_semana.sort().map(d => DIAS_NOMES[d]).join(', ')})`
              : '📅 Com prazo';
  document.getElementById('modalTipo').textContent = tipoTxt;

  loadComentarios(id);
  document.getElementById('tarefaModal').classList.remove('hidden');
}

function fecharTarefaModal() {
  document.getElementById('tarefaModal').classList.add('hidden');
  modalTarefaId = null;
}

async function loadComentarios(tarefaId) {
  const list = document.getElementById('comentariosList');
  list.innerHTML = '<p style="color:var(--muted);font-size:12px">Carregando...</p>';
  try {
    const rows = await sbFetch(`tarefa_comentarios?tarefa_id=eq.${tarefaId}&order=criado_em.asc`);
    if (!rows?.length) { list.innerHTML = '<p style="color:var(--muted);font-size:12px">Nenhum comentário ainda.</p>'; return; }
    list.innerHTML = rows.map(c => `
      <div class="comentario-item">
        <div class="comentario-meta">${escapeHtml(c.usuario_nome)} · ${formatDateTime(c.criado_em)}</div>
        <div class="comentario-texto">${escapeHtml(c.texto)}</div>
      </div>
    `).join('');
  } catch(e) { list.innerHTML = ''; }
}

async function enviarComentario() {
  if (!modalTarefaId) return;
  const input = document.getElementById('comentarioInput');
  const texto = input.value.trim();
  if (!texto) return;
  const user = getSessionUser();
  try {
    await sbFetch('tarefa_comentarios', { method: 'POST', body: JSON.stringify({
      tarefa_id: modalTarefaId,
      usuario_id: user.id,
      usuario_nome: user.nome,
      texto,
    })});
    input.value = '';
    loadComentarios(modalTarefaId);
  } catch(e) { console.error(e); }
}

async function deletarTarefa(id) {
  if (!confirm('Remover esta tarefa?')) return;
  try {
    await sbFetch(`tarefas?id=eq.${id}`, { method: 'DELETE', prefer: '' });
    fecharTarefaModal();
    await loadTarefas();
  } catch(e) { console.error(e); }
}

function showMsg(text, type) {
  const el = document.getElementById('formMsg');
  el.textContent = text;
  el.className = `message ${type}`;
  setTimeout(() => { el.textContent = ''; el.className = 'message'; }, 3000);
}
