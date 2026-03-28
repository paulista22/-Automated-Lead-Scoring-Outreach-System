/**
 * GeminiAI.gs – Phase 2: Intelligence & Processing
 *
 * Sends normalised call notes to Gemini 1.5 Flash and returns a structured
 * JSON object containing scores, product classification, and an executive
 * summary formatted in Markdown.
 *
 * The prompt positions the model as a Senior Non-QM Underwriter to ensure
 * mortgage-specific context awareness (DSCR, ITIN, Foreign National,
 * Bank Statement, Alt Doc).
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

// ---------------------------------------------------------------------------
// Main scoring entry point
// ---------------------------------------------------------------------------

/**
 * Analyses a single lead's call notes with Gemini 1.5 Flash.
 * @param {Object} lead  – Normalised lead object from HubSpotETL.gs
 * @returns {Object}     – AI insights object or error sentinel
 */
function scoreLeadWithGemini(lead) {
  const prompt = _buildScoringPrompt(lead);

  const payload = {
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      temperature: 0.2,       // Low temperature → deterministic, factual output
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
 * Generates a personalised follow-up email draft for a lead.
 * @param {Object} lead     – Normalised lead
 * @param {Object} insights – AI insights from scoreLeadWithGemini()
 * @returns {{ subject: string, body: string }}
 */
function generateFollowUpEmail(lead, insights) {
  const prompt = _buildEmailPrompt(lead, insights);

  const payload = {
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      temperature: 0.6,
      topP: 0.9,
      maxOutputTokens: 800,
      responseMimeType: "application/json",
    },
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
    if (response.getResponseCode() !== 200) {
      return { subject: "Follow-up on your inquiry", body: "" };
    }
    const raw = JSON.parse(response.getContentText());
    const text = raw.candidates[0].content.parts[0].text;
    return JSON.parse(text);
  } catch (err) {
    Logger.log("[GeminiAI] generateFollowUpEmail error: " + err.message);
    return { subject: "Follow-up on your inquiry", body: "" };
  }
}

// ---------------------------------------------------------------------------
// Prompt engineering
// ---------------------------------------------------------------------------

function _buildScoringPrompt(lead) {
  return `You are a Senior Non-QM Mortgage Underwriter and Sales Intelligence Analyst at a specialty lending company. Your task is to analyse a broker call note and extract structured intelligence.

## COMPANY PRODUCT CATALOGUE
- **DSCR (Debt Service Coverage Ratio):** Investment property loans qualified by the property's rental income rather than the borrower's personal income. Ideal for real estate investors.
- **ITIN Loans:** Mortgage products for borrowers who do not have a Social Security Number but have an Individual Taxpayer Identification Number. Common for immigrant communities.
- **Foreign National Loans:** Mortgages for non-US citizens/residents purchasing US property. No US credit history required.
- **Bank Statement Loans:** Self-employed borrower loans qualified using 12–24 months of business or personal bank statements instead of tax returns.
- **Alt Doc Loans:** Alternative documentation loans for borrowers who cannot qualify with traditional income documentation (1099, asset depletion, P&L statements, etc.).

## SCORING CRITERIA (Interest Score 0–100)
- **80–100 (Hot):** Broker has a specific client ready to close, mentions loan amounts, property address, or tight timeline (< 30 days).
- **60–79 (Warm):** Broker is actively working a client deal, discussing product fit, requesting term sheets or rates.
- **40–59 (Lukewarm):** General inquiry about products, rates, or guidelines with no specific client mentioned.
- **0–39 (Cold):** Exploratory conversation, no actionable opportunity, or broker is window-shopping.

## INTENT ESCALATION INDICATORS (boosts score)
- Mentions a closing deadline or target close date (+15)
- Specific loan amount cited (+10)
- Mentions property address or state (+10)
- References a time-sensitive client situation (+10)
- Asks for term sheet, rate lock, or commitment letter (+15)

## CALL NOTE TO ANALYSE
- **Contact:** ${lead.contactName}
- **Agent:** ${lead.agentName}
- **Call Date:** ${lead.callDate}
- **Notes:** ${lead.rawNotes}

## REQUIRED OUTPUT FORMAT
Respond ONLY with a valid JSON object matching this exact schema (no markdown fences):
{
  "product_type": "<DSCR|ITIN|Foreign National|Bank Statement|Alt Doc|Unknown>",
  "interest_score": <integer 0-100>,
  "intent_level": "<Hot|Warm|Lukewarm|Cold>",
  "loan_amount": "<extracted dollar amount or null>",
  "property_state": "<2-letter US state code or null>",
  "urgency_indicators": "<comma-separated key phrases that signal urgency>",
  "ai_summary": "<Executive summary in Markdown. 3–5 bullet points. Include: product fit rationale, borrower profile, urgency level, recommended next action. Keep under 200 words.>"
}`;
}

function _buildEmailPrompt(lead, insights) {
  return `You are a professional mortgage sales correspondent. Write a personalised follow-up email from our team to the broker after a call.

## CONTEXT
- **Broker Name:** ${lead.contactName}
- **Product Discussed:** ${insights.product_type}
- **Interest Score:** ${insights.interest_score}/100
- **Intent Level:** ${insights.intent_level}
- **Summary:** ${insights.ai_summary}
- **Loan Amount:** ${insights.loan_amount || "not specified"}
- **Property State:** ${insights.property_state || "not specified"}

## GUIDELINES
- Professional yet warm tone
- Reference specific product and client situation from the call
- Include a clear call to action (schedule a call, send docs, etc.)
- Keep under 150 words
- Do NOT use placeholders like [NAME] – use the actual names provided

## REQUIRED OUTPUT FORMAT
Respond ONLY with a valid JSON object (no markdown fences):
{
  "subject": "<compelling email subject line>",
  "body": "<full email body text, plain text format>"
}`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function _validateInsights(raw) {
  return {
    product_type: raw.product_type || "Unknown",
    interest_score: Math.min(100, Math.max(0, parseInt(raw.interest_score) || 0)),
    intent_level: raw.intent_level || "Cold",
    loan_amount: raw.loan_amount || null,
    property_state: raw.property_state || null,
    urgency_indicators: raw.urgency_indicators || "",
    ai_summary: raw.ai_summary || "",
  };
}

function _errorInsights(message) {
  return {
    product_type: "Unknown",
    interest_score: 0,
    intent_level: "Cold",
    loan_amount: null,
    property_state: null,
    urgency_indicators: "",
    ai_summary: "",
    _error: message,
  };
}
