/**
 * HubSpotETL.gs – Phase 1: Data Ingestion & Connectivity
 *
 * Polls HubSpot for call engagements created in the last POLL_INTERVAL_MINUTES
 * and returns an array of normalised lead objects ready for AI processing.
 *
 * HubSpot API reference:
 *   GET /crm/v3/objects/calls  – list call engagements
 *   GET /crm/v3/objects/contacts/{id}  – fetch contact details
 */

// ---------------------------------------------------------------------------
// Main ETL entry point
// ---------------------------------------------------------------------------

/**
 * Fetches new HubSpot call notes created since the last run.
 * @returns {Object[]} Array of normalised lead records.
 */
function fetchNewCallNotes() {
  const intervalMs = CONFIG.POLL_INTERVAL_MINUTES() * 60 * 1000;
  const sinceTimestamp = Date.now() - intervalMs;

  Logger.log("[HubSpotETL] Fetching calls since: " + new Date(sinceTimestamp).toISOString());

  const calls = _fetchCallEngagements(sinceTimestamp);
  Logger.log("[HubSpotETL] Calls found: " + calls.length);

  const leads = [];
  for (const call of calls) {
    try {
      const lead = _normaliseCallRecord(call);
      if (lead) leads.push(lead);
    } catch (err) {
      Logger.log("[HubSpotETL] Error normalising call " + call.id + ": " + err.message);
    }
  }

  return leads;
}

// ---------------------------------------------------------------------------
// HubSpot API calls
// ---------------------------------------------------------------------------

/**
 * Fetches call engagements from HubSpot created after sinceTimestamp.
 * Uses cursor-based pagination to retrieve all results.
 */
function _fetchCallEngagements(sinceTimestamp) {
  const baseUrl = "https://api.hubapi.com/crm/v3/objects/calls";
  const properties = "hs_call_body,hs_call_title,hs_call_direction,hs_call_status,hs_timestamp,hubspot_owner_id";
  const filterPayload = {
    filterGroups: [
      {
        filters: [
          {
            propertyName: "hs_timestamp",
            operator: "GTE",
            value: String(sinceTimestamp),
          },
          {
            propertyName: "hs_call_status",
            operator: "EQ",
            value: "COMPLETED",
          },
        ],
      },
    ],
    properties: properties.split(","),
    limit: 100,
  };

  const options = {
    method: "post",
    contentType: "application/json",
    headers: _hubspotHeaders(),
    payload: JSON.stringify(filterPayload),
    muteHttpExceptions: true,
  };

  const url = baseUrl + "/search";
  const allResults = [];
  let after = null;

  do {
    const body = Object.assign({}, filterPayload, after ? { after: after } : {});
    options.payload = JSON.stringify(body);

    const response = UrlFetchApp.fetch(url, options);
    const statusCode = response.getResponseCode();

    if (statusCode !== 200) {
      Logger.log("[HubSpotETL] Search API error " + statusCode + ": " + response.getContentText());
      break;
    }

    const data = JSON.parse(response.getContentText());
    if (data.results) allResults.push(...data.results);

    after = data.paging && data.paging.next ? data.paging.next.after : null;
  } while (after);

  return allResults;
}

/**
 * Fetches a single contact's properties by HubSpot contact ID.
 */
function _fetchContact(contactId) {
  if (!contactId) return null;

  const url =
    "https://api.hubapi.com/crm/v3/objects/contacts/" +
    contactId +
    "?properties=firstname,lastname,email,phone,hubspot_owner_id";

  const options = {
    method: "get",
    headers: _hubspotHeaders(),
    muteHttpExceptions: true,
  };

  const response = UrlFetchApp.fetch(url, options);
  if (response.getResponseCode() !== 200) return null;

  return JSON.parse(response.getContentText());
}

/**
 * Fetches the associations (contact IDs) for a given call engagement.
 */
function _fetchCallAssociations(callId) {
  const url =
    "https://api.hubapi.com/crm/v3/objects/calls/" +
    callId +
    "/associations/contacts";

  const options = {
    method: "get",
    headers: _hubspotHeaders(),
    muteHttpExceptions: true,
  };

  const response = UrlFetchApp.fetch(url, options);
  if (response.getResponseCode() !== 200) return [];

  const data = JSON.parse(response.getContentText());
  return (data.results || []).map(function (r) { return r.id; });
}

/**
 * Resolves a HubSpot owner ID to a display name.
 */
function _fetchOwnerName(ownerId) {
  if (!ownerId) return "Unknown Agent";

  const url = "https://api.hubapi.com/crm/v3/owners/" + ownerId;
  const options = {
    method: "get",
    headers: _hubspotHeaders(),
    muteHttpExceptions: true,
  };

  const response = UrlFetchApp.fetch(url, options);
  if (response.getResponseCode() !== 200) return "Owner #" + ownerId;

  const data = JSON.parse(response.getContentText());
  return (data.firstName || "") + " " + (data.lastName || "").trim();
}

// ---------------------------------------------------------------------------
// Normalisation
// ---------------------------------------------------------------------------

/**
 * Converts a raw HubSpot call engagement into a flat lead object.
 */
function _normaliseCallRecord(callRecord) {
  const props = callRecord.properties || {};
  const noteBody = (props.hs_call_body || "").trim();

  // Skip calls with empty notes – nothing to process
  if (!noteBody) return null;

  // Resolve contact details
  const associatedContactIds = _fetchCallAssociations(callRecord.id);
  const primaryContactId = associatedContactIds[0] || null;
  const contact = primaryContactId ? _fetchContact(primaryContactId) : null;
  const contactProps = contact ? contact.properties || {} : {};

  // Resolve agent/owner name
  const ownerId = props.hubspot_owner_id || contactProps.hubspot_owner_id || null;
  const agentName = _fetchOwnerName(ownerId);

  return {
    engagementId: callRecord.id,
    contactId: primaryContactId || "",
    contactName:
      ((contactProps.firstname || "") + " " + (contactProps.lastname || "")).trim() ||
      "Unknown Contact",
    contactEmail: contactProps.email || "",
    contactPhone: contactProps.phone || "",
    agentName: agentName,
    callDate: props.hs_timestamp
      ? new Date(parseInt(props.hs_timestamp)).toISOString()
      : new Date().toISOString(),
    rawNotes: noteBody,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function _hubspotHeaders() {
  return {
    Authorization: "Bearer " + CONFIG.HUBSPOT_API_KEY(),
    "Content-Type": "application/json",
  };
}
