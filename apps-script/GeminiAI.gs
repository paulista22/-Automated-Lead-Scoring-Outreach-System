/**
 * GeminiAI.gs – Phase 2: Intelligence & Processing
 * * Versión optimizada con Few-Shot Training (10 ejemplos reales).
 */

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

/**
 * Main scoring entry point
 */
function scoreLeadWithGemini(lead) {
  const prompt = _buildScoringPrompt(lead);

  const payload = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.1, // Bajamos a 0.1 para que sea súper preciso con los ejemplos
      topP: 0.8,
      maxOutputTokens: 1024,
      responseMimeType: "application/json",
    },
    safetySettings: [
      { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
    ],
  };

  const options = {
    method: "post",
    contentType: "application/json",
    headers: { "x-goog-api-key": CONFIG.GEMINI_API_KEY() },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  };

  try {
    const response = UrlFetchApp.fetch(GEMINI_API_URL, options);
    const statusCode = response.getResponseCode();

    if (statusCode !== 200) {
      Logger.log("[GeminiAI] API error " + statusCode + ": " + response.getContentText());
      return _errorInsights("Gemini API returned status " + statusCode);
    }

    const raw = JSON.parse(response.getContentText());
    const text = raw.candidates[0].content.parts[0].text;
    const insights = JSON.parse(text);

    return _validateInsights(insights);
  } catch (err) {
    Logger.log("[GeminiAI] Exception: " + err.message);
    return _errorInsights(err.message);
  }
}

/**
 * Personalised follow-up email draft
 */
function generateFollowUpEmail(lead, insights) {
  const prompt = _buildEmailPrompt(lead, insights);
  const payload = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.6, responseMimeType: "application/json" },
  };

  const options = {
    method: "post",
    contentType: "application/json",
    headers: { "x-goog-api-key": CONFIG.GEMINI_API_KEY() },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  };

  try {
    const response = UrlFetchApp.fetch(GEMINI_API_URL, options);
    if (response.getResponseCode() !== 200) return { subject: "Follow-up", body: "" };
    const raw = JSON.parse(response.getContentText());
    return JSON.parse(raw.candidates[0].content.parts[0].text);
  } catch (err) {
    return { subject: "Follow-up on your inquiry", body: "" };
  }
}

// ---------------------------------------------------------------------------
// Prompt Engineering with 10 examples (Training)
// ---------------------------------------------------------------------------

function _buildScoringPrompt(lead) {
  return `You are a Senior Non-QM Mortgage Underwriter. Analyse broker call notes and respond in structured JSON.

## PRODUCT CATALOGUE
- **DSCR:** Rental income based.
- **ITIN:** No SSN required.
- **Foreign National:** Non-US citizens.
- **Bank Statement:** Self-employed, 12-24mo statements.
- **Alt Doc:** 1099, Asset depletion, etc.

## TRAINING EXAMPLES (Follow these strictly):
1. Input: "Broker has 3 clients with rental portfolios. Wants min DSCR ratio." 
   Output: {"product_type": "DSCR", "interest_score": 95, "intent_level": "Hot", "loan_amount": null, "property_state": null, "urgency_indicators": "3 rental portfolios", "ai_summary": "**High Potential.** 3 rental properties."}

2. Input: "Needs ITIN solutions for FL market. Current lender rejecting 12-mo bank statements."
   Output: {"product_type": "ITIN", "interest_score": 90, "intent_level": "Hot", "loan_amount": null, "property_state": "FL", "urgency_indicators": "Lender rejection", "ai_summary": "**Florida Market.** Needs ITIN fix."}

3. Input: "No-DTI is what my high net worth clients want. Send rates and portal link."
   Output: {"product_type": "Alt Doc", "interest_score": 98, "intent_level": "Hot", "loan_amount": null, "property_state": null, "urgency_indicators": "Ready to Sign Up", "ai_summary": "**Ready to Sign Up.** Focus on No-DTI."}

4. Input: "I work with other Non-QM lenders. What is your underwriting speed?"
   Output: {"product_type": "Alt Doc", "interest_score": 65, "intent_level": "Warm", "loan_amount": null, "property_state": null, "urgency_indicators": "Comparing lenders", "ai_summary": "Evaluating speed."}

5. Input: "Sounds good, specially Alt Doc. Send me a summary of star products."
   Output: {"product_type": "Alt Doc", "interest_score": 70, "intent_level": "Warm", "loan_amount": null, "property_state": null, "urgency_indicators": "Interested in summary", "ai_summary": "Product review."}

6. Input: "Client closing soon but DTI too high. Checking if No-DTI fits."
   Output: {"product_type": "Alt Doc", "interest_score": 60, "intent_level": "Warm", "loan_amount": null, "property_state": null, "urgency_indicators": "Closing soon", "ai_summary": "High DTI fix."}

7. Input: "My firm only does conventional/FHA. No Non-QM, too risky."
   Output: {"product_type": "Unknown", "interest_score": 10, "intent_level": "Cold", "loan_amount": null, "property_state": null, "urgency_indicators": "No Non-QM", "ai_summary": "Not Interested."}

8. Input: "5th person calling today for DSCR. Not looking for partners."
   Output: {"product_type": "DSCR", "interest_score": 0, "intent_level": "Cold", "loan_amount": null, "property_state": null, "urgency_indicators": "Refused partnership", "ai_summary": "DNC."}

9. Input: "Market is slow, no leads. Maybe next year."
   Output: {"product_type": "Unknown", "interest_score": 15, "intent_level": "Cold", "loan_amount": null, "property_state": null, "urgency_indicators": "No Volume", "ai_summary": "Market slow."}

10. Input: "Busy with a closing. Call me Tuesday at 10:00 AM."
    Output: {"product_type": "Unknown", "interest_score": 50, "intent_level": "Lukewarm", "loan_amount": null, "property_state": null, "urgency_indicators": "Callback requested", "ai_summary": "Tuesday follow-up."}

## CALL TO ANALYSE
- **Contact:** ${lead.contactName}
- **Agent:** ${lead.agentName}
- **Notes:** ${lead.rawNotes}

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

Return ONLY the JSON. No conversational text.`;
}
