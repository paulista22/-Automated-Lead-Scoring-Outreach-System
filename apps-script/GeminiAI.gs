// /**
//  * GeminiAI.gs – AI Intelligence Layer
//  * Optimized for Lead Scoring (0-100) and Automated Outreach.
//  */

// const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

// function scoreLeadWithGemini(lead) {
//   const notes = (lead.rawNotes || "").trim()
//     .replace(/[\x00-\x1F\x7F-\x9F]/g, "") // Clean hidden characters
//     .replace(/"/g, "'"); // Avoid JSON breaking
  
//   if (!notes) return _errorInsights("No notes to analyze");

//   // Safety pause to avoid "Quota Exceeded" errors
//   Utilities.sleep(2000); 

//   const apiKey = CONFIG.GEMINI_API_KEY();
//   const url = `${GEMINI_API_URL}?key=${apiKey}`;

//   const payload = {
//     contents: [{
//       parts: [{
//         text: `Analyze these mortgage notes and respond ONLY with a JSON object.
        
//         NOTES: "${notes}"

//         IMPORTANT RULES:
//         1. "interest_score": Must be a number between 0 and 100.
//         2. "ai_summary_markdown": Use bold text and bullet points for a professional summary.
//         3. "suggested_email_body": Draft a short, professional follow-up email.
        
//         FORMAT: {
//           "product_type": "string",
//           "interest_score": number,
//           "intent_level": "string",
//           "loan_amount": number,
//           "property_state": "string",
//           "urgency_indicators": "string",
//           "ai_summary_markdown": "string",
//           "suggested_email_body": "string"
//         }`
//       }]
//     }],
//     generationConfig: { 
//       responseMimeType: "application/json", 
//       temperature: 0.1 
//     }
//   };

//   try {
//     const response = UrlFetchApp.fetch(url, {
//       method: "post",
//       contentType: "application/json",
//       payload: JSON.stringify(payload),
//       muteHttpExceptions: true
//     });
    
//     const json = JSON.parse(response.getContentText());
//     if (json.error) return _errorInsights(json.error.message);

//     if (!json.candidates || json.candidates.length === 0) {
//       return _errorInsights("No response from AI");
//     }

//     const aiResponseText = json.candidates[0].content.parts[0].text;
//     const result = JSON.parse(aiResponseText);

//     return _validateInsights(result);

//   } catch (err) {
//     Logger.log("❌ AI ERROR: " + err.message);
//     return _errorInsights("Processing failed: " + err.message);
//   }
// }

// // ---------------------------------------------------------------------------
// // Support Functions
// // ---------------------------------------------------------------------------

// function _validateInsights(i) {
//   return {
//     product_type: i.product_type || "Unknown",
//     // Logic: If AI sends 9 instead of 90, we fix it automatically.
//     interest_score: (i.interest_score <= 10 && i.interest_score > 0) ? i.interest_score * 10 : (i.interest_score || 0),
//     intent_level: i.intent_level || "Cold",
//     loan_amount: parseFloat(i.loan_amount) || 0,
//     property_state: i.property_state || "N/A",
//     urgency_indicators: i.urgency_indicators || "N/A",
//     ai_summary_markdown: i.ai_summary_markdown || "No summary available",
//     suggested_email_body: i.suggested_email_body || ""
//   };
// }

// function _errorInsights(msg) {
//   return { 
//     interest_score: 0, 
//     intent_level: "ERROR", 
//     product_type: "UNKNOWN", 
//     loan_amount: 0,
//     property_state: "N/A",
//     urgency_indicators: "N/A",
//     ai_summary_markdown: "⚠️ " + msg,
//     suggested_email_body: ""
//   };
// }

/**
 * GeminiAI.gs – AI Intelligence Layer
 * Optimized for Lead Scoring (0-100) and Automated Outreach.
 */

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

