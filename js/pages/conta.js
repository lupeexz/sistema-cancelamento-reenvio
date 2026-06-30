document.addEventListener('DOMContentLoaded', () => {
  requireAuth();
  showUserInfo();
  loadDados();

  document.getElementById('formDados').addEventListener('submit', handleSalvarDados);
  document.getElementById('formSenha').addEventListener('submit', handleAlterarSenha);
});

function loadDados() {
  const user = getSessionUser();
  if (!user) return;

  document.getElementById('contaNome').value  = user.nome || '';
  document.getElementById('contaEmail').value = user.email || '';

  document.getElementById('infoRole').textContent  = user.role === 'admin' ? 'Administrador' : 'Atendente';
  document.getElementById('infoLojas').textContent = (user.lojas || []).join(', ') || '—';
  document.getElementById('infoCriado').textContent = user.criado_em ? formatDateTime(user.criado_em) : '—';
}

async function handleSalvarDados(e) {
  e.preventDefault();
  const user  = getSessionUser();
  const nome  = document.getElementById('contaNome').value.trim();
  const email = document.getElementById('contaEmail').value.trim().toLowerCase();
  const msgEl = document.getElementById('msgDados');

  if (!nome || !email) return;

  try {
    await dbUpdateUsuario(user.id, { nome, email });
    // Atualiza sessão local
    user.nome  = nome;
    user.email = email;
    setSessionUser(user);
    showUserInfo();

    msgEl.textContent = '✓ Dados atualizados com sucesso!';
    msgEl.className = 'message ok';
  } catch(err) {
    msgEl.textContent = 'Erro: ' + (err.message || 'não foi possível salvar.');
    msgEl.className = 'message error';
  }
  setTimeout(() => { msgEl.textContent = ''; msgEl.className = 'message'; }, 4000);
}

async function handleAlterarSenha(e) {
  e.preventDefault();
  const user      = getSessionUser();
  const atual     = document.getElementById('senhaAtual').value;
  const nova      = document.getElementById('senhaNova').value;
  const nova2     = document.getElementById('senhaNova2').value;
  const msgEl     = document.getElementById('msgSenha');

  if (nova !== nova2) {
    msgEl.textContent = 'As senhas novas não coincidem.';
    msgEl.className = 'message error';
    return;
  }

  try {
    // Verifica senha atual
    const atualHash = await sha256(atual);
    const rows = await sbFetch(`usuarios?id=eq.${user.id}&select=senha_hash`);
    const dbUser = rows?.[0];

    if (!dbUser || dbUser.senha_hash !== atualHash) {
      msgEl.textContent = 'Senha atual incorreta.';
      msgEl.className = 'message error';
      return;
    }

    const novaHash = await sha256(nova);
    await dbUpdateUsuario(user.id, { senha_hash: novaHash });

    document.getElementById('formSenha').reset();
    msgEl.textContent = '✓ Senha alterada com sucesso!';
    msgEl.className = 'message ok';
  } catch(err) {
    msgEl.textContent = 'Erro: ' + (err.message || 'não foi possível alterar.');
    msgEl.className = 'message error';
  }
  setTimeout(() => { msgEl.textContent = ''; msgEl.className = 'message'; }, 4000);
}
