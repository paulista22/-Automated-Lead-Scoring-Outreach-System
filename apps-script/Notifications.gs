/**
 * Notifications.gs – Phase 3: Real-Time Alerting
 *
 * Sends an instant Telegram notification to the designated manager chat
 * whenever a lead's interest_score exceeds the HOT_LEAD_THRESHOLD (default 80).
 *
 * Telegram Bot API reference:
 *   POST https://api.telegram.org/bot{TOKEN}/sendMessage
 */

// ---------------------------------------------------------------------------
// Main notification entry point
// ---------------------------------------------------------------------------

/**
 * Evaluates a lead's score and fires a Telegram alert if it is a Hot Lead.
 * @param {Object} lead     – Normalised lead object
 * @param {Object} insights – AI insights from GeminiAI.gs
 * @returns {boolean}       – true if alert was sent
 */
function notifyIfHotLead(lead, insights) {
  const threshold = CONFIG.HOT_LEAD_THRESHOLD();

  if (insights.interest_score < threshold) return false;

  Logger.log(
    "[Notifications] Hot lead detected: " +
      lead.contactName +
      " (score: " +
      insights.interest_score +
      ")"
  );

  const message = _buildTelegramMessage(lead, insights, threshold);
  return _sendTelegramMessage(message);
}

// ---------------------------------------------------------------------------
// Telegram API
// ---------------------------------------------------------------------------

/**
 * Sends a Markdown-formatted message to the configured Telegram chat.
 * @param {string} message – The text to send (supports Telegram Markdown v2)
 * @returns {boolean}      – true on success
 */
function _sendTelegramMessage(message) {
  const token = CONFIG.TELEGRAM_BOT_TOKEN();
  const chatId = CONFIG.TELEGRAM_CHAT_ID();
  const url = "https://api.telegram.org/bot" + token + "/sendMessage";

  const payload = {
    chat_id: chatId,
    text: message,
    parse_mode: "Markdown",
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
      Logger.log(
        "[Notifications] Telegram API error " +
          statusCode +
          ": " +
          response.getContentText()
      );
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
  const callDate = lead.callDate
    ? new Date(lead.callDate).toLocaleString("en-US", { timeZone: "America/New_York" })
    : "N/A";

  // Keep special Markdown characters escaped for Telegram
  const name = _escapeMarkdown(lead.contactName);
  const agent = _escapeMarkdown(lead.agentName);
  const product = _escapeMarkdown(insights.product_type);
  const urgency = _escapeMarkdown(insights.urgency_indicators || "—");
  const loanAmt = _escapeMarkdown(insights.loan_amount || "Not specified");
  const state = _escapeMarkdown(insights.property_state || "Not specified");

  return (
    "🔥 *HOT LEAD ALERT* (Score ≥ " +
    threshold +
    ")\n\n" +
    "*Contact:* " + name + "\n" +
    "*Agent:* " + agent + "\n" +
    "*Product:* " + product + "\n" +
    "*Score:* " + insights.interest_score + "/100 " + scoreBar + "\n" +
    "*Intent:* " + insights.intent_level + "\n" +
    "*Loan Amount:* " + loanAmt + "\n" +
    "*Property State:* " + state + "\n" +
    "*Call Date:* " + callDate + "\n" +
    "*Urgency Signals:* " + urgency + "\n\n" +
    "📋 *Summary:*\n" +
    _escapeMarkdown(insights.ai_summary || "No summary available.")
  );
}

/**
 * Builds a simple ASCII progress bar for the score.
 */
function _buildScoreBar(score) {
  const filled = Math.round(score / 10);
  return "▓".repeat(filled) + "░".repeat(10 - filled);
}

/**
 * Escapes special characters for Telegram Markdown (legacy mode).
 */
function _escapeMarkdown(text) {
  if (!text) return "";
  return String(text).replace(/[_*[\]()~`>#+\-=|{}.!]/g, "\\$&");
}
