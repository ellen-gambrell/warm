"""
Chat route — Gemini-powered conversation with tool support.

POST /api/chat/message
  Body:    { message: str, history: [{role: "user"|"model", text: str}] }
  Returns: { reply: str, pending_action: null | PendingAction }

POST /api/chat/execute
  Body:    { action_type: str, params: {...} }
  Returns: { result: str }

PendingAction:
  { type: str, label: str, description: str, params: {...} }
  Frontend shows ConfirmationPanel; nothing executes until user confirms.
"""

import os
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from .auth import get_current_user

chat_router = APIRouter()

# ── System prompt ──────────────────────────────────────────────────────────────

BASE_SYSTEM_PROMPT = (
    "You are a warm, helpful personal assistant for someone with a spinal cord injury "
    "who uses a stylus and voice to interact with their phone. Keep responses concise and "
    "friendly. Use plain language. When listing things, use bullet points. "
    "If asked to help with a task (send a message, look something up, etc.), be direct and practical. "
    "Address the user by first name if you know it from the conversation.\n\n"
    "IMPORTANT — when to use tools:\n"
    "• If the user asks you to write or send an email to someone, ALWAYS use the compose_email "
    "function. Never just describe what you would write — use the function every time.\n"
    "• Never execute any action on your own. Always propose first and let the user confirm."
)

FINANCIAL_KEYWORDS = {
    "spend", "spent", "spending", "transaction", "transactions", "money", "account",
    "accounts", "balance", "bill", "bills", "budget", "budgets", "pay", "paid",
    "payment", "payments", "monarch", "finance", "financial", "income", "expense",
    "expenses", "credit", "debit", "charge", "charged", "grocery", "groceries",
    "subscription", "subscriptions", "bank",
}

# ── Pydantic models ────────────────────────────────────────────────────────────

class HistoryItem(BaseModel):
    role: Literal["user", "model"]
    text: str


HISTORY_MAX = 20


class ChatRequest(BaseModel):
    message: str = Field(max_length=4000)
    history: list[HistoryItem] = []


class ExecuteRequest(BaseModel):
    action_type: str
    params: dict


# ── Tool definitions ───────────────────────────────────────────────────────────

def _build_tools(types_module):
    """Build Gemini FunctionDeclaration tool list."""
    types = types_module
    return [
        types.Tool(
            function_declarations=[
                types.FunctionDeclaration(
                    name="compose_email",
                    description=(
                        "Draft an email to send on the user's behalf. "
                        "Use this whenever the user asks to write, compose, or send an email to anyone. "
                        "The draft will be shown to the user for their review and confirmation — "
                        "nothing is sent automatically."
                    ),
                    parameters=types.Schema(
                        type=types.Type.OBJECT,
                        properties={
                            "to_name": types.Schema(
                                type=types.Type.STRING,
                                description="Recipient's name",
                            ),
                            "to_email": types.Schema(
                                type=types.Type.STRING,
                                description="Recipient's email address if known; omit if unknown",
                            ),
                            "subject": types.Schema(
                                type=types.Type.STRING,
                                description="Email subject line",
                            ),
                            "body": types.Schema(
                                type=types.Type.STRING,
                                description="Email body in plain text (no HTML)",
                            ),
                        },
                        required=["to_name", "subject", "body"],
                    ),
                ),
            ]
        )
    ]


# ── Main chat endpoint ─────────────────────────────────────────────────────────

@chat_router.post("/api/chat/message")
async def chat_message(body: ChatRequest, user: dict = Depends(get_current_user)):
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY is not configured.")

    # Optionally inject Monarch financial context when the message is financial
    monarch_context = ""
    msg_lower = body.message.lower()
    if any(kw in msg_lower for kw in FINANCIAL_KEYWORDS):
        try:
            from .monarch import get_monarch_summary_text
            monarch_context = await get_monarch_summary_text(user["sub"])
        except Exception:
            pass

    system_prompt = BASE_SYSTEM_PROMPT
    if monarch_context:
        system_prompt = f"{BASE_SYSTEM_PROMPT}\n\n{monarch_context}"

    try:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=api_key)

        # Build conversation contents (no system prompt in contents — passed via config)
        contents = []
        for item in body.history[-HISTORY_MAX:]:
            contents.append(
                types.Content(
                    role=item.role,
                    parts=[types.Part(text=item.text)],
                )
            )
        contents.append(
            types.Content(
                role="user",
                parts=[types.Part(text=body.message)],
            )
        )

        tools = _build_tools(types)

        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=contents,
            config=types.GenerateContentConfig(
                system_instruction=system_prompt,
                tools=tools,
            ),
        )

        # Parse all parts — may be text, function_call, or both
        candidate = response.candidates[0]
        text_parts: list[str] = []
        function_call = None

        for part in candidate.content.parts:
            if getattr(part, "text", None):
                text_parts.append(part.text)
            fc = getattr(part, "function_call", None)
            if fc is not None and getattr(fc, "name", None):
                function_call = fc

        reply_text = "".join(text_parts)

        # ── compose_email tool call → ConfirmationPanel ────────────────────────
        if function_call and function_call.name == "compose_email":
            fc_args = dict(function_call.args) if function_call.args else {}
            to_name = fc_args.get("to_name", "your recipient")
            default_reply = (
                f"I've drafted an email to {to_name}. "
                "Please review it below and tap Confirm to open it in your mail app."
            )
            return {
                "reply": reply_text or default_reply,
                "pending_action": {
                    "type":        "compose_email",
                    "label":       f"Email to {to_name}",
                    "description": f"Draft an email to {to_name} for your review",
                    "params":      fc_args,
                },
            }

        # ── Plain text response ────────────────────────────────────────────────
        return {
            "reply":          reply_text or getattr(response, "text", ""),
            "pending_action": None,
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chat error: {str(e)}")


# ── Execute a confirmed action ─────────────────────────────────────────────────

@chat_router.post("/api/chat/execute")
async def chat_execute(body: ExecuteRequest, _user: dict = Depends(get_current_user)):
    """
    Called after the user taps Confirm on the ConfirmationPanel.
    For compose_email: the frontend opens the mailto: link directly —
    this endpoint just validates and acknowledges.
    """
    if body.action_type == "compose_email":
        return {
            "result":  "ok",
            "message": "Email opened in your mail app.",
        }

    raise HTTPException(status_code=400, detail=f"Unknown action type: {body.action_type!r}")
