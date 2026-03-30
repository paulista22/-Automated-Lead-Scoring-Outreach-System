# 🚀 Automated Lead Qualification and Outreach Pipeline

An end-to-end automation pipeline for mortgage broker call qualification, AI scoring, real-time alerts, follow-up drafting, and business intelligence reporting. 📈

---

## 🎯 Project Overview

This project automates the full operational flow from **HubSpot** call records to actionable sales follow-up. ⚡

The pipeline ingests call data, normalizes notes, scores and classifies leads with **Gemini AI**, stores structured outputs in **Google Sheets**, sends hot-lead alerts via **Telegram**, and creates **Gmail** follow-up drafts for qualified opportunities. 🤖

A **Streamlit** dashboard provides KPI tracking, outbound call outcome analysis, and a conversational AI interface for natural language queries. 📊

---

## 💼 Business Problem

High-volume mortgage sales teams need a repeatable way to process and prioritize broker calls. 📈

Manual handling causes:
- ⏳ **Delayed qualification** of high-intent opportunities.
- ⚖️ **Inconsistent lead scoring** and follow-up decisions.
- 🔔 **Slow manager visibility** for urgent leads.
- 📉 **Limited analytics** for product demand, agent performance, and call outcomes.

This solution standardizes and accelerates the process with AI-assisted scoring and automated workflow orchestration. ✅

---

## 🏗️ Architecture

The pipeline operates in three integrated layers:

1. **Data Ingestion and Processing Layer** 📥
2. **Intelligence and Automation Layer** 🧠
3. **Analytics and Decision Layer** 📊

---

## 🖼️ Project Diagram 

![Project Workflow](https://github.com/user-attachments/assets/0f352955-a7b9-4b89-8912-3ce705e3cee2)

---

## 🛠️ Methodology

### 🔹 Phase 1: Data Ingestion and ETL
*Trigger: Time-based scheduler (every 15 minutes).* ⏰

- **API Poll:** Query HubSpot engagements/calls endpoint for new records.
- **Field Extraction:** `hs_call_body`, `hs_call_outcome`, `hubspot_owner_id`, and `hs_timestamp`.
- **Data Normalization:** 🧹
    - Remove HTML tags and special characters.
    - Map HubSpot outcome UUIDs to readable strings.
    - Fetch associated contact details (name, email, phone).
- **Deduplication:** Check against stored engagement IDs to prevent double-processing. 🚫

### 🔹 Phase 2: AI Scoring and Intelligence
*Model: Gemini 2.5 Flash.* 🤖

System prompt design positions the model as a **Non-QM mortgage expert** for product identification and semantic intent analysis.

**Scoring logic:**
- 🔥 **80-100 (Hot):** Ready to transact, explicit product request.
- ⚡ **60-79 (High):** Clear interest, specific product fit.
- 🌱 **30-59 (Medium):** General interest, comparing options.
- ❄️ **0-29 (Low):** No volume, declined partnership.

### 🔹 Phase 3: Real-Time Alerting and Outreach

#### 🚀 3a. Hot Lead Detection
- If `interest_score` >= 80, trigger **Telegram** alert. 📱
- Message includes contact details, agent name, product, and AI summary.
- **Target delivery:** Under 2 seconds. ⚡

#### 📧 3b. Email Automation
- If `interest_score` >= 40, generate follow-up email.
- AI-drafted body personalizes: Broker name, Agent, Product type, and Next steps. 📝
- **Modes:** Draft Mode (Review in Gmail) or Auto-Send Mode.

#### 📁 3c. Data Persistence
All records are appended to **Google Sheets**, including original notes, AI scores, detected products, and executive summaries. 📑

### 🔹 Phase 4: Analytics and Visualization
*Dashboard layer: Streamlit (Python).* 💻
<img width="1906" height="923" alt="a94d1d17-fec8-4ff6-b7be-81b3639e362b" src="https://github.com/user-attachments/assets/3b5b2348-0628-4524-a399-b805f85c249e" />


**KPI Dashboard:**
- 📈 Lead conversion funnel (calls -> qualified -> hot).
- 📊 Interest score distribution and Product demand pie charts.
- 🗺️ Geographic heatmap (state-level analysis).
- 📞 Outbound Calls by Outcome analysis.

---

## 🧰 Skills and Tools Applied

| Category | Tool/Framework | Purpose |
|---|---|---|
| **CRM Integration** | HubSpot API (REST) | Source system for call records |
| **Orchestration** | Google Apps Script | ETL and workflow middleware |
| **AI/ML** | Gemini 2.5 Flash API | Lead scoring and NLP |
| **Messaging** | Telegram Bot API | Instant "Hot Lead" notifications |
| **Email** | Gmail API | Draft/send follow-up emails |
| **Database** | Google Sheets | Central repository |
| **Dashboard** | Streamlit (Python) | Interactive KPI visualization |

---

## 🔐 Security and Data Governance

- **Credentials:** Managed via Apps Script Script Properties and environment variables. 🛡️
- **Confidentiality:** Data processed through this API is **not** used to train public Google models. 🔒
- **Resilience:** Built-in error handling (try-catch) and Mazatlan timezone (GMT-7) support. 🕒

---

## 🏆 Results

This pipeline delivers:
- ✅ **Faster identification** of high-intent leads.
- ✅ **Consistent** and auditable scoring decisions.
- ✅ **Immediate visibility** through real-time alerting.
- ✅ **Higher efficiency** via AI-generated outreach drafts.
- ✅ **Centralized tracking** and analytics in one dashboard.

---

## 🔗 Live Demo Links

- 🌐 **Dashboard URL:** `https://your-dashboard-url.streamlit.app`
- 🎥 **Demo Video:** [Link to Google Drive/YouTube]

---

## 📄 License
MIT
