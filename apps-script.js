const SPREADSHEET_ID = "15azriRqbIZiT09aou6MA4nfoQlUioUR4bAaMzF9DX1A";
const SHEET_CANCELAMENTO = "Cancelamento";
const SHEET_REENVIO = "Reenvio";

// Depois de colar este código no Apps Script, vá em:
// Configurações do projeto > Propriedades do script
// e crie a propriedade:
// FORM_TOKEN = L4BRZxALPI3G8txFktdNYNy3RxV3p3QqnzuCLT7PKwc

const HEADERS = [
  "Criado em",
  "Tipo",
  "Loja",
  "Data Pedido",
  "Motivo",
  "Fretes / Estorno",
  "Número Pedido",
  "WhatsApp",
  "Novo Código Rastreio",
  "Data Reenvio"
];

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents || "{}");
    validateToken_(payload.token);
    validateHoneypot_(payload.website);

    if (payload.action !== "create") {
      throw new Error("Ação inválida.");
    }

    rateLimit_();

    const tipo = clean_(payload.tipo);
    if (!["Cancelamento", "Reenvio"].includes(tipo)) {
      throw new Error("Tipo inválido.");
    }

    const row = [
      new Date(),
      tipo,
      clean_(payload.loja),
      cleanDate_(payload.dataPedido),
      clean_(payload.motivo),
      clean_(payload.fretesEstorno),
      clean_(payload.numeroPedido),
      cleanWhatsapp_(payload.whatsapp),
      clean_(payload.novoCodigoRastreio),
      cleanDate_(payload.dataReenvio)
    ];

    if (!row[2] || !row[3] || !row[4] || !row[6] || !row[7]) {
      throw new Error("Campos obrigatórios ausentes.");
    }

    if (tipo === "Reenvio" && (!row[8] || !row[9])) {
      throw new Error("Data Reenvio e Novo Código de Rastreio são obrigatórios para Reenvio.");
    }

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = getOrCreateSheet_(ss, tipo === "Cancelamento" ? SHEET_CANCELAMENTO : SHEET_REENVIO);

    const lock = LockService.getScriptLock();
    lock.waitLock(8000);
    try {
      ensureHeader_(sheet);
      sheet.appendRow(row);
    } finally {
      lock.releaseLock();
    }

    return json_({ ok: true });
  } catch (error) {
    return json_({ ok: false, error: error.message });
  }
}

function doGet(e) {
  try {
    validateToken_(e.parameter.token);

    if (e.parameter.action !== "list") {
      throw new Error("Ação inválida.");
    }

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const records = []
      .concat(readSheet_(ss, SHEET_CANCELAMENTO, "Cancelamento"))
      .concat(readSheet_(ss, SHEET_REENVIO, "Reenvio"));

    return json_({ ok: true, records });
  } catch (error) {
    return json_({ ok: false, error: error.message });
  }
}

function setupSheets() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  ensureHeader_(getOrCreateSheet_(ss, SHEET_CANCELAMENTO));
  ensureHeader_(getOrCreateSheet_(ss, SHEET_REENVIO));
}

function readSheet_(ss, sheetName, defaultTipo) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 2) return [];

  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, HEADERS.length).getValues();

  return values
    .filter((row) => row.some((cell) => cell !== ""))
    .map((row) => ({
      criadoEm: toIso_(row[0]),
      tipo: row[1] || defaultTipo,
      loja: row[2] || "",
      dataPedido: toDateOnly_(row[3]),
      motivo: row[4] || "",
      fretesEstorno: row[5] || "",
      numeroPedido: row[6] || "",
      whatsapp: row[7] || "",
      novoCodigoRastreio: row[8] || "",
      dataReenvio: toDateOnly_(row[9])
    }));
}

function getOrCreateSheet_(ss, name) {
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

function ensureHeader_(sheet) {
  const current = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0];
  const missing = HEADERS.some((header, index) => current[index] !== header);

  if (missing) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.setFrozenRows(1);
    sheet.autoResizeColumns(1, HEADERS.length);
  }
}

function validateToken_(token) {
  const expected = PropertiesService.getScriptProperties().getProperty("FORM_TOKEN");
  if (!expected) {
    throw new Error("FORM_TOKEN não configurado nas propriedades do Apps Script.");
  }
  if (!token || token !== expected) {
    throw new Error("Acesso negado.");
  }
}

function validateHoneypot_(value) {
  if (value) {
    throw new Error("Envio bloqueado.");
  }
}

function rateLimit_() {
  const cache = CacheService.getScriptCache();
  const key = "lastSubmit";
  const current = cache.get(key);

  if (current) {
    throw new Error("Aguarde alguns segundos antes de enviar novamente.");
  }

  cache.put(key, "1", 3);
}

function clean_(value) {
  return String(value || "").trim().slice(0, 300);
}

function cleanWhatsapp_(value) {
  return String(value || "").replace(/[^\d+]/g, "").slice(0, 30);
}

function cleanDate_(value) {
  const text = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return "";
  return text;
}

function toIso_(value) {
  if (value instanceof Date) return value.toISOString();
  return value ? String(value) : "";
}

function toDateOnly_(value) {
  if (value instanceof Date) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }
  return value ? String(value).slice(0, 10) : "";
}

function json_(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
