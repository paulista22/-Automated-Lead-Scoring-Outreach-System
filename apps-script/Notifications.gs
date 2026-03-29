/**
 * Notifications.gs – Phase 3: Real-Time Alerting
 *
 * Sends an instant Telegram notification to the designated manager chat
 * whenever a lead's interest_score exceeds the HOT_LEAD_THRESHOLD.
 */

// ---------------------------------------------------------------------------
// Main notification entry point
// ---------------------------------------------------------------------------

/**
 * Evaluates a lead's score and fires a Telegram alert if it is a Hot Lead.
 */
function notifyIfHotLead(lead, insights) {
  const threshold = CONFIG.HOT_LEAD_THRESHOLD() || 80;

  if (insights.interest_score < threshold) return false;

  Logger.log("[Notifications] Hot lead detected: " + lead.contactName + " (score: " + insights.interest_score + ")");

  const message = _buildTelegramMessage(lead, insights, threshold);
  return _sendTelegramMessage(message);
}

// ---------------------------------------------------------------------------
// Telegram API
// ---------------------------------------------------------------------------

function _sendTelegramMessage(message) {
  const token = CONFIG.TELEGRAM_BOT_TOKEN();
  const chatId = CONFIG.TELEGRAM_CHAT_ID();
  const url = "https://api.telegram.org/bot" + token + "/sendMessage";

  const payload = {
    chat_id: chatId,
    text: message,
    parse_mode: "Markdown", // Using standard Markdown for better stability
    disable_web_page_preview: true,
  };

  const options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const statusCode = response.getResponseCode();

    if (statusCode !== 200) {
      Logger.log("[Notifications] Telegram API error " + statusCode + ": " + response.getContentText());
      return false;
    }

    Logger.log("[Notifications] Telegram alert sent successfully.");
    return true;
  } catch (err) {
    Logger.log("[Notifications] Telegram send error: " + err.message);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Message formatting
// ---------------------------------------------------------------------------

function _buildTelegramMessage(lead, insights, threshold) {
  const scoreBar = _buildScoreBar(insights.interest_score);
  
  // Use Eastern Time as typical for US Mortgage markets, or adjust to your preference
  const callDate = lead.callDate
    ? new Date(lead.callDate).toLocaleString("en-US", { timeZone: "America/New_York" })
    : "N/A";

  // We only escape basic Markdown characters to prevent formatting errors
  const name = _cleanForMarkdown(lead.contactName);
  const agent = _cleanForMarkdown(lead.agentName);
  const summary = _cleanForMarkdown(insights.ai_summary || "No summary available.");

  return (
    "🔥 *HOT LEAD ALERT* (Score ≥ " + threshold + ")\n\n" +
    "*Contact:* " + name + "\n" +
    "📞 *Phone:* " + phone + "\n" + 
    "*Agent:* " + agent + "\n" +
    "*Product:* " + (insights.product_type || "Unknown") + "\n" +
    "*Score:* " + insights.interest_score + "/100 " + scoreBar + "\n" +
    "*Intent:* " + (insights.intent_level || "Warm") + "\n" +
    "*Loan Amount:* " + (insights.loan_amount || "Not specified") + "\n" +
    "*Property State:* " + (insights.property_state || "N/A") + "\n" +
    "*Call Date:* " + callDate + "\n" +
    "*Urgency:* " + (insights.urgency_indicators || "—") + "\n\n" +
    "📋 *AI Summary:*\n" + summary
  );
}

/**
 * Builds a simple visual progress bar for the score.
 */
function _buildScoreBar(score) {
  const filledCount = Math.min(Math.max(Math.round(score / 10), 0), 10);
  return "▓".repeat(filledCount) + "░".repeat(10 - filledCount);
}

/**
 * Basic cleaner for standard Telegram Markdown.
 * Only removes characters that could break the bold/italic formatting.
 */
function _cleanForMarkdown(text) {
  if (!text) return "";
  // In standard Markdown mode, we just need to make sure we don't have stray asterisks or underscores
  return String(text).replace(/[*_]/g, ""); 
}