function scoreLeadWithGemini(lead) {
  const notes = (lead.rawNotes || "").trim()
    .replace(/[\x00-\x1F\x7F-\x9F]/g, "") // Clean hidden characters
    .replace(/"/g, "'"); // Avoid JSON breaking
  
  if (!notes) return _errorInsights("No notes to analyze");

  // Safety pause to avoid "Quota Exceeded" errors
  Utilities.sleep(4000); 

  const apiKey = CONFIG.GEMINI_API_KEY();
  const url = `${GEMINI_API_URL}?key=${apiKey}`;

  const payload = {
    contents: [{
      parts: [{
        text: `You are a Non-QM mortgage lead scoring assistant.
Your job is to analyze call notes from agents speaking with mortgage brokers and return a structured JSON score.

## Non-QM Product Catalog
| Product              | Target Borrower                        | Typical Documentation              |
|----------------------|----------------------------------------|------------------------------------|
| Ally – No Ratio      | High net worth, non-traditional income | Flexible income, bank statements   |
| Alt-Doc Activator    | Self-employed, freelancers             | 12-mo bank statements, P&L, 1099   |
| ITIN Activator       | Non-residents with ITIN                | ITIN + alternative docs            |
| DSCR / No Ratio      | Real estate investors                  | DSCR ratio, projected rents        |
| Foreign National     | International buyers                   | Visa + international financial docs|
| Super Jumbo          | High-end / large investment            | Expanded case-by-case              |

## Scoring Rules
- 80–100 → "Hot"   (ready to transact, multiple clients, explicit product request)
- 60–79  → "High"  (clear interest, specific product fit, near-term pipeline)
- 30–59  → "Medium" (interested but comparing, slow pipeline, or callback needed)
- 0–29   → "Low"   (no volume, conventional-only, refused partnership, DNC)

intent_level MUST be exactly one of: "Hot", "High", "Medium", "Low". No other values allowed.

## Few-Shot Examples
Input: "Broker has 3 clients with rental portfolios. Wants min DSCR ratio."
Output: {"product_type":"DSCR","interest_score":95,"intent_level":"Hot","loan_amount":0,"property_state":"N/A","urgency_indicators":"3 active rental clients","ai_summary_markdown":"**High Potential.** Broker has 3 rental properties ready for DSCR review.","suggested_email_body":"Hi [Broker Name], great speaking with you! Our DSCR program is a perfect fit for your rental portfolio clients...\\n\\nBest,\\n[Your Name]"}

Input: "Needs ITIN solutions for FL market. Current lender rejecting 12-mo bank statements."
Output: {"product_type":"ITIN Activator","interest_score":90,"intent_level":"Hot","loan_amount":0,"property_state":"FL","urgency_indicators":"Current lender rejection, active pipeline","ai_summary_markdown":"**Florida Market.** Broker needs ITIN + 12-month bank statement solution urgently.","suggested_email_body":"Hi [Broker Name], we accept 12-month bank statements for ITIN borrowers in Florida...\\n\\nBest,\\n[Your Name]"}

Input: "I work with other Non-QM lenders. What is your underwriting speed?"
Output: {"product_type":"Alt-Doc Activator","interest_score":60,"intent_level":"Medium","loan_amount":0,"property_state":"N/A","urgency_indicators":"Comparing lenders","ai_summary_markdown":"Broker is actively comparing Non-QM lenders. Focus on turn times and service.","suggested_email_body":"Hi [Broker Name], our Alt-Doc underwriting typically closes in 15-20 days...\\n\\nBest,\\n[Your Name]"}

Input: "My firm only does conventional/FHA. No Non-QM, too risky."
Output: {"product_type":"None","interest_score":10,"intent_level":"Low","loan_amount":0,"property_state":"N/A","urgency_indicators":"None","ai_summary_markdown":"Not interested. Conventional-only firm.","suggested_email_body":""}

Input: "Busy with a closing. Call me Tuesday at 10:00 AM."
Output: {"product_type":"None","interest_score":45,"intent_level":"Medium","loan_amount":0,"property_state":"N/A","urgency_indicators":"Callback requested Tuesday 10 AM","ai_summary_markdown":"Broker requested callback. Not available now but open to conversation.","suggested_email_body":"Hi [Broker Name], I will follow up Tuesday at 10:00 AM as requested.\\n\\nBest,\\n[Your Name]"}

## Task
Analyze the following call notes and respond ONLY with a valid JSON object matching the format below.

NOTES: "${notes}"

RULES:
1. "interest_score": number between 0 and 100.
2. "intent_level": MUST be exactly "Hot", "High", "Medium", or "Low".
3. "product_type": use exact product names from the catalog above, or "None" if unclear.
4. "ai_summary_markdown": use bold text and bullet points for a professional summary.
5. "suggested_email_body": use [Broker Name] for recipient and [Your Name] for signature. Empty string if score < 30.

FORMAT:
{
  "product_type": "string",
  "interest_score": number,
  "intent_level": "string",
  "loan_amount": number,
  "property_state": "string",
  "urgency_indicators": "string",
  "ai_summary_markdown": "string",
  "suggested_email_body": "string"
}`
      }]
    }],
    generationConfig: { 
      responseMimeType: "application/json", 
      temperature: 0.1 
    }
  };

  try {
    const response = UrlFetchApp.fetch(url, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
    
    const json = JSON.parse(response.getContentText());
    if (json.error) return _errorInsights(json.error.message);

    if (!json.candidates || json.candidates.length === 0) {
      return _errorInsights("No response from AI");
    }

    const aiResponseText = json.candidates[0].content.parts[0].text;
    const result = JSON.parse(aiResponseText);

    return _validateInsights(result);

  } catch (err) {
    Logger.log("❌ AI ERROR: " + err.message);
    return _errorInsights("Processing failed: " + err.message);
  }
}

// ---------------------------------------------------------------------------
// Support Functions (Remain the same)
// ---------------------------------------------------------------------------

function _validateInsights(i) {
  // Define allowed levels in English
  const validLevels = ["Low", "Medium", "High", "Hot"];
  
  // Logic: Force "Hot" if the score is very high, regardless of AI text
  let assignedIntent = i.intent_level || "Low";
  
  if (i.interest_score >= 80) {
    assignedIntent = "Hot";
  } else if (!validLevels.includes(assignedIntent)) {
    // If AI hallucinates "Contracted" or other terms, we remap based on the score
    if (i.interest_score >= 60) assignedIntent = "High";
    else if (i.interest_score >= 30) assignedIntent = "Medium";
    else assignedIntent = "Low";
  }

  return {
    product_type: i.product_type || "Unknown",
    // Fix: If AI sends 9 instead of 90, we multiply by 10
    interest_score: (i.interest_score <= 10 && i.interest_score > 0) ? i.interest_score * 10 : (i.interest_score || 0),
    intent_level: assignedIntent, 
    loan_amount: parseFloat(i.loan_amount) || 0,
    property_state: i.property_state || "N/A",
    urgency_indicators: i.urgency_indicators || "N/A",
    ai_summary_markdown: i.ai_summary_markdown || "No summary available",
    suggested_email_body: i.suggested_email_body || ""
  };
}

function _errorInsights(msg) {
  return { 
    interest_score: 0, 
    intent_level: "ERROR", 
    product_type: "UNKNOWN", 
    loan_amount: 0,
    property_state: "N/A",
    urgency_indicators: "N/A",
    ai_summary_markdown: "⚠️ " + msg,
    suggested_email_body: ""
  };
}