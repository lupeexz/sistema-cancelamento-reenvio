let allRecords = [];

document.addEventListener("DOMContentLoaded", () => {
  requireAuth();

  ["search", "type", "dateStart", "dateEnd"].forEach((id) => {
    $(id).addEventListener("input", renderRecords);
    $(id).addEventListener("change", renderRecords);
  });

  const refreshBtn = $("refreshBtn");
  if (refreshBtn) refreshBtn.addEventListener("click", () => loadRecords(true));

  loadRecords(false);
});

async function loadRecords(force = false) {
  try {
    setRecordsLoading(force ? "Atualizando..." : "Carregando...");

    if (!force) {
      allRecords = await apiGetRecords({ background: true });
      renderRecords();
    }

    if (force || !allRecords.length) {
      allRecords = await apiRefreshRecords();
      renderRecords();
    }
  } catch (error) {
    console.error(error);
    renderRecordsError(error.message || "Erro ao carregar registros.");
  } finally {
    setRecordsLoading("");
  }
}

function setRecordsLoading(text) {
  const btn = $("refreshBtn");
  if (!btn) return;
  btn.disabled = Boolean(text);
  btn.textContent = text || "Atualizar";
}

function getFiltered() {
  const q = $("search").value.toLowerCase().trim();
  const type = $("type").value;
  const start = $("dateStart").value;
  const end = $("dateEnd").value;

  return allRecords.filter((r) => {
    if (type !== "all" && r.tipo !== type) return false;

    const d = r.dataPedido || "";
    if (start && d < start) return false;
    if (end && d > end) return false;

    if (q) {
      const haystack = [
        r.tipo,
        r.loja,
        r.dataPedido,
        r.motivo,
        r.fretesEstorno,
        r.numeroPedido,
        r.whatsapp,
        r.novoCodigoRastreio,
        r.dataReenvio,
      ].join(" ").toLowerCase();

      if (!haystack.includes(q)) return false;
    }

    return true;
  });
}

function renderRecords() {
  const records = getFiltered()
    .sort((a, b) => String(b.criadoEm || "").localeCompare(String(a.criadoEm || "")));

  $("recordsBody").innerHTML = records.map((r) => `
    <tr>
      <td><span class="pill">${escapeHtml(r.tipo)}</span></td>
      <td>${escapeHtml(r.loja)}</td>
      <td>${formatDate(r.dataPedido)}</td>
      <td>${escapeHtml(r.motivo)}</td>
      <td>${formatBRL(parseBRL(r.fretesEstorno))}</td>
      <td>${escapeHtml(r.numeroPedido)}</td>
      <td>${escapeHtml(r.whatsapp)}</td>
      <td>${escapeHtml(r.novoCodigoRastreio)}</td>
      <td>${formatDate(r.dataReenvio)}</td>
      <td>${formatDateTime(r.criadoEm)}</td>
      <td class="actions">
        <button class="mini secondary" type="button" onclick="copyText('${escapeAttr(r.whatsapp)}')">Copiar Whats</button>
        <button class="mini" type="button" onclick="openWhatsapp('${escapeAttr(r.whatsapp)}')">Abrir</button>
      </td>
    </tr>
  `).join("") || `<tr><td colspan="11">Nenhum registro encontrado.</td></tr>`;
}

function renderRecordsError(message) {
  $("recordsBody").innerHTML = `<tr><td colspan="11">${escapeHtml(message)}</td></tr>`;
}

function exportCsv() {
  const records = getFiltered();
  const headers = [
    "Tipo",
    "Loja",
    "Data Pedido",
    "Motivo",
    "Valor",
    "Pedido",
    "WhatsApp",
    "Rastreio",
    "Data Reenvio",
    "Criado em",
  ];

  const rows = records.map((r) => [
    r.tipo,
    r.loja,
    r.dataPedido,
    r.motivo,
    formatBRL(parseBRL(r.fretesEstorno)),
    r.numeroPedido,
    r.whatsapp,
    r.novoCodigoRastreio,
    r.dataReenvio,
    r.criadoEm,
  ]);

  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell || "").replaceAll('"', '""')}"`).join(";"))
    .join("\n");

  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");

  a.href = url;
  a.download = `registros-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();

  URL.revokeObjectURL(url);
}

function escapeAttr(value) {
  return String(value || "").replaceAll("\\", "\\\\").replaceAll("'", "\\'");
}
