/**
 * Config.gs – Centralised credential & configuration manager.
 *
 * ALL sensitive values are read from Script Properties (never hard-coded).
 * To populate them: Extensions → Apps Script → Project Settings →
 * Script Properties → Add property.
 *
 * Required properties:
 *   HUBSPOT_API_KEY        – HubSpot Private App token (Bearer)
 *   GEMINI_API_KEY         – Google AI Studio API key
 *   SPREADSHEET_ID         – Google Sheets document ID
 *   TELEGRAM_BOT_TOKEN     – Telegram Bot HTTP API token
 *   TELEGRAM_CHAT_ID       – Target chat / group ID for alerts
 *   HUBSPOT_OWNER_EMAIL    – Default sender email for Gmail outreach
 *
 * Optional properties (sensible defaults are provided below):
 *   POLL_INTERVAL_MINUTES  – How far back to look for new calls (default 15)
 *   HOT_LEAD_THRESHOLD     – Minimum score to trigger Telegram alert (default 80)
 *   GMAIL_DRAFT_MODE       – "true" to save as draft instead of sending (default false)
 */

// ---------------------------------------------------------------------------
// Public accessors – used by every other module
// ---------------------------------------------------------------------------

const CONFIG = (function () {
  const props = PropertiesService.getScriptProperties();

  function _require(key) {
    const value = props.getProperty(key);
    if (!value) {
      throw new Error(
        `[Config] Missing required Script Property: "${key}". ` +
          "Add it via Extensions → Apps Script → Project Settings → Script Properties."
      );
    }
    return value;
  }

  function _optional(key, defaultValue) {
    const value = props.getProperty(key);
    return value !== null ? value : defaultValue;
  }

  return {
    HUBSPOT_ACCESS_TOKEN: function () {
      return _require("HUBSPOT_ACCESS_TOKEN");
    },
    GEMINI_API_KEY: function () {
      return _require("GEMINI_API_KEY");
    },
    SPREADSHEET_ID: function () {
      return _require("SPREADSHEET_ID");
    },
    TELEGRAM_BOT_TOKEN: function () {
      return _require("TELEGRAM_BOT_TOKEN");
    },
    TELEGRAM_CHAT_ID: function () {
      return _require("TELEGRAM_CHAT_ID");
    },
    // Note: if HUBSPOT_OWNER_EMAIL is not set, emails are sent from the Google account
    // that authorised the script. Set this property explicitly to use a consistent
    // sender address regardless of who runs or triggers the script.
    HUBSPOT_OWNER_EMAIL: function () {
      return _optional("HUBSPOT_OWNER_EMAIL", Session.getEffectiveUser().getEmail());
    },
    POLL_INTERVAL_MINUTES: function () {
      return parseInt(_optional("POLL_INTERVAL_MINUTES", "15"), 10);
    },
    HOT_LEAD_THRESHOLD: function () {
      return parseInt(_optional("HOT_LEAD_THRESHOLD", "80"), 10);
    },
    GMAIL_DRAFT_MODE: function () {
      return _optional("GMAIL_DRAFT_MODE", "false").toLowerCase() === "true";
    },
  };
})();

// ---------------------------------------------------------------------------
// Sheet column layout – single source of truth for SheetsDB.gs
// ---------------------------------------------------------------------------

const SHEET_COLUMNS = {
  // ── CRM Data ──────────────────────────────────────────────
  TIMESTAMP: 1,           // A – Processing timestamp
  CONTACT_ID: 2,          // B – HubSpot contact ID
  CONTACT_NAME: 3,        // C – Full name
  CONTACT_EMAIL: 4,       // D – Email
  CONTACT_PHONE: 5,       // E – Phone
  AGENT_NAME: 6,          // F – Sales representative
  CALL_DATE: 7,           // G – Date/time of the call
  RAW_NOTES: 8,           // H – Original call note (hs_note_body)

  // ── AI Insights ───────────────────────────────────────────
  PRODUCT_TYPE: 9,        // I – DSCR / ITIN / Foreign National / Bank Statement / Alt Doc
  INTEREST_SCORE: 10,     // J – 0-100 score
  INTENT_LEVEL: 11,       // K – Hot / Warm / Cold
  LOAN_AMOUNT: 12,        // L – Extracted loan amount
  PROPERTY_STATE: 13,     // M – Property state
  URGENCY_INDICATORS: 14, // N – Key urgency phrases
  AI_SUMMARY: 15,         // O – Markdown executive summary

  // ── Outreach ──────────────────────────────────────────────
  EMAIL_SENT: 16,         // P – true / false / draft
  EMAIL_SUBJECT: 17,      // Q – Email subject
  EMAIL_TIMESTAMP: 18,    // R – When email was sent/drafted

  // ── Metadata ──────────────────────────────────────────────
  ENGAGEMENT_ID: 19,      // S – HubSpot engagement ID (dedup key)
  STATUS: 20,             // T – Processing status (ok / error)
  ERROR_MSG: 21,          // U – Error message if any
};

const SHEET_HEADERS = [
  "Timestamp", "Contact ID", "Contact Name", "Contact Email", "Contact Phone",
  "Agent Name", "Call Date", "Raw Notes",
  "Product Type", "Interest Score", "Intent Level", "Loan Amount",
  "Property State", "Urgency Indicators", "AI Summary",
  "Email Sent", "Email Subject", "Email Timestamp",
  "Engagement ID", "Status", "Error Message",
];

// Sheet name inside the Spreadsheet
const LEADS_SHEET_NAME = "Leads";
