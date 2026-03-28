/**
 * SheetsDB.gs – Phase 3: Data Persistence
 *
 * Manages all read/write operations to the Google Sheets database.
 * The spreadsheet acts as the central data warehouse for every processed lead.
 *
 * Sheet layout is defined in SHEET_COLUMNS / SHEET_HEADERS (Config.gs).
 */

// ---------------------------------------------------------------------------
// Initialisation
// ---------------------------------------------------------------------------

/**
 * Creates the "Leads" sheet with formatted headers if it does not yet exist.
 * Call this once during initial setup or from Main.gs → setupSpreadsheet().
 */
function ensureSheetExists() {
  const ss = _getSpreadsheet();
  let sheet = ss.getSheetByName(LEADS_SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(LEADS_SHEET_NAME);
    Logger.log("[SheetsDB] Created new sheet: " + LEADS_SHEET_NAME);
  }

  // Write headers if the first row is empty
  const firstCell = sheet.getRange(1, 1).getValue();
  if (!firstCell) {
    _writeHeaders(sheet);
  }

  return sheet;
}

// ---------------------------------------------------------------------------
// Write operations
// ---------------------------------------------------------------------------

/**
 * Appends a fully processed lead record to the Leads sheet.
 * @param {Object} lead     – Normalised lead from HubSpotETL.gs
 * @param {Object} insights – AI analysis from GeminiAI.gs
 * @param {Object} outreach – Email result from GmailOutreach.gs
 */
function appendLeadRow(lead, insights, outreach) {
  const sheet = ensureSheetExists();
  const now = new Date();

  const row = new Array(Object.keys(SHEET_COLUMNS).length).fill("");

  row[SHEET_COLUMNS.TIMESTAMP - 1]         = Utilities.formatDate(now, "America/New_York", "yyyy-MM-dd HH:mm:ss");
  row[SHEET_COLUMNS.CONTACT_ID - 1]        = lead.contactId || "";
  row[SHEET_COLUMNS.CONTACT_NAME - 1]      = lead.contactName || "";
  row[SHEET_COLUMNS.CONTACT_EMAIL - 1]     = lead.contactEmail || "";
  row[SHEET_COLUMNS.CONTACT_PHONE - 1]     = lead.contactPhone || "";
  row[SHEET_COLUMNS.AGENT_NAME - 1]        = lead.agentName || "";
  row[SHEET_COLUMNS.CALL_DATE - 1]         = lead.callDate || "";
  row[SHEET_COLUMNS.RAW_NOTES - 1]         = lead.rawNotes || "";

  row[SHEET_COLUMNS.PRODUCT_TYPE - 1]      = insights.product_type || "";
  row[SHEET_COLUMNS.INTEREST_SCORE - 1]    = insights.interest_score || 0;
  row[SHEET_COLUMNS.INTENT_LEVEL - 1]      = insights.intent_level || "";
  row[SHEET_COLUMNS.LOAN_AMOUNT - 1]       = insights.loan_amount || "";
  row[SHEET_COLUMNS.PROPERTY_STATE - 1]    = insights.property_state || "";
  row[SHEET_COLUMNS.URGENCY_INDICATORS - 1] = insights.urgency_indicators || "";
  row[SHEET_COLUMNS.AI_SUMMARY - 1]        = insights.ai_summary || "";

  row[SHEET_COLUMNS.EMAIL_SENT - 1]        = outreach ? outreach.status : "";
  row[SHEET_COLUMNS.EMAIL_SUBJECT - 1]     = outreach ? outreach.subject : "";
  row[SHEET_COLUMNS.EMAIL_TIMESTAMP - 1]   = outreach
    ? Utilities.formatDate(now, "America/New_York", "yyyy-MM-dd HH:mm:ss")
    : "";

  row[SHEET_COLUMNS.ENGAGEMENT_ID - 1]     = lead.engagementId || "";
  row[SHEET_COLUMNS.STATUS - 1]            = insights._error ? "error" : "ok";
  row[SHEET_COLUMNS.ERROR_MSG - 1]         = insights._error || "";

  sheet.appendRow(row);
  Logger.log("[SheetsDB] Appended lead: " + lead.contactName + " (score: " + insights.interest_score + ")");
}

// ---------------------------------------------------------------------------
// Read operations
// ---------------------------------------------------------------------------

/**
 * Returns all engagement IDs already stored in the sheet (for deduplication).
 * @returns {Set<string>}
 */
function getStoredEngagementIds() {
  const sheet = ensureSheetExists();
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) return new Set();

  const values = sheet
    .getRange(2, SHEET_COLUMNS.ENGAGEMENT_ID, lastRow - 1, 1)
    .getValues();

  const ids = new Set();
  values.forEach(function (row) {
    if (row[0]) ids.add(String(row[0]));
  });

  return ids;
}

/**
 * Returns rows where interest_score >= threshold as plain objects.
 * Useful for re-processing or reporting.
 * @param {number} threshold
 * @returns {Object[]}
 */
function getHotLeads(threshold) {
  const sheet = ensureSheetExists();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const data = sheet.getRange(2, 1, lastRow - 1, Object.keys(SHEET_COLUMNS).length).getValues();

  return data
    .filter(function (row) {
      return Number(row[SHEET_COLUMNS.INTEREST_SCORE - 1]) >= threshold;
    })
    .map(function (row) {
      return _rowToObject(row);
    });
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

function _getSpreadsheet() {
  return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID());
}

function _writeHeaders(sheet) {
  const headerRange = sheet.getRange(1, 1, 1, SHEET_HEADERS.length);
  headerRange.setValues([SHEET_HEADERS]);

  // Style: bold, frozen first row, background colour
  headerRange.setFontWeight("bold");
  headerRange.setBackground("#1a73e8");
  headerRange.setFontColor("#ffffff");
  sheet.setFrozenRows(1);

  // Auto-resize for readability
  sheet.autoResizeColumns(1, SHEET_HEADERS.length);

  Logger.log("[SheetsDB] Headers written to sheet: " + LEADS_SHEET_NAME);
}

function _rowToObject(row) {
  const obj = {};
  Object.entries(SHEET_COLUMNS).forEach(function ([key, colIndex]) {
    obj[key.toLowerCase()] = row[colIndex - 1];
  });
  return obj;
}
