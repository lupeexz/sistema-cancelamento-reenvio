document.addEventListener("DOMContentLoaded", () => {
  if (isAuthenticated()) showSystem();

  $("loginForm").addEventListener("submit", handleLogin);
  $("entryForm").addEventListener("submit", handleSubmit);
  $("tipo").addEventListener("change", syncRequiredFields);

  syncRequiredFields();
});

async function handleLogin(e) {
  e.preventDefault();

  const hash = await sha256($("passwordInput").value);

  if (hash !== CONFIG.PASSWORD_SHA256) {
    $("loginError").classList.remove("hidden");
    return;
  }

  sessionStorage.setItem(CONFIG.SESSION_KEY, "true");
  showSystem();
}

function showSystem() {
  $("loginScreen").classList.add("hidden");
  $("systemScreen").classList.remove("hidden");
  loadMiniStats();
}

function syncRequiredFields() {
  const isReenvio = $("tipo").value === "Reenvio";
  $("dataReenvio").required = isReenvio;
  $("novoCodigoRastreio").required = isReenvio;
}

async function handleSubmit(e) {
  e.preventDefault();

  if ($("website").value) return;

  const payload = {
    tipo: $("tipo").value,
    loja: $("loja").value.trim(),
    dataPedido: $("dataPedido").value,
    motivo: $("motivo").value.trim(),
    fretesEstorno: $("fretesEstorno").value.trim(),
    numeroPedido: $("numeroPedido").value.trim(),
    whatsapp: normalizeWhatsapp($("whatsapp").value),
    novoCodigoRastreio: $("novoCodigoRastreio").value.trim(),
    dataReenvio: $("dataReenvio").value,
  };

  if (!payload.loja || !payload.dataPedido || !payload.motivo || !payload.numeroPedido || !payload.whatsapp) {
    setMessage("Preencha todos os campos obrigatórios.", "error");
    return;
  }

  if (payload.tipo === "Reenvio" && (!payload.dataReenvio || !payload.novoCodigoRastreio)) {
    setMessage("Para Reenvio, informe Data Reenvio e Novo Código de Rastreio.", "error");
    return;
  }

  $("submitBtn").disabled = true;
  setMessage("Salvando...", "");

  try {
    await apiCreateRecord(payload);

    $("entryForm").reset();
    syncRequiredFields();
    setMessage("Registro salvo com sucesso.", "ok");

    // Atualiza o cache já com dados novos para dashboard/registros abrirem mais rápido.
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

    $("statCancelamento").textContent = records.filter((r) => r.tipo === "Cancelamento").length;
    $("statReenvio").textContent = records.filter((r) => r.tipo === "Reenvio").length;
    $("statTotal").textContent = records.length;
  } catch (e) {
    console.error(e);
  }
}

function setMessage(text, type) {
  $("formMessage").textContent = text;
  $("formMessage").className = `message ${type || ""}`.trim();
}
