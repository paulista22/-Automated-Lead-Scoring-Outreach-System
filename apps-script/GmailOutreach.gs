/**
 * GmailOutreach.gs – Phase 3: Automated Email Outreach
 */

/**
 * Sends or drafts a personalised follow-up email for the given lead.
 */
function sendFollowUpEmail(lead, insights) {
  if (!lead.contactEmail) {
    Logger.log("[GmailOutreach] No email for contact: " + lead.contactName + ". Skipping.");
    return { status: "skipped_no_email", subject: "" };
  }

  // Generate personalized content via Gemini (Assuming this function is in GeminiAI.gs)
  const emailContent = generateFollowUpEmail(lead, insights);

  if (!emailContent.body) {
    Logger.log("[GmailOutreach] Empty email body generated. Skipping.");
    return { status: "skipped_empty_body", subject: emailContent.subject };
  }

  const draftMode = CONFIG.GMAIL_DRAFT_MODE();
  
  // Use Session.getActiveUser().getEmail() to avoid "Invalid Sender" errors during demo
  const senderEmail = Session.getActiveUser().getEmail();

  const options = {
    from: senderEmail,
    name: "Lending Team | NuDesk", // Professional display name
    replyTo: senderEmail
  };

  try {
    if (draftMode) {
      GmailApp.createDraft(
        lead.contactEmail,
        emailContent.subject,
        emailContent.body,
        options
      );
      Logger.log("[GmailOutreach] Draft saved for: " + lead.contactEmail);
      return { status: "draft", subject: emailContent.subject };
    } else {
      // We use GmailApp.sendEmail with a generic body and the body again as a string
      // to ensure line breaks are respected correctly.
      GmailApp.sendEmail(
        lead.contactEmail,
        emailContent.subject,
        emailContent.body,
        options
      );
      Logger.log("[GmailOutreach] Email sent to: " + lead.contactEmail);
      return { status: "sent", subject: emailContent.subject };
    }
  } catch (err) {
    Logger.log("[GmailOutreach] Error in outreach: " + err.message);
    return { status: "error", subject: emailContent.subject };
  }
}

/**
 * Eligibility filter: Only contact leads with actual interest.
 */
function shouldSendOutreach(lead, insights) {
  // Logic: Must have email AND a minimum interest score (e.g., 40+)
  const hasEmail = lead.contactEmail && lead.contactEmail.includes("@");
  const isInterested = (insights.interest_score >= 40);
  
  return hasEmail && isInterested;
}
