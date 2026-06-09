const SPREADSHEET_ID = "15azriRqbIZiT09aou6MA4nfoQlUioUR4bAaMzF9DX1A";
const FORM_TOKEN = "L4BRZxALPI3G8txFktdNYNy3RxV3p3QqnzuCLT7PKwc";

const SHEETS = {
  Cancelamento: "Cancelamento",
  Reenvio: "Reenvio",
  "Reenvio Pagante": "Reenvio Pagante",
};

const HEADERS = [
  "Data Registro",
  "Tipo",
  "Loja",
  "Data Pedido",
  "Motivo",
  "Fretes / Estorno",
  "Número Pedido",
  "WhatsApp",
  "Data Reenvio",
  "Novo Código de Rastreio",
];

function doGet(e) {
  const params = e.parameter || {};

  if (params.action === "list") {
    if (params.token !== FORM_TOKEN) {
      return jsonResponse({ ok: false, error: "Token inválido" });
    }

    return jsonResponse({
      ok: true,
      records: getRecords(),
    });
  }

  return jsonResponse({ ok: true, message: "Apps Script funcionando" });
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    if (data.token !== FORM_TOKEN) {
      return jsonResponse({ ok: false, error: "Token inválido" });
    }

    if (!SHEETS[data.tipo]) {
      return jsonResponse({ ok: false, error: "Tipo inválido" });
    }

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = getOrCreateSheet(ss, SHEETS[data.tipo]);

    ensureHeader(sheet);

    sheet.appendRow([
      new Date(),
      data.tipo || "",
      data.loja || "",
      data.dataPedido || "",
      data.motivo || "",
      data.fretesEstorno || "",
      data.numeroPedido || "",
      data.whatsapp || "",
      data.dataReenvio || "",
      data.novoCodigoRastreio || "",
    ]);

    return jsonResponse({ ok: true, message: "Registro salvo com sucesso" });

  } catch (error) {
    return jsonResponse({ ok: false, error: error.message });
  }
}

function getRecords() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const records = [];

  Object.values(SHEETS).forEach((sheetName) => {
    const sheet = getOrCreateSheet(ss, sheetName);
    ensureHeader(sheet);

    const values = sheet.getDataRange().getValues();

    for (let i = 1; i < values.length; i++) {
      const row = values[i];

      records.push({
        criadoEm: normalizeDateTime(row[0]),
        tipo: row[1] || "",
        loja: row[2] || "",
        dataPedido: normalizeDate(row[3]),
        motivo: row[4] || "",
        fretesEstorno: row[5] || "",
        numeroPedido: row[6] || "",
        whatsapp: row[7] || "",
        dataReenvio: normalizeDate(row[8]),
        novoCodigoRastreio: row[9] || "",
      });
    }
  });

  return records;
}

function getOrCreateSheet(ss, name) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  return sheet;
}

function ensureHeader(sheet) {
  if (sheet.getLastRow() > 0) return;
  sheet.appendRow(HEADERS);
}

function normalizeDate(value) {
  if (!value) return "";
  if (Object.prototype.toString.call(value) === "[object Date]") {
    return Utilities.formatDate(value, "GMT-3", "yyyy-MM-dd");
  }
  return String(value).slice(0, 10);
}

function normalizeDateTime(value) {
  if (!value) return "";
  if (Object.prototype.toString.call(value) === "[object Date]") {
    return value.toISOString();
  }
  return String(value);
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
