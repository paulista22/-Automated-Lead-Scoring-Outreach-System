/**
 * HubSpotETL.gs – Final High-Precision Version (March 2026)
 * Features: Correct Dates, Outcome Translation, and Name Normalization.
 */

function fetchNewCallNotes() {
  const intervalMinutes = CONFIG.POLL_INTERVAL_MINUTES() || 2880; 
  const sinceTimestamp = Date.now() - (intervalMinutes * 60 * 1000);

  Logger.log("[HubSpotETL] Fetching calls since: " + new Date(sinceTimestamp).toISOString());

  const calls = _fetchCallEngagements(sinceTimestamp);
  const leads = [];
  
  for (const call of calls) {
    try {
      const lead = _normaliseCallRecord(call);
      if (lead && lead.contactName !== "Unknown Contact") {
        leads.push(lead);
      }
    } catch (err) {
      Logger.log("❌ Error processing call ID " + call.id + ": " + err.message);
    }
  }
  
  Logger.log("[HubSpotETL] Valid leads found: " + leads.length);
  return leads;
}

function _normaliseCallRecord(callRecord) {
  const props = callRecord.properties || {};
  
  // 1. NOTES CLEANING
  const noteBody = (props.hs_call_body || "")
    .replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

  if (!noteBody) return null;

  // 2. OUTCOME TRANSLATOR
  const outcomeMap = {
    "f240bbac-87c9-4f6e-bf70-924b57d47db7": "Connected",
    "f240bbac-87c9-4f6e-90ed-7c5583d581a3": "Connected",
    "9d9162e7-6cf3-493a-a189-911b519163fe": "Busy",
    "a4c4c304-7bc9-4984-9c46-7359ab43343c": "No Answer",
    "b2cf591d-910a-474b-871d-7d78664426a1": "Wrong Number",
    "73a0d4c6-5d1a-4c17-8d95-ee02f9318153": "Left Voicemail"
  };

  let rawOutcome = (props.hs_call_outcome || props.hs_call_disposition || "").toLowerCase();
  let outcome = outcomeMap[rawOutcome] || "";

  if (!outcome) {
    if (rawOutcome === "" || rawOutcome === "no outcome set") {
      outcome = (props.hs_call_status === "COMPLETED") ? "Connected" : "No Option Selected";
    } else {
      outcome = rawOutcome.charAt(0).toUpperCase() + rawOutcome.slice(1).replace(/_/g, " ");
    }
  }

  // 3. CONTACT DATA & NAME NORMALIZATION
  let contactName = "Unknown Contact", contactEmail = "N/A", contactPhone = "N/A", contactId = "";
  const associatedIds = _fetchCallAssociations(callRecord.id);
  
  if (associatedIds && associatedIds.length > 0) {
    contactId = associatedIds[0];
    const contactProps = _fetchContactDetails(contactId);
    if (contactProps) {
      let rawFullName = `${contactProps.firstname || ""} ${contactProps.lastname || ""}`.trim();
      contactName = _toTitleCase(rawFullName) || "Unknown Contact";
      
      contactEmail = contactProps.email || "N/A";
      contactPhone = contactProps.phone || "N/A";
    }
  }

  // 4. DATE CORRECTION
  let callDate;
  let rawTs = props.hs_timestamp || props.createdate;
  if (rawTs) {
    let tsNum = Number(rawTs);
    callDate = isNaN(tsNum) ? new Date(rawTs) : new Date(tsNum);
  } else {
    callDate = new Date();
  }

  return {
    engagementId: callRecord.id,
    contactId: contactId,
    contactName: contactName,
    contactEmail: contactEmail,
    contactPhone: contactPhone,
    // We also apply Title Case to the Agent Name for consistency
    agentName: _toTitleCase(_fetchOwnerName(props.hubspot_owner_id)),
    callDateObj: callDate, 
    callOutcome: outcome, 
    rawNotes: noteBody
  };
}

// --- API FUNCTIONS ---

function _fetchCallEngagements(sinceTimestamp) {
  const url = "https://api.hubapi.com/crm/v3/objects/calls/search";
  const payload = {
    filterGroups: [{ filters: [{ propertyName: "hs_timestamp", operator: "GTE", value: String(sinceTimestamp) }] }],
    properties: ["hs_call_body", "hubspot_owner_id", "hs_timestamp", "hs_call_outcome", "hs_call_status", "createdate", "hs_call_disposition"],
    sorts: [{ propertyName: "hs_timestamp", direction: "DESCENDING" }],
    limit: 100
  };
  const response = UrlFetchApp.fetch(url, { method: "post", contentType: "application/json", headers: _hubspotHeaders(), payload: JSON.stringify(payload), muteHttpExceptions: true });
  return JSON.parse(response.getContentText()).results || [];
}

function _fetchCallAssociations(callId) {
  const url = `https://api.hubapi.com/crm/v3/objects/calls/${callId}/associations/contacts`;
  const response = UrlFetchApp.fetch(url, { method: "get", headers: _hubspotHeaders(), muteHttpExceptions: true });
  return (JSON.parse(response.getContentText()).results || []).map(r => r.id);
}

function _fetchContactDetails(contactId) {
  const url = `https://api.hubapi.com/crm/v3/objects/contacts/${contactId}?properties=firstname,lastname,email,phone`;
  const response = UrlFetchApp.fetch(url, { method: "get", headers: _hubspotHeaders(), muteHttpExceptions: true });
  return response.getResponseCode() === 200 ? JSON.parse(response.getContentText()).properties : null;
}

function _fetchOwnerName(ownerId) {
  if (!ownerId) return "System Bot";
  const url = `https://api.hubapi.com/crm/v3/owners/${ownerId}`;
  const response = UrlFetchApp.fetch(url, { method: "get", headers: _hubspotHeaders(), muteHttpExceptions: true });
  if (response.getResponseCode() === 200) {
    const data = JSON.parse(response.getContentText());
    return `${data.firstName || ""} ${data.lastName || ""}`.trim();
  }
  return "Agent: " + ownerId;
}

function _hubspotHeaders() {
  return { "Authorization": "Bearer " + CONFIG.HUBSPOT_ACCESS_TOKEN(), "Content-Type": "application/json" };
}

/**
 * Helper to capitalize the first letter of each word (Title Case).
 */
function _toTitleCase(str) {
  if (!str) return "";
  return str.toLowerCase().split(' ').map(word => {
    return word.charAt(0).toUpperCase() + word.slice(1);
  }).join(' ');
}