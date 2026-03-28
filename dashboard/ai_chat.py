"""
ai_chat.py – Gemini-powered "Talk to your Data" assistant.

Implements semantic search over the leads DataFrame so managers can ask
natural language questions like:
  "Show me all DSCR loans in Texas above $500k"
  "Which agents have the most hot leads this week?"
  "Find loans for foreigners" → correctly maps to Foreign National product

The assistant uses Gemini 1.5 Flash with the full data context injected
into each request (works within the free tier for typical sheet sizes).
"""

import json
import os
from typing import Optional

import pandas as pd
from google import genai
from google.genai import types

# ── Gemini configuration ──────────────────────────────────────────────────────

GEMINI_MODEL = "gemini-1.5-flash"

SYSTEM_PROMPT = """You are an expert mortgage sales intelligence assistant embedded in a BI dashboard.
You have deep knowledge of Non-QM mortgage products:
- DSCR: Investment property loans qualifying on rental income
- ITIN: Mortgages for borrowers with Individual Taxpayer Identification Numbers (immigrant community)
- Foreign National: Loans for non-US citizens/residents (no US credit history required)
- Bank Statement: Self-employed borrowers using 12-24 months bank statements
- Alt Doc: Alternative documentation loans (1099, asset depletion, P&L)

You will receive:
1. A natural language question from a mortgage sales manager
2. A JSON summary of the leads data

Provide a concise, actionable answer. Use markdown formatting.
Always interpret queries semantically:
  - "loans for foreigners" = Foreign National product
  - "self-employed" = Bank Statement or Alt Doc
  - "investors" = DSCR
  - "immigrants" or "no SSN" = ITIN
"""


def create_chat_response(
    question: str,
    df: pd.DataFrame,
    api_key: str,
    chat_history: Optional[list] = None,
) -> str:
    """
    Generates a Gemini AI response to a natural language question about the leads data.

    Parameters
    ----------
    question : str
        The manager's question.
    df : pd.DataFrame
        The full leads DataFrame (or a recent slice).
    api_key : str
        Gemini API key.
    chat_history : list, optional
        Previous [(role, text), ...] turns for multi-turn conversation context.

    Returns
    -------
    str
        Markdown-formatted answer from Gemini.
    """
    client = genai.Client(api_key=api_key)

    # Build a compact data context (avoid sending raw notes to save tokens)
    data_context = _build_data_context(df)

    # Compose the prompt
    prompt = f"""## Current Leads Data Summary
{data_context}

## Manager Question
{question}"""

    # Build conversation history for multi-turn context
    history: list[types.Content] = []
    if chat_history:
        for role, text in chat_history[:-1]:  # Exclude the latest user message
            history.append(
                types.Content(
                    role=role,
                    parts=[types.Part(text=text)],
                )
            )

    try:
        chat = client.chats.create(
            model=GEMINI_MODEL,
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_PROMPT,
                temperature=0.5,
                max_output_tokens=1024,
            ),
            history=history,
        )
        response = chat.send_message(prompt)
        return response.text
    except Exception as exc:
        return f"⚠️ AI assistant error: {exc}"


def _build_data_context(df: pd.DataFrame) -> str:
    """
    Builds a compact JSON summary of the DataFrame to inject into the prompt.
    Keeps token count low by excluding raw notes and summaries.
    """
    if df.empty:
        return "No data available yet."

    safe_cols = [
        "Contact Name", "Agent Name", "Call Date",
        "Product Type", "Interest Score", "Intent Level",
        "Loan Amount", "Property State", "Email Sent",
    ]
    available = [c for c in safe_cols if c in df.columns]
    subset = df[available].copy()

    # Format dates as strings
    for col in subset.select_dtypes(include=["datetime64[ns]", "datetimetz"]):
        subset[col] = subset[col].dt.strftime("%Y-%m-%d").fillna("")

    # Truncate to last 200 rows to stay within token limits
    if len(subset) > 200:
        subset = subset.tail(200)

    summary = {
        "total_records": len(df),
        "date_range": {
            "from": str(df["Call Date"].min()) if "Call Date" in df.columns else "N/A",
            "to": str(df["Call Date"].max()) if "Call Date" in df.columns else "N/A",
        },
        "score_stats": {
            "mean": round(df["Interest Score"].mean(), 1) if "Interest Score" in df.columns else 0,
            "max": int(df["Interest Score"].max()) if "Interest Score" in df.columns else 0,
            "min": int(df["Interest Score"].min()) if "Interest Score" in df.columns else 0,
        },
        "product_distribution": df["Product Type"].value_counts().to_dict() if "Product Type" in df.columns else {},
        "intent_distribution": df["Intent Level"].value_counts().to_dict() if "Intent Level" in df.columns else {},
        "records_sample": json.loads(subset.to_json(orient="records")),
    }

    return json.dumps(summary, indent=2, default=str)
