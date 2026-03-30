/**
 * Main.gs – Orchestrator & Trigger Manager
 *
 * This is the entry point for the automated pipeline.
 * The function `runPipeline()` is designed to be called by a time-based
 * trigger every 15 minutes (matching the POLL_INTERVAL_MINUTES setting).
 *
 * SETUP INSTRUCTIONS
 * ──────────────────
 * 1. Set all required Script Properties (see Config.gs).
 * 2. Run `setupSpreadsheet()` once to initialise the Google Sheet.
 * 3. Run `installTrigger()` once to schedule the 15-minute polling trigger.
 * 4. (Optional) Run `runPipeline()` manually to test the full flow.
 */

// ---------------------------------------------------------------------------
// Pipeline orchestrator
// ---------------------------------------------------------------------------

/**
 * Main pipeline: polls HubSpot → scores with Gemini → persists → alerts → emails.
 */
function runPipeline() {
  Logger.log("═══════════════════════════════════════════");
  Logger.log("[Main] Pipeline started: " + new Date().toISOString());
  Logger.log("═══════════════════════════════════════════");

  // ── Phase 1: Fetch new call notes from HubSpot ──
  let leads;
  try {
    leads = fetchNewCallNotes();
  } catch (err) {
    Logger.log("[Main] FATAL – Could not fetch HubSpot data: " + err.message);
    return;
  }

  if (!leads || leads.length === 0) {
    Logger.log("[Main] No new call notes found. Pipeline complete.");
    return;
  }

  Logger.log("[Main] Processing " + leads.length + " lead(s)...");

  // Dedup against already-stored engagement IDs to avoid double processing
  const storedIds = getStoredEngagementIds();
  const newLeads = leads.filter(function (l) { return !storedIds.has(String(l.engagementId)); });

  if (newLeads.length === 0) {
    Logger.log("[Main] All fetched leads already processed. Pipeline complete.");
    return;
  }

  Logger.log("[Main] New (unprocessed) leads: " + newLeads.length);

  // ── Process each lead ──
  let processed = 0;
  let hotLeadCount = 0;
  let emailsSent = 0;

  for (const lead of newLeads) {
    Logger.log("─────────────────────────────────────────");
    Logger.log("[Main] Processing: " + lead.contactName + " (engagement: " + lead.engagementId + ")");

    // Phase 2: AI Scoring & Insight Generation
    const insights = scoreLeadWithGemini(lead);

    // Phase 3a: Persistence & Outreach Logic
    let outreach = null;
    
    // Logic: Only send email if a real conversation occurred (Score > 40)
    if (shouldSendOutreach(lead, insights)) {
      // Phase 3b: Automated Email Outreach via Gmail
      outreach = sendFollowUpEmail(lead, insights);
      if (outreach.status === "sent" || outreach.status === "draft") emailsSent++;
    }

    // Save results to the Google Sheet
    appendLeadRow(lead, insights, outreach);
    processed++;

    // Phase 3c: Real-time Telegram alert for "Hot" leads
    const alerted = notifyIfHotLead(lead, insights);
    if (alerted) hotLeadCount++;

    Logger.log(
      "[Main] " + lead.contactName +
        " → Score: " + insights.interest_score +
        " | Intent: " + insights.intent_level +
        " | Product: " + insights.product_type +
        " | Email: " + (outreach ? outreach.status : "skipped") +
        " | Hot alert: " + alerted
    );
  }

  Logger.log("═══════════════════════════════════════════");
  Logger.log(
    "[Main] Pipeline complete. Processed: " + processed +
      " | Hot leads: " + hotLeadCount +
      " | Emails: " + emailsSent
  );
  Logger.log("═══════════════════════════════════════════");
}

// ---------------------------------------------------------------------------
// Setup helpers
// ---------------------------------------------------------------------------

/**
 * Initialises the Google Sheet with correct headers.
 */
function setupSpreadsheet() {
  ensureSheetExists();
  Logger.log("[Main] Spreadsheet setup complete.");
}

/**
 * Installs a time-based trigger. 
 * Note: You can also do this manually in the Apps Script "Triggers" menu.
 */
function installTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function (trigger) {
    if (trigger.getHandlerFunction() === "runPipeline") {
      ScriptApp.deleteTrigger(trigger);
      Logger.log("[Main] Removed old trigger for runPipeline.");
    }
  });

  const interval = CONFIG.POLL_INTERVAL_MINUTES() || 15;
  ScriptApp.newTrigger("runPipeline")
    .timeBased()
    .everyMinutes(interval)
    .create();

  Logger.log("[Main] Trigger installed: runPipeline every " + interval + " minutes.");
}

/**
 * Validates configuration and connectivity for all services.
 */
function validateSetup() {
  Logger.log("[Main] Validating setup...");

  try {
    // CORRECTED: Reference to Access Token property
    const token = CONFIG.HUBSPOT_ACCESS_TOKEN();
    Logger.log("[Main] ✓ HUBSPOT_ACCESS_TOKEN is set (" + token.substring(0, 8) + "...)");
  } catch (e) {
    Logger.log("[Main] ✗ HubSpot Token error: " + e.message);
  }

  try {
    const geminiKey = CONFIG.GEMINI_API_KEY();
    Logger.log("[Main] ✓ GEMINI_API_KEY is set (" + geminiKey.substring(0, 8) + "...)");
  } catch (e) {
    Logger.log("[Main] ✗ Gemini Key error: " + e.message);
  }

  try {
    const sheetId = CONFIG.SPREADSHEET_ID();
    SpreadsheetApp.openById(sheetId);
    Logger.log("[Main] ✓ SPREADSHEET_ID is valid.");
  } catch (e) {
    Logger.log("[Main] ✗ SPREADSHEET_ID error: " + e.message);
  }

  try {
    const telegramToken = CONFIG.TELEGRAM_BOT_TOKEN();
    const chatId = CONFIG.TELEGRAM_CHAT_ID();
    Logger.log("[Main] ✓ Telegram configured (bot: " + telegramToken. substring(0, 8) + "... / chat: " + chatId + ")");
  } catch (e) {
    Logger.log("[Main] ✗ Telegram error: " + e.message);
  }

  Logger.log("[Main] Validation complete.");
}
