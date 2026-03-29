/**
 * GmailOutreach.gs – Phase 3: Automated Email Outreach
 *
 * Uses the Gmail API (via Apps Script's built-in GmailApp / MailApp) to send
 * personalised follow-up emails drafted by Gemini AI.
 *
 * Behaviour is controlled by the GMAIL_DRAFT_MODE Script Property:
 *   - false (default) → emails are sent immediately
 *   - true            → emails are saved as Gmail drafts for human review
 */

// ---------------------------------------------------------------------------
// Main outreach entry point
// ---------------------------------------------------------------------------

/**
 * Sends or drafts a personalised follow-up email for the given lead.
 * @param {Object} lead     – Normalised lead from HubSpotETL.gs
 * @param {Object} insights – AI insights from GeminiAI.gs
 * @returns {{ status: string, subject: string }} – Outreach result
 */
function sendFollowUpEmail(lead, insights) {
  // Skip if we have no email address
  if (!lead.contactEmail) {
    Logger.log("[GmailOutreach] No email for contact: " + lead.contactName + ". Skipping.");
    return { status: "skipped_no_email", subject: "" };
  }

  // Generate personalised content via Gemini
  const emailContent = generateFollowUpEmail(lead, insights);

  if (!emailContent.body) {
    Logger.log("[GmailOutreach] Empty email body generated. Skipping.");
    return { status: "skipped_empty_body", subject: emailContent.subject };
  }

  const draftMode = CONFIG.GMAIL_DRAFT_MODE();
  const senderAlias = "rodriguezbritopaulina@gmail.com";

  try {
    if (draftMode) {
      GmailApp.createDraft(
        lead.contactEmail,
        emailContent.subject,
        emailContent.body,
        {
          from: senderAlias,
          name: "Lending Team",
        }
      );
      Logger.log(
        "[GmailOutreach] Draft saved for: " + lead.contactEmail + " | " + emailContent.subject
      );
      return { status: "draft", subject: emailContent.subject };
    } else {
      GmailApp.sendEmail(
        lead.contactEmail,
        emailContent.subject,
        emailContent.body,
        {
          from: senderAlias,
          name: "Lending Team",
          replyTo: senderAlias,
        }
      );
      Logger.log(
        "[GmailOutreach] Email sent to: " + lead.contactEmail + " | " + emailContent.subject
      );
      return { status: "sent", subject: emailContent.subject };
    }
  } catch (err) {
    Logger.log("[GmailOutreach] Error sending email: " + err.message);
    return { status: "error: " + err.message, subject: emailContent.subject };
  }
}

// ---------------------------------------------------------------------------
// Eligibility filter
// ---------------------------------------------------------------------------

/**
 * Determines whether a lead should receive an automated outreach email.
 * Only Warm and Hot leads with valid email addresses are contacted.
 * @param {Object} lead
 * @param {Object} insights
 * @returns {boolean}
 */
function shouldSendOutreach(lead, insights) {
  if (!lead.contactEmail) return false;
  if (insights.interest_score < 40) return false;  // Cold leads → skip
  return true;
}
