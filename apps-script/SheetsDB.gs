/**
 * SheetsDB.gs – Data Persistence & Formatting
 * Optimized for Paulina Rodriguez Brito (Mazatlán GMT-7).
 */

// ---------------------------------------------------------------------------
// Initialization & Formatting
// ---------------------------------------------------------------------------

function ensureSheetExists() {
  const ss = _getSpreadsheet();
  // USE DIRECT VARIABLE (No CONFIG. prefix or parentheses needed)
  let sheet = ss.getSheetByName(LEADS_SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(LEADS_SHEET_NAME);
    Logger.log("[SheetsDB] Created new sheet: " + LEADS_SHEET_NAME);
  }

  const firstCell = sheet.getRange(1, 1).getValue();
  if (!firstCell) {
    _writeHeaders(sheet);
  }

  return sheet;
}

/**
 * Writes headers with professional formatting and sets column widths.
 */
function _writeHeaders(sheet) {
  const headerRange = sheet.getRange(1, 1, 1, SHEET_HEADERS.length);
  headerRange.setValues([SHEET_HEADERS]);

  // Style (Google Blue)
  headerRange.setFontWeight("bold")
             .setBackground("#1a73e8") 
             .setFontColor("#ffffff")
             .setHorizontalAlignment("center");
  sheet.setFrozenRows(1);

  // --- AUTO-FORMAT LOGIC ---
  const dataArea = sheet.getRange(2, 1, 2000, SHEET_HEADERS.length);
  dataArea.setWrap(true).setVerticalAlignment("top");

  // Custom column widths for better readability
  sheet.setColumnWidth(SHEET_COLUMNS.CONTACT_ID, 120);
  sheet.setColumnWidth(SHEET_COLUMNS.ENGAGEMENT_ID, 120);
  sheet.setColumnWidth(SHEET_COLUMNS.CALL_DATE, 160);
  sheet.setColumnWidth(SHEET_COLUMNS.INTENT_LEVEL, 100);
  sheet.setColumnWidth(SHEET_COLUMNS.RAW_NOTES, 400);
  sheet.setColumnWidth(SHEET_COLUMNS.AI_SUMMARY, 350);
  sheet.setColumnWidth(SHEET_COLUMNS.EMAIL_BODY, 350);

  Logger.log("[SheetsDB] Headers and formatting applied successfully.");
}

// ---------------------------------------------------------------------------
// Writing Operations
// ---------------------------------------------------------------------------

function appendLeadRow(lead, insights, outreach) {
  const sheet = ensureSheetExists();
  const now = new Date();
  const timezone = "America/Mazatlan"; 
  const timestampStr = Utilities.formatDate(now, timezone, "yyyy-MM-dd HH:mm:ss");
  const callDateStr = lead.callDateObj ? Utilities.formatDate(lead.callDateObj, timezone, "yyyy-MM-dd HH:mm:ss") : "N/A";

  // Array based on SHEET_HEADERS length
  const row = new Array(SHEET_HEADERS.length).fill("");

  // HOT LEAD LOGIC
  const threshold = CONFIG.HOT_LEAD_THRESHOLD();
  const isHotLead = (insights.interest_score >= threshold) ? "TRUE" : "FALSE";

  // MAPPING (Using SHEET_COLUMNS as defined in your Config.gs)
  row[SHEET_COLUMNS.TIMESTAMP - 1]         = timestampStr;
  row[SHEET_COLUMNS.CONTACT_ID - 1]        = lead.contactId || "";
  row[SHEET_COLUMNS.ENGAGEMENT_ID - 1]     = lead.engagementId || "";
  row[SHEET_COLUMNS.CONTACT_NAME - 1]      = lead.contactName || "";
  row[SHEET_COLUMNS.CONTACT_EMAIL - 1]     = lead.contactEmail || "";
  row[SHEET_COLUMNS.CONTACT_PHONE - 1]     = lead.contactPhone || "";
  row[SHEET_COLUMNS.AGENT_NAME - 1]        = lead.agentName || "";
  row[SHEET_COLUMNS.CALL_DATE - 1]         = callDateStr;
  row[SHEET_COLUMNS.CALL_OUTCOME - 1]      = lead.callOutcome || ""; 
  row[SHEET_COLUMNS.RAW_NOTES - 1]         = lead.rawNotes || "";

  // AI Insights
  row[SHEET_COLUMNS.PRODUCT_TYPE - 1]      = insights.product_type || "";
  row[SHEET_COLUMNS.INTEREST_SCORE - 1]    = insights.interest_score || 0;
  row[SHEET_COLUMNS.INTENT_LEVEL - 1]      = insights.intent_level || "";
  row[SHEET_COLUMNS.LOAN_AMOUNT - 1]       = insights.loan_amount || "";
  row[SHEET_COLUMNS.PROPERTY_STATE - 1]    = insights.property_state || "";
  row[SHEET_COLUMNS.URGENCY_INDICATORS - 1]= insights.urgency_indicators || "";
  row[SHEET_COLUMNS.AI_SUMMARY - 1]        = insights.ai_summary_markdown || "";
  
  // Automation Logic
  row[SHEET_COLUMNS.IS_HOT_LEAD - 1]       = isHotLead;
  row[SHEET_COLUMNS.EMAIL_BODY - 1]        = insights.suggested_email_body || "";

  // Email Outreach Status
  row[SHEET_COLUMNS.EMAIL_SENT - 1]        = outreach ? outreach.status : "No";
  row[SHEET_COLUMNS.EMAIL_SUBJECT - 1]     = outreach ? outreach.subject : "";
  row[SHEET_COLUMNS.EMAIL_TIMESTAMP - 1]   = outreach ? timestampStr : "";

  sheet.appendRow(row);
  
  const lastRow = sheet.getLastRow();
  sheet.getRange(lastRow, 1, 1, SHEET_HEADERS.length)
       .setBorder(true, true, true, true, true, true, "#efefef", SpreadsheetApp.BorderStyle.SOLID)
       .setVerticalAlignment("top");
  
  Logger.log("[SheetsDB] Lead saved successfully: " + lead.contactName);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getStoredEngagementIds() {
  const sheet = ensureSheetExists();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return new Set();

  const values = sheet.getRange(2, SHEET_COLUMNS.ENGAGEMENT_ID, lastRow - 1, 1).getValues();
  const ids = new Set(); 
  values.forEach(row => { if (row[0]) ids.add(String(row[0])); });

  return ids;
}

function _getSpreadsheet() {
  // Here we use CONFIG. because SPREADSHEET_ID() is a function inside the config object
  return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID());
}