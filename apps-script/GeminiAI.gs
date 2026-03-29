/**
 * GeminiAI.gs – Phase 2: Intelligence & Processing
 * Corrected version by Gemini for Paulina Brito.
 */

// v1beta is the documented stable path for gemini-1.5-flash
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

/**
 * Main scoring entry point
 */
function scoreLeadWithGemini(lead) {
  // Guard: skip API call entirely when there are no notes to analyse
  const notes = (lead.rawNotes || "").trim();
  if (!notes) {
    Logger.log("[GeminiAI] No notes to analyse for: " + (lead.contactName || "unknown"));
    return _errorInsights("No call notes to analyse");
  }

  const apiKey = CONFIG.GEMINI_API_KEY();
  const prompt = _buildScoringPrompt(lead);

  const url = `${GEMINI_API_URL}?key=${apiKey}`;

  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.1,
      topP: 0.8,
      maxOutputTokens: 1024
    }
  };

  const options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();

    // Log non-200 responses immediately for easier debugging
    if (responseCode !== 200) {
      Logger.log("[GeminiAI] HTTP " + responseCode + " from Gemini API: " + responseText);
      return _errorInsights("Gemini API returned HTTP " + responseCode);
    }

    const json = JSON.parse(responseText);

    if (!json.candidates || json.candidates.length === 0) {
      // Surface the safety-block reason if present
      const blockReason =
        json.promptFeedback && json.promptFeedback.blockReason
          ? json.promptFeedback.blockReason
          : "unknown";
      Logger.log("[GeminiAI] No candidates returned. blockReason: " + blockReason);
      Logger.log("[GeminiAI] Full response: " + responseText);
      return _errorInsights("No response from Gemini API (blockReason: " + blockReason + ")");
    }

    let text = json.candidates[0].content.parts[0].text;

    // Clean Markdown formatting if present
    text = text.replace(/```json/g, "").replace(/```/g, "").trim();

    const insights = JSON.parse(text);
    return _validateInsights(insights);

  } catch (err) {
    Logger.log("❌ GEMINI ERROR: " + err.message);
    return _errorInsights(err.message);
  }
}

/**
 * Builds the prompt using CLEANED notes to avoid HTML interference
 */
function _buildScoringPrompt(lead) {
  // DATA CLEANING: Removes HTML tags and extra whitespace
  const cleanNotes = (lead.rawNotes || "")
    .replace(/<[^>]*>/g, ' ') 
    .replace(/\s+/g, ' ')     
    .trim();

  return `You are a Senior Non-QM Mortgage Underwriter. 
  Analyse the following broker call notes and respond ONLY with a valid JSON object.

  CALL NOTES:
  "${cleanNotes}"

  REQUIRED JSON FORMAT:
  {
    "product_type": "DSCR | ITIN | Bank Statement | Alt Doc | Unknown",
    "interest_score": 0-100,
    "intent_level": "Hot | Warm | Lukewarm | Cold",
    "loan_amount": number or null,
    "property_state": "2-letter state code or null",
    "urgency_indicators": "string",
    "ai_summary": "short technical summary"
  }`;
}

/**
 * Provides a safe fallback object if the AI fails
 */
function _errorInsights(message) {
  return {
    interest_score: 0,
    intent_level: "ERROR",
    product_type: "UNKNOWN",
    loan_amount: null,
    property_state: null,
    urgency_indicators: "Error occurred",
    ai_summary: "System Error: " + message
  };
}

/**
 * Ensures the response object is complete before saving to Sheets
 */
function _validateInsights(insights) {
  return {
    product_type: insights.product_type || "Unknown",
    interest_score: parseInt(insights.interest_score) || 0,
    intent_level: insights.intent_level || "Unknown",
    loan_amount: insights.loan_amount || null,
    property_state: insights.property_state || null,
    urgency_indicators: insights.urgency_indicators || "None detected",
    ai_summary: insights.ai_summary || "No summary generated"
  };
}
