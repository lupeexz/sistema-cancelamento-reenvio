document.addEventListener('DOMContentLoaded', () => {
  requireAuth();
  if (!isAdmin()) { alert('Acesso restrito a administradores.'); window.location.href = '../index.html'; return; }
  showUserInfo();
  loadAll();
  document.getElementById('formUsuario').addEventListener('submit', handleAdd);
  document.getElementById('modalForm').addEventListener('submit', handleEditSave);
});

async function loadAll() {
  await Promise.all([loadSolicitacoes(), loadUsuarios()]);
}

// ── SOLICITAÇÕES ──
async function loadSolicitacoes() {
  try {
    const all  = await dbGetSolicitacoes();
    const pend = (all || []).filter(s => s.status === 'pendente');
    const sec  = document.getElementById('solicitacoesSection');
    const chip = document.getElementById('pendChip');
    if (!pend.length) { sec.style.display = 'none'; return; }
    sec.style.display = 'block';
    chip.textContent  = pend.length + ' pendente' + (pend.length > 1 ? 's' : '');
    document.getElementById('solicitacoesBody').innerHTML = pend.map(s => `
      <tr>
        <td style="font-weight:600">${escapeHtml(s.nome)}</td>
        <td style="color:var(--muted)">${escapeHtml(s.email)}</td>
        <td style="font-size:12px;color:var(--muted)">${formatDateTime(s.criado_em)}</td>
        <td class="actions">
          <button class="mini" onclick="aprovar('${s.id}')" style="background:var(--ok)">✓ Aprovar</button>
          <button class="mini secondary" onclick="recusar('${s.id}')" style="color:var(--danger);border-color:rgba(241,106,126,.3)">✕ Recusar</button>
        </td>
      </tr>
    `).join('');
  } catch(e) { console.error(e); }
}

async function aprovar(id) {
  try {
    const all = await dbGetSolicitacoes();
    const sol = all.find(s => s.id === id);
    if (!sol) return;
    await dbAprovarSolicitacao(sol);
    showMsg('Acesso aprovado para ' + sol.nome + '!', 'ok');
    loadAll();
  } catch(e) { showMsg('Erro: ' + e.message, 'error'); }
}

async function recusar(id) {
  if (!confirm('Recusar essa solicitação?')) return;
  try {
    await dbUpdateSolicitacao(id, { status: 'recusado' });
    loadAll();
  } catch(e) { showMsg('Erro: ' + e.message, 'error'); }
}

// ── USUÁRIOS ──
async function loadUsuarios() {
  try {
    const users = await dbGetUsuarios();
    renderUsuarios(users || []);
  } catch(e) { showMsg('Erro: ' + e.message, 'error'); }
}

function renderUsuarios(users) {
  const chip = document.getElementById('countChip');
  chip.innerHTML = `<span class="status-dot-green"></span>${users.length} usuário${users.length !== 1 ? 's' : ''}`;

  const me = getSessionUser();
  document.getElementById('usersBody').innerHTML = users.length
    ? users.map(u => `
      <tr>
        <td style="font-weight:600">${escapeHtml(u.nome)}</td>
        <td style="color:var(--muted);font-size:12px">${escapeHtml(u.email)}</td>
        <td>
          <span class="pill" style="${u.role === 'admin' ? '' : 'background:rgba(124,106,245,.12);color:#b8aff8;border-color:rgba(124,106,245,.25)'}">
            ${u.role === 'admin' ? 'Admin' : 'Atendente'}
          </span>
        </td>
        <td>
          <span style="font-size:11px;padding:2px 8px;border-radius:999px;font-weight:700;
            ${u.ativo ? 'background:rgba(52,199,123,.1);color:var(--ok);border:1px solid rgba(52,199,123,.2)' : 'background:rgba(241,106,126,.1);color:var(--danger);border:1px solid rgba(241,106,126,.2)'}">
            ${u.ativo ? 'Ativo' : 'Inativo'}
          </span>
        </td>
        <td style="font-size:12px;color:var(--muted)">${formatDateTime(u.criado_em)}</td>
        <td class="actions">
          <button class="mini" onclick="abrirModal('${u.id}','${escapeAttr(u.nome)}','${escapeAttr(u.email)}','${u.role}',${u.ativo})">✏️ Editar</button>
          ${u.id !== me?.id ? `<button class="mini secondary" onclick="toggleAtivo('${u.id}',${u.ativo})" style="${u.ativo ? 'color:var(--danger);border-color:rgba(241,106,126,.3)' : 'color:var(--ok);border-color:rgba(52,199,123,.3)'}">${u.ativo ? 'Desativar' : 'Ativar'}</button>` : ''}
        </td>
      </tr>
    `).join('')
    : `<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:2rem">Nenhum usuário.</td></tr>`;
}

// ── MODAL DE EDIÇÃO ──
let editingId = null;

function abrirModal(id, nome, email, role, ativo) {
  editingId = id;
  document.getElementById('editNome').value  = nome;
  document.getElementById('editEmail').value = email;
  document.getElementById('editRole').value  = role;
  document.getElementById('editAtivo').value = String(ativo);
  document.getElementById('editSenha').value = '';
  document.getElementById('modalOverlay').classList.remove('hidden');
}

function fecharModal() {
  document.getElementById('modalOverlay').classList.add('hidden');
  editingId = null;
}

async function handleEditSave(e) {
  e.preventDefault();
  if (!editingId) return;

  const data = {
    nome:  document.getElementById('editNome').value.trim(),
    email: document.getElementById('editEmail').value.trim().toLowerCase(),
    role:  document.getElementById('editRole').value,
    ativo: document.getElementById('editAtivo').value === 'true',
  };

  const novaSenha = document.getElementById('editSenha').value;
  if (novaSenha) {
    if (novaSenha.length < 6) { showMsg('Senha mínimo 6 caracteres.', 'error'); return; }
    data.senha_hash = await sha256(novaSenha);
  }

  try {
    await dbUpdateUsuario(editingId, data);
    fecharModal();
    showMsg('Usuário atualizado!', 'ok');
    loadUsuarios();
  } catch(e) { showMsg('Erro: ' + e.message, 'error'); }
}

async function handleAdd(e) {
  e.preventDefault();
  const nome  = document.getElementById('inputNome').value.trim();
  const email = document.getElementById('inputEmail').value.trim().toLowerCase();
  const senha = document.getElementById('inputSenha').value;
  const role  = document.getElementById('inputRole').value;
  if (senha.length < 6) { showMsg('Senha mínimo 6 caracteres.', 'error'); return; }
  try {
    const hash = await sha256(senha);
    await dbCreateUsuario({ nome, email, senha_hash: hash, role, ativo: true });
    document.getElementById('formUsuario').reset();
    showMsg(`"${nome}" adicionado!`, 'ok');
    loadUsuarios();
  } catch(e) { showMsg('Erro: ' + (e.message || 'E-mail já existe.'), 'error'); }
}

async function toggleAtivo(id, ativo) {
  try { await dbUpdateUsuario(id, { ativo: !ativo }); loadUsuarios(); }
  catch(e) { showMsg('Erro: ' + e.message, 'error'); }
}

function showMsg(text, type) {
  const el = document.getElementById('formMsg');
  el.textContent = text;
  el.className = `message ${type}`;
  setTimeout(() => { el.textContent = ''; el.className = 'message'; }, 4000);
}

function escapeAttr(val) { return String(val||'').replaceAll("'","\\'").replaceAll('"','&quot;'); }
