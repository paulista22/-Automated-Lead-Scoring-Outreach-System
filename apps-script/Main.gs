/**
 * Main.gs – Orchestrator & Trigger Manager
 *
 * This is the entry point for the automated pipeline.
 * The function `runPipeline()` is designed to be called by a time-based
 * trigger every 15 minutes (matching the POLL_INTERVAL_MINUTES setting).
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

  for (let i = 0; i < newLeads.length; i++) {
    const lead = newLeads[i];
    Logger.log("─────────────────────────────────────────");
    Logger.log("[Main] Processing: " + lead.contactName + " (engagement: " + lead.engagementId + ")");

    // Phase 2: AI Scoring & Insight Generation
    const isConnected = String(lead.callOutcome || "").toLowerCase() === "connected";
    const insights = isConnected ? scoreLeadWithGemini(lead) : _buildNotAnalyzedInsights();

    // ── ERROR HANDLING: Stop if API is overloaded (HIGH DEMAND) ──
    if (insights.ai_summary_markdown.includes("HIGH DEMAND")) {
      Logger.log("[Main] Critical: AI Service Overloaded. Stopping pipeline to prevent further errors.");
      break; 
    }

    // Phase 3a: Persistence & Outreach Logic
    let outreach = null;
    
    // Logic: Only send email if lead was Connected and score > 40
    if (isConnected && shouldSendOutreach(lead, insights)) {
      // Phase 3b: Automated Email Outreach via Gmail
      outreach = sendFollowUpEmail(lead, insights);
      if (outreach.status === "sent" || outreach.status === "draft") emailsSent++;
    }

    // Save results to the Google Sheet
    appendLeadRow(lead, insights, outreach);
    processed++;

    // Phase 3c: Real-time Telegram alert for "Hot" leads (only for Connected)
    const alerted = isConnected ? notifyIfHotLead(lead, insights) : false;
    if (alerted) hotLeadCount++;

    Logger.log(
      "[Main] " + lead.contactName +
        " → Score: " + insights.interest_score +
        " | Intent: " + insights.intent_level +
        " | Product: " + insights.product_type +
        " | Email: " + (outreach ? outreach.status : "skipped") +
        " | Hot alert: " + alerted
    );

    // ── SAFETY SLEEP: Wait 2 seconds between leads to avoid hitting rate limits ──
    if (i < newLeads.length - 1) {
      Utilities.sleep(4000);
    }
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

function setupSpreadsheet() {
  ensureSheetExists();
  Logger.log("[Main] Spreadsheet setup complete.");
}

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

function validateSetup() {
  Logger.log("[Main] Validating setup...");

  try {
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
    Logger.log("[Main] ✓ Telegram configured (bot: " + telegramToken.substring(0, 8) + "... / chat: " + chatId + ")");
  } catch (e) {
    Logger.log("[Main] ✗ Telegram error: " + e.message);
  }

  Logger.log("[Main] Validation complete.");
}

// ---------------------------------------------------------------------------
// Helper: default insights for non-Connected leads
// ---------------------------------------------------------------------------

function _buildNotAnalyzedInsights() {
  return {
    product_type: "Not Analyzed",
    interest_score: 0,
    intent_level: "Not Analyzed",
    loan_amount: "N/A",
    country_region: "N/A",
    urgency_indicators: "N/A",
    ai_summary_markdown: "Call not connected. Analysis skipped.",
    suggested_email_body: ""
  };
}