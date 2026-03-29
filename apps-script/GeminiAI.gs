/**
 * GeminiAI.gs – Phase 2: Intelligence & Processing
 * Optimized version with Error Handling and Correct API Versioning.
 */

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

/**
 * Main scoring entry point
 */
function scoreLeadWithGemini(lead) {
  const prompt = _buildScoringPrompt(lead);
  const apiKey = CONFIG.GEMINI_API_KEY();

  const payload = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.1, 
      topP: 0.8,
      maxOutputTokens: 1024,
      responseMimeType: "application/json",
    }
  };

  const options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  };

  // Construimos la URL con la Key
  const urlWithKey = `${GEMINI_API_URL}?key=${apiKey}`;

  try {
    const response = UrlFetchApp.fetch(urlWithKey, options);
    const statusCode = response.getResponseCode();
    const responseText = response.getContentText();

    if (statusCode !== 200) {
      Logger.log("[GeminiAI] API error " + statusCode + ": " + responseText);
      return _errorInsights("Gemini API error " + statusCode);
    }

    const raw = JSON.parse(responseText);
    
    // Verificación de seguridad por si Gemini no devuelve candidatos
    if (!raw.candidates || raw.candidates.length === 0) {
       return _errorInsights("No candidates returned from Gemini");
    }

    const text = raw.candidates[0].content.parts[0].text;
    const insights = JSON.parse(text);

    return _validateInsights(insights);

  } catch (err) {
    Logger.log("[GeminiAI] FATAL ERROR: " + err.message);
    // PLAN B: Retornamos un objeto seguro para que el Excel no se rompa
    return _errorInsights(err.message);
  }
}

/**
 * Helper to return a safe error object
 */
function _errorInsights(message) {
  return {
    interest_score: 0,
    intent_level: "ERROR",
    product_type: "UNKNOWN",
    loan_amount: null,
    property_state: null,
    urgency_indicators: "Error occurred",
    ai_summary: "System Error: " + message,
    _error: message
  };
}

/**
 * Ensures the AI response has all required fields before saving
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

/**
 * Builds the scoring prompt for Gemini AI (Few-Shot Training)
 */
function _buildScoringPrompt(lead) {
  return `You are a Senior Non-QM Mortgage Underwriter. Analyse broker call notes and respond in structured JSON.

## PRODUCT CATALOGUE
- **DSCR:** Rental income based.
- **ITIN:** No SSN required.
- **Foreign National:** Non-US citizens.
- **Bank Statement:** Self-employed, 12-24mo statements.
- **Alt Doc:** 1099, Asset depletion, etc.

## TRAINING EXAMPLES:
1. Input: "Broker has 3 clients with rental portfolios. Wants min DSCR ratio." 
   Output: {"product_type": "DSCR", "interest_score": 95, "intent_level": "Hot", "loan_amount": null, "property_state": null, "urgency_indicators": "3 rental portfolios", "ai_summary": "High Potential. 3 rental properties."}

2. Input: "Needs ITIN solutions for FL market. Current lender rejecting 12-mo bank statements."
   Output: {"product_type": "ITIN", "interest_score": 90, "intent_level": "Hot", "loan_amount": null, "property_state": "FL", "urgency_indicators": "Lender rejection", "ai_summary": "Florida Market. Needs ITIN fix."}

3. Input: "5th person calling today for DSCR. Not looking for partners."
   Output: {"product_type": "DSCR", "interest_score": 0, "intent_level": "Cold", "loan_amount": null, "property_state": null, "urgency_indicators": "Refused partnership", "ai_summary": "DNC."}

## CALL TO ANALYSE
- **Contact:** ${lead.contactName || "Unknown"}
- **Notes:** ${lead.rawNotes || "No notes available"}

## REQUIRED OUTPUT FORMAT (JSON ONLY)
{
  "product_type": "DSCR | ITIN | Foreign National | Bank Statement | Alt Doc | Unknown",
  "interest_score": 0-100,
  "intent_level": "Hot | Warm | Lukewarm | Cold",
  "loan_amount": number or null,
  "property_state": "2-letter code or null",
  "urgency_indicators": "string",
  "ai_summary": "string"
}

Return ONLY the JSON object. No conversational text.`;
}
