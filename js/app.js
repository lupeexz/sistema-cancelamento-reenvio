document.addEventListener("DOMContentLoaded", () => {
  if (isAuthenticated()) showSystem();

  $("loginForm").addEventListener("submit", handleLogin);
  $("registerForm").addEventListener("submit", handleRegister);
  $("entryForm").addEventListener("submit", handleSubmit);
  $("tipo").addEventListener("change", syncRequiredFields);
  $("tipo").addEventListener("change", atualizarLabelData);

  syncRequiredFields();
  atualizarLabelData();
});

// ── TABS ──
function switchTab(tab) {
  document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.auth-panel').forEach(p => p.classList.add('hidden'));
  if (tab === 'login') {
    document.querySelectorAll('.auth-tab')[0].classList.add('active');
    $('loginForm').classList.remove('hidden');
  } else {
    document.querySelectorAll('.auth-tab')[1].classList.add('active');
    $('registerForm').classList.remove('hidden');
  }
}

// ── LOGIN ──
async function handleLogin(e) {
  e.preventDefault();
  const email = $("emailInput").value.trim().toLowerCase();
  const senha = $("passwordInput").value;
  const errEl = $("loginError");
  errEl.classList.add("hidden");

  const hash = await sha256(senha);

  if (isSupabaseReady()) {
    try {
      // Busca usuário pelo email
      const rows = await sbFetch(`usuarios?email=eq.${encodeURIComponent(email)}&select=*`);
      const user = rows?.[0] || null;

      if (!user) {
        errEl.textContent = "E-mail não encontrado.";
        errEl.classList.remove("hidden");
        return;
      }

      if (!user.ativo) {
        errEl.textContent = "Usuário inativo. Contate o administrador.";
        errEl.classList.remove("hidden");
        return;
      }

      if (user.senha_hash !== hash) {
        errEl.textContent = "Senha incorreta.";
        errEl.classList.remove("hidden");
        return;
      }

      setSessionUser(user);
      showSystem();
      return;
    } catch (err) {
      console.error('Login error:', err);
      errEl.textContent = "Erro ao conectar com o banco. Verifique o config.js.";
      errEl.classList.remove("hidden");
      return;
    }
  }

  // Fallback senha mestre (sem Supabase)
  if (hash !== CONFIG.PASSWORD_SHA256) {
    errEl.textContent = "Senha incorreta.";
    errEl.classList.remove("hidden");
    return;
  }
  setSessionUser({ id: null, nome: "Administrador", email: "admin", role: "admin", lojas: ["Barba Lenhador","Perito da Barba","Barba Completa"] });
  showSystem();
}

// ── CADASTRO ──
async function handleRegister(e) {
  e.preventDefault();
  const nome   = $("regNome").value.trim();
  const email  = $("regEmail").value.trim().toLowerCase();
  const senha  = $("regSenha").value;
  const senha2 = $("regSenha2").value;
  const msgEl  = $("registerMsg");
  msgEl.className = 'message hidden';

  if (senha !== senha2) {
    msgEl.textContent = "As senhas não coincidem.";
    msgEl.className = 'message error';
    return;
  }
  if (!isSupabaseReady()) {
    msgEl.textContent = "Sistema não configurado. Contate o administrador.";
    msgEl.className = 'message error';
    return;
  }
  try {
    const hash = await sha256(senha);
    await dbCreateSolicitacao({ nome, email, senha_hash: hash, status: 'pendente' });
    $("registerForm").reset();
    msgEl.textContent = "✓ Solicitação enviada! Aguarde a aprovação do administrador.";
    msgEl.className = 'message ok';
  } catch (err) {
    msgEl.textContent = "Erro: " + (err.message || "E-mail já cadastrado ou em análise.");
    msgEl.className = 'message error';
  }
}

// ── SISTEMA ──
function showSystem() {
  $("loginScreen").classList.add("hidden");
  $("systemScreen").classList.remove("hidden");
  showUserInfo();
  loadMiniStats();
}

function syncRequiredFields() {
  const isReenvio = $("tipo").value === "Reenvio";
  $("dataReenvio").required = isReenvio;
  $("novoCodigoRastreio").required = isReenvio;
}

function atualizarLabelData() {
  $("dataAcaoLabel").textContent = $("tipo").value === "Cancelamento" ? "Data Cancelamento" : "Data Reenvio";
}

async function handleSubmit(e) {
  e.preventDefault();
  if ($("website").value) return;

  const empresaAtiva = getEmpresaAtiva();
  const payload = {
    tipo:               $("tipo").value,
    loja:               empresaAtiva,
    dataPedido:         $("dataPedido").value,
    motivo:             $("motivo").value.trim(),
    fretesEstorno:      $("fretesEstorno").value.trim(),
    numeroPedido:       $("numeroPedido").value.trim(),
    whatsapp:           normalizeWhatsapp($("whatsapp").value),
    novoCodigoRastreio: $("novoCodigoRastreio").value.trim(),
    dataReenvio:        $("dataReenvio").value,
  };

  if (!payload.dataPedido || !payload.motivo || !payload.numeroPedido || !payload.whatsapp) {
    setMessage("Preencha todos os campos obrigatórios.", "error"); return;
  }
  if (payload.tipo === "Reenvio" && (!payload.dataReenvio || !payload.novoCodigoRastreio)) {
    setMessage("Para Reenvio, informe Data Reenvio e Novo Código de Rastreio.", "error"); return;
  }

  $("submitBtn").disabled = true;
  setMessage("Salvando...", "");

  try {
    payload.empresa = getEmpresaAtiva();
    await apiCreateRecord(payload);
    $("entryForm").reset();
    syncRequiredFields();
    atualizarLabelData();
    setMessage("Registro salvo com sucesso.", "ok");
    apiRefreshRecords().then(() => loadMiniStats()).catch(() => loadMiniStats());
  } catch (err) {
    setMessage(err.message || "Erro ao salvar.", "error");
  } finally {
    $("submitBtn").disabled = false;
  }
}

async function loadMiniStats() {
  try {
    const records = await apiGetRecords({ background: true });
    $("statCancelamento").textContent = records.filter(r => r.tipo === "Cancelamento").length;
    $("statReenvio").textContent      = records.filter(r => r.tipo === "Reenvio").length;
    $("statTotal").textContent        = records.length;
  } catch (e) { console.error(e); }
}

function setMessage(text, type) {
  $("formMessage").textContent = text;
  $("formMessage").className   = `message ${type || ""}`.trim();
}
