/**
 * Config.gs – Centralised credential & configuration manager.
 * Versión optimizada para Paulina Rodriguez Brito (Mazatlán).
 *
 * ALL sensitive values are read from Script Properties.
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
    HUBSPOT_OWNER_EMAIL: function () {
      return _optional("HUBSPOT_OWNER_EMAIL", Session.getEffectiveUser().getEmail());
    },
    // Set to 2880 (48 hours) by default to prevent data loss due to timezone offset
    POLL_INTERVAL_MINUTES: function () {
      return parseInt(_optional("POLL_INTERVAL_MINUTES", "2880"), 10);
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
const LEADS_SHEET_NAME = "Leads";

const SHEET_HEADERS = [
  "Timestamp", "Contact ID", "Call ID", "Contact Name", "Email", "Phone", 
  "Agent", "Call Date", "Outcome", "Raw Notes", "Product", "Interest Score", 
  "Intent Level", "Loan Amount", "State", "Urgency", "AI Summary", 
  "Is Hot Lead", "Email Body", "Email Status", "Subject", "Email Time"
];

const SHEET_COLUMNS = {
  TIMESTAMP: 1, CONTACT_ID: 2, ENGAGEMENT_ID: 3, CONTACT_NAME: 4, 
  CONTACT_EMAIL: 5, CONTACT_PHONE: 6, AGENT_NAME: 7, CALL_DATE: 8, 
  CALL_OUTCOME: 9, RAW_NOTES: 10, PRODUCT_TYPE: 11, INTEREST_SCORE: 12, 
  INTENT_LEVEL: 13, LOAN_AMOUNT: 14, PROPERTY_STATE: 15, URGENCY_INDICATORS: 16, 
  AI_SUMMARY: 17, IS_HOT_LEAD: 18, EMAIL_BODY: 19, EMAIL_SENT: 20, 
  EMAIL_SUBJECT: 21, EMAIL_TIMESTAMP: 22
};