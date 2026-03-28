# Automated Lead Scoring & Outreach System

> **Zero-Cost AI Pipeline** for qualifying 150–200 daily Non-QM mortgage broker calls.  
> Integrates HubSpot · Gemini 1.5 Flash · Google Sheets · Gmail · Telegram · Streamlit

---

## Architecture Overview

```
HubSpot CRM  ──(15-min poll)──▶  Google Apps Script  ──▶  Gemini 1.5 Flash
                                         │                       │
                                         │                  JSON Insights
                                         │            (score, product, summary)
                                         ▼                       │
                                  Google Sheets ◀────────────────┘
                                         │
                  ┌──────────────────────┼────────────────────┐
                  ▼                      ▼                     ▼
            Gmail Outreach        Telegram Alert         Streamlit BI
          (personalised email)  (score ≥ 80 → HOT)    (KPIs, AI chat)
```

## Tech Stack (Zero-Cost)

| Component | Technology |
|---|---|
| CRM | HubSpot Free Tier |
| Orchestrator | Google Apps Script (JavaScript) |
| AI / NLP | Gemini 1.5 Flash API |
| Database | Google Sheets |
| Email Outreach | Gmail API via Apps Script |
| Hot-Lead Alerts | Telegram Bot API |
| BI Dashboard | Streamlit (Python) |

---

## Repository Structure

```
├── apps-script/                # Google Apps Script (runs inside Google's cloud)
│   ├── appsscript.json         # Project manifest & OAuth scopes
│   ├── Config.gs               # Credential manager (Script Properties)
│   ├── HubSpotETL.gs           # Phase 1 – HubSpot polling & normalisation
│   ├── GeminiAI.gs             # Phase 2 – AI scoring, NLP, email drafting
│   ├── SheetsDB.gs             # Phase 3 – Google Sheets persistence
│   ├── Notifications.gs        # Phase 3 – Telegram hot-lead alerts
│   ├── GmailOutreach.gs        # Phase 3 – Automated email outreach
│   └── Main.gs                 # Orchestrator + time-based trigger
│
└── dashboard/                  # Streamlit BI Dashboard (Phase 4)
    ├── app.py                  # Main application (4 tabs)
    ├── data_loader.py          # Google Sheets reader + KPI computation
    ├── ai_chat.py              # Gemini "Talk to your Data" assistant
    └── requirements.txt        # Python dependencies
```

---

## Setup Guide

### Prerequisites

