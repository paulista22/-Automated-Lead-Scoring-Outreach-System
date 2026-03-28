"""
data_loader.py – Google Sheets reader for the BI dashboard.

Reads processed lead data from the centralized Google Sheets database
and returns it as a pandas DataFrame for visualization in Streamlit.

Authentication options (checked in order):
  1. GOOGLE_SERVICE_ACCOUNT_JSON env var  – JSON string of service account credentials
  2. service_account.json file in the dashboard directory
  3. ~/.config/gspread/credentials.json   – OAuth credentials (for local dev)
"""

import json
import os
from datetime import datetime
from typing import Optional

import gspread
import pandas as pd
from google.oauth2.service_account import Credentials

# ── Constants ─────────────────────────────────────────────────────────────────

SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets.readonly",
    "https://www.googleapis.com/auth/drive.readonly",
]

SHEET_COLUMNS = [
    "Timestamp", "Contact ID", "Contact Name", "Contact Email", "Contact Phone",
    "Agent Name", "Call Date", "Raw Notes",
    "Product Type", "Interest Score", "Intent Level", "Loan Amount",
    "Property State", "Urgency Indicators", "AI Summary",
    "Email Sent", "Email Subject", "Email Timestamp",
    "Engagement ID", "Status", "Error Message",
]

NUMERIC_COLS = ["Interest Score"]
DATE_COLS = ["Timestamp", "Call Date", "Email Timestamp"]


# ── Main loader ───────────────────────────────────────────────────────────────

def load_leads(spreadsheet_id: str, sheet_name: str = "Leads") -> pd.DataFrame:
    """
    Fetches all lead records from the Google Sheets database.

    Parameters
    ----------
    spreadsheet_id : str
        The Google Sheets document ID (from the URL).
    sheet_name : str
        The worksheet tab name (default: "Leads").

    Returns
    -------
    pd.DataFrame
        Cleaned and typed DataFrame of all processed leads.
    """
    client = _get_gspread_client()
    spreadsheet = client.open_by_key(spreadsheet_id)
    worksheet = spreadsheet.worksheet(sheet_name)

    data = worksheet.get_all_values()
    if len(data) < 2:
        return pd.DataFrame(columns=SHEET_COLUMNS)

    headers = data[0]
    rows = data[1:]
    df = pd.DataFrame(rows, columns=headers)

    return _clean_dataframe(df)


def load_leads_cached(spreadsheet_id: str, sheet_name: str = "Leads") -> pd.DataFrame:
    """
    Streamlit-cache-aware wrapper around load_leads().
    Call this from app.py so Streamlit only re-fetches every 5 minutes.
    """
    return load_leads(spreadsheet_id, sheet_name)


# ── Derived metrics ───────────────────────────────────────────────────────────

def compute_kpis(df: pd.DataFrame) -> dict:
    """Computes high-level KPIs from the leads DataFrame."""
    if df.empty:
        return {
            "total_leads": 0,
            "hot_leads": 0,
            "warm_leads": 0,
            "cold_leads": 0,
            "avg_score": 0.0,
            "emails_sent": 0,
            "conversion_rate": 0.0,
        }

    hot = df[df["Intent Level"] == "Hot"]
    warm = df[df["Intent Level"] == "Warm"]
    cold = df[df["Intent Level"].isin(["Cold", "Lukewarm"])]
    emails = df[df["Email Sent"].isin(["sent", "draft"])]

    return {
        "total_leads": len(df),
        "hot_leads": len(hot),
        "warm_leads": len(warm),
        "cold_leads": len(cold),
        "avg_score": round(df["Interest Score"].mean(), 1),
        "emails_sent": len(emails),
        "conversion_rate": round(len(hot) / len(df) * 100, 1) if len(df) > 0 else 0.0,
    }


def compute_agent_performance(df: pd.DataFrame) -> pd.DataFrame:
    """Returns per-agent metrics sorted by average score descending."""
    if df.empty:
        return pd.DataFrame()

    agg = (
        df.groupby("Agent Name")
        .agg(
            Total_Calls=("Engagement ID", "count"),
            Avg_Score=("Interest Score", "mean"),
            Hot_Leads=("Intent Level", lambda x: (x == "Hot").sum()),
            Warm_Leads=("Intent Level", lambda x: (x == "Warm").sum()),
            Products=("Product Type", lambda x: x.value_counts().index[0] if len(x.value_counts()) > 0 else "N/A"),
        )
        .reset_index()
    )
    agg["Avg_Score"] = agg["Avg_Score"].round(1)
    return agg.sort_values("Avg_Score", ascending=False)


# ── Authentication ─────────────────────────────────────────────────────────────

def _get_gspread_client() -> gspread.Client:
    """Resolves Google credentials and returns an authenticated gspread client."""
    # Option 1: environment variable (for Streamlit Cloud secrets)
    sa_json = os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON")
    if sa_json:
        creds_dict = json.loads(sa_json)
        creds = Credentials.from_service_account_info(creds_dict, scopes=SCOPES)
        return gspread.authorize(creds)

    # Option 2: local service_account.json file
    local_sa = os.path.join(os.path.dirname(__file__), "service_account.json")
    if os.path.exists(local_sa):
        creds = Credentials.from_service_account_file(local_sa, scopes=SCOPES)
        return gspread.authorize(creds)

    # Option 3: OAuth flow (local dev)
    return gspread.oauth()


# ── Cleaning helpers ───────────────────────────────────────────────────────────

def _clean_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    """Coerces dtypes and fills NaNs for a clean, ready-to-use DataFrame."""
    # Ensure all expected columns are present
    for col in SHEET_COLUMNS:
        if col not in df.columns:
            df[col] = ""

    df = df[SHEET_COLUMNS].copy()

    # Numeric coercion
    for col in NUMERIC_COLS:
        df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0).astype(int)

    # Date coercion
    for col in DATE_COLS:
        df[col] = pd.to_datetime(df[col], errors="coerce")

    # Drop fully empty rows
    df = df.dropna(how="all")

    return df