- Google account with access to Google Drive, Sheets, Gmail, and Apps Script
- HubSpot account (Free tier) with a Private App configured
- Google AI Studio API key ([aistudio.google.com](https://aistudio.google.com))
- Telegram Bot token ([BotFather](https://t.me/BotFather)) + target chat ID

---

### Part 1 – Google Apps Script (Pipeline Engine)

#### 1.1 Create the Apps Script Project

1. Go to [script.google.com](https://script.google.com) → **New project**
2. Name it `Lead Scoring Pipeline`
3. Copy each `.gs` file from `apps-script/` into the project:
   - Click **+** → **Script file** for each `.gs` file
   - Copy/paste the file contents
4. Replace the default `appsscript.json` (Editor → Project Settings → Show appsscript.json) with the contents of `apps-script/appsscript.json`

#### 1.2 Configure Script Properties

Go to **Extensions → Apps Script → Project Settings → Script Properties** and add:

| Property | Description |
|---|---|
| `HUBSPOT_API_KEY` | HubSpot Private App token (starts with `pat-`) |
| `GEMINI_API_KEY` | Google AI Studio API key |
| `SPREADSHEET_ID` | Google Sheets document ID (from the URL) |
| `TELEGRAM_BOT_TOKEN` | Telegram Bot HTTP API token |
| `TELEGRAM_CHAT_ID` | Target Telegram chat or group ID |
| `HUBSPOT_OWNER_EMAIL` | *(Optional)* Sender email for outreach |
| `POLL_INTERVAL_MINUTES` | *(Optional)* Poll frequency, default `15` |
| `HOT_LEAD_THRESHOLD` | *(Optional)* Alert threshold, default `80` |
| `GMAIL_DRAFT_MODE` | *(Optional)* `true` to save drafts instead of sending |

#### 1.3 Create the Google Sheet

1. Create a new Google Sheet
2. Copy the Sheet ID from its URL: `https://docs.google.com/spreadsheets/d/**{SHEET_ID}**/edit`
3. Set `SPREADSHEET_ID` in Script Properties

#### 1.4 Initial Setup

Run these functions once from the Apps Script editor:

```javascript
// 1. Validate all credentials are configured correctly
validateSetup()

// 2. Create the Leads sheet with formatted headers
setupSpreadsheet()

// 3. Install the 15-minute polling trigger
installTrigger()
```

The pipeline will now run automatically every 15 minutes.

---

### Part 2 – Streamlit Dashboard (BI Layer)

#### 2.1 Install Dependencies

```bash
cd dashboard
pip install -r requirements.txt
```

#### 2.2 Configure Credentials

Create a `.env` file in the `dashboard/` directory:

```env
SPREADSHEET_ID=your_google_sheet_id
GEMINI_API_KEY=your_gemini_api_key
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"..."}
```

**Google Service Account setup:**
1. Go to [Google Cloud Console](https://console.cloud.google.com) → IAM & Admin → Service Accounts
2. Create a service account → generate a JSON key
3. Paste the entire JSON as the value of `GOOGLE_SERVICE_ACCOUNT_JSON`
4. Share your Google Sheet with the service account email (Viewer access)

#### 2.3 Run Locally

```bash
cd dashboard
streamlit run app.py
```

#### 2.4 Deploy to Streamlit Cloud (Free)

1. Push this repository to GitHub
2. Go to [streamlit.io/cloud](https://streamlit.io/cloud) → **New app**
3. Select the repository and set **Main file path** to `dashboard/app.py`
4. Add all environment variables under **Advanced settings → Secrets**

---

## Dashboard Features

### 📊 KPI Dashboard
- Total / Hot / Warm / Cold lead counts
- Conversion funnel (calls → qualified leads)
- Interest score distribution with hot-lead threshold line
- Product type breakdown (pie chart)
- Daily leads volume by intent level (stacked bar)

### 🏆 Agent Performance
- Per-agent scorecard: total calls, avg score, hot/warm leads, top product
- Horizontal bar charts: avg score and hot-lead conversion rate
- Score trend over time per agent (line chart)

### 📋 Lead Explorer
- Full-text search across name, product, state, and call notes
- Sortable table with colour-coded intent levels
- Detailed single-lead view with AI summary and email status

### 🤖 AI Assistant ("Talk to your Data")
- Natural language queries powered by Gemini 1.5 Flash
- Semantic search: "loans for foreigners" → Foreign National leads
- Multi-turn conversation with context
- Suggested starter questions

---

## Non-QM Product Reference

The AI scoring engine is trained to identify and classify these products:

| Product | Borrower Profile |
|---|---|
| **DSCR** | Real estate investors; qualified on rental income |
| **ITIN** | Borrowers with Individual Taxpayer ID (no SSN) |
| **Foreign National** | Non-US citizens purchasing US property |
| **Bank Statement** | Self-employed; 12–24 months bank statements |
| **Alt Doc** | 1099 earners, asset depletion, P&L qualified |

### Scoring Thresholds

| Score Range | Intent Level | Action |
|---|---|---|
| 80–100 | 🔴 Hot | Telegram alert + immediate email |
| 60–79 | 🟠 Warm | Personalised email outreach |
| 40–59 | 🟡 Lukewarm | Email outreach |
| 0–39 | ⚪ Cold | No outreach (logged only) |

---

## Security & Data Governance

- **Credential Protection:** All API keys stored in Google Apps Script **Script Properties** – encrypted server-side, never in source code.
- **Processing Privacy:** Data is processed within Google's infrastructure. Sensitive broker information is never exposed to third parties.
- **Enterprise AI Standards:** Gemini API (not consumer Chat) – data processed via API is not used to train public models.
- **Access Control:** Google Sheet is accessible only to explicitly authorized Google accounts/service accounts.

---

## License

MIT
