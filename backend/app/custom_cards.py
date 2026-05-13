"""
Custom AI Cards — user-defined recurring AI content tiles.

Routes
------
GET    /api/cards                  → list user's cards
POST   /api/cards                  → create a card (max 3 per user)
PATCH  /api/cards/{card_id}        → update prompt / schedule / visibility
DELETE /api/cards/{card_id}        → delete a card
POST   /api/cards/{card_id}/refresh → trigger an immediate refresh (once/day cap)

Runner
------
run_due_cards()  — called by cron_cards.py; processes all cards where next_run_at <= now
"""

import datetime
import os
import time
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from .auth import get_current_user
from .database import get_db

router = APIRouter(prefix="/api/cards")

MAX_CARDS = 3

SCHEDULE_SECONDS = {
    "daily":    86400,
    "weekly":   604800,
    "monthly":  2592000,  # 30d
    "annually": 31536000,
}


# ── Subscription gate ─────────────────────────────────────────────────────────

def require_paid(current: dict = Depends(get_current_user)) -> dict:
    """All Custom Card routes require an active subscription."""
    db = get_db()
    try:
        row = db.execute(
            "SELECT status FROM subscriptions WHERE user_id = ?", (current["sub"],)
        ).fetchone()
    finally:
        db.close()
    if not row or row["status"] not in ("active", "trial"):
        raise HTTPException(402, "Custom Cards require an active subscription.")
    return current


# ── Gemini helpers ────────────────────────────────────────────────────────────

def _derive_tile_name(prompt: str, api_key: str) -> str:
    """Ask Gemini to produce a short tile name (≤5 words) from the user's prompt."""
    try:
        from google import genai
        client = genai.Client(api_key=api_key)
        resp = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=(
                f"Give a short tile name (3-5 words, title-case, no punctuation) for this recurring "
                f"AI task: {prompt}"
            ),
        )
        name = (resp.text or "").strip().rstrip('.').strip()
        # Hard cap at 40 chars
        return name[:40] if name else prompt[:40]
    except Exception:
        # Fallback: truncate the prompt
        return prompt[:40]


def _run_card(card_id: str, prompt: str, api_key: str) -> str:
    """Execute the card's prompt via Gemini with Google Search grounding."""
    try:
        from google import genai
        from google.genai import types
        client = genai.Client(api_key=api_key)
        resp = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                tools=[types.Tool(google_search=types.GoogleSearch())],
                system_instruction=(
                    "You are a helpful assistant. Answer the user's request with current, "
                    "accurate information. Be concise — 2-4 paragraphs maximum."
                ),
            ),
        )
        return (resp.text or "").strip()
    except Exception as e:
        return f"[Error: {e}]"


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("")
def list_cards(current: dict = Depends(require_paid)):
    db = get_db()
    try:
        rows = db.execute(
            "SELECT id, prompt, tile_name, schedule, visibility, last_result, last_run_at, next_run_at, created_at "
            "FROM custom_cards WHERE user_id = ? ORDER BY created_at ASC",
            (current["sub"],),
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        db.close()


class CreateCardBody(BaseModel):
    prompt: str
    schedule: str
    visibility: str = "private"


@router.post("")
def create_card(body: CreateCardBody, current: dict = Depends(require_paid)):
    if body.schedule not in SCHEDULE_SECONDS:
        raise HTTPException(400, f"schedule must be one of: {', '.join(SCHEDULE_SECONDS)}")
    if body.visibility not in ("private", "supporter_view"):
        raise HTTPException(400, "visibility must be 'private' or 'supporter_view'")

    db = get_db()
    try:
        count = db.execute(
            "SELECT COUNT(*) FROM custom_cards WHERE user_id = ?", (current["sub"],)
        ).fetchone()[0]
        if count >= MAX_CARDS:
            raise HTTPException(409, f"You've reached the {MAX_CARDS}-card limit.")

        api_key = os.getenv("GEMINI_API_KEY", "")
        tile_name = _derive_tile_name(body.prompt, api_key) if api_key else body.prompt[:40]

        now = int(time.time())
        card_id = str(uuid.uuid4())
        db.execute(
            "INSERT INTO custom_cards (id, user_id, prompt, tile_name, schedule, visibility, next_run_at, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (card_id, current["sub"], body.prompt, tile_name, body.schedule, body.visibility, now, now),
        )
        db.commit()
        row = db.execute("SELECT * FROM custom_cards WHERE id = ?", (card_id,)).fetchone()
        return dict(row)
    finally:
        db.close()


class UpdateCardBody(BaseModel):
    prompt: Optional[str] = None
    schedule: Optional[str] = None
    visibility: Optional[str] = None


@router.patch("/{card_id}")
def update_card(card_id: str, body: UpdateCardBody, current: dict = Depends(require_paid)):
    db = get_db()
    try:
        card = db.execute(
            "SELECT * FROM custom_cards WHERE id = ? AND user_id = ?",
            (card_id, current["sub"]),
        ).fetchone()
        if not card:
            raise HTTPException(404, "Card not found.")

        if body.schedule is not None and body.schedule not in SCHEDULE_SECONDS:
            raise HTTPException(400, f"schedule must be one of: {', '.join(SCHEDULE_SECONDS)}")
        if body.visibility is not None and body.visibility not in ("private", "supporter_view"):
            raise HTTPException(400, "visibility must be 'private' or 'supporter_view'")

        api_key = os.getenv("GEMINI_API_KEY", "")
        new_prompt = body.prompt if body.prompt is not None else card["prompt"]
        new_tile_name = card["tile_name"]
        if body.prompt is not None and body.prompt != card["prompt"]:
            new_tile_name = _derive_tile_name(new_prompt, api_key) if api_key else new_prompt[:40]

        db.execute(
            "UPDATE custom_cards SET prompt = ?, tile_name = ?, schedule = ?, visibility = ? WHERE id = ?",
            (
                new_prompt,
                new_tile_name,
                body.schedule if body.schedule is not None else card["schedule"],
                body.visibility if body.visibility is not None else card["visibility"],
                card_id,
            ),
        )
        db.commit()
        return dict(db.execute("SELECT * FROM custom_cards WHERE id = ?", (card_id,)).fetchone())
    finally:
        db.close()


@router.delete("/{card_id}")
def delete_card(card_id: str, current: dict = Depends(require_paid)):
    db = get_db()
    try:
        card = db.execute(
            "SELECT id FROM custom_cards WHERE id = ? AND user_id = ?",
            (card_id, current["sub"]),
        ).fetchone()
        if not card:
            raise HTTPException(404, "Card not found.")
        db.execute("DELETE FROM custom_cards WHERE id = ?", (card_id,))
        db.commit()
        return {"status": "deleted"}
    finally:
        db.close()


@router.post("/{card_id}/refresh")
def refresh_card(card_id: str, current: dict = Depends(require_paid)):
    """Trigger an immediate refresh. Blocked if already run today."""
    db = get_db()
    try:
        card = db.execute(
            "SELECT * FROM custom_cards WHERE id = ? AND user_id = ?",
            (card_id, current["sub"]),
        ).fetchone()
        if not card:
            raise HTTPException(404, "Card not found.")

        today_start = int(datetime.datetime.combine(
            datetime.date.today(), datetime.time.min
        ).timestamp())
        if card["last_run_at"] and card["last_run_at"] >= today_start:
            raise HTTPException(429, "Already updated today. Try again tomorrow.")

        api_key = os.getenv("GEMINI_API_KEY", "")
        if not api_key:
            raise HTTPException(500, "GEMINI_API_KEY is not configured.")

        result = _run_card(card_id, card["prompt"], api_key)
        now = int(time.time())
        interval = SCHEDULE_SECONDS.get(card["schedule"], 86400)
        db.execute(
            "UPDATE custom_cards SET last_result = ?, last_run_at = ?, next_run_at = ? WHERE id = ?",
            (result, now, now + interval, card_id),
        )
        db.commit()
        return dict(db.execute("SELECT * FROM custom_cards WHERE id = ?", (card_id,)).fetchone())
    finally:
        db.close()


# ── Cron runner (called by cron_cards.py) ─────────────────────────────────────

def run_due_cards() -> int:
    """
    Process all cards where next_run_at <= now.
    Returns the number of cards processed.
    Called by cron_cards.py (systemd timer or crontab on Hetzner).
    """
    api_key = os.getenv("GEMINI_API_KEY", "")
    if not api_key:
        print("[custom_cards] GEMINI_API_KEY not set — skipping run", flush=True)
        return 0

    db = get_db()
    now = int(time.time())
    try:
        due = db.execute(
            "SELECT cc.* FROM custom_cards cc "
            "JOIN subscriptions s ON s.user_id = cc.user_id "
            "WHERE cc.next_run_at <= ? AND s.status IN ('active','trial')",
            (now,),
        ).fetchall()
    finally:
        db.close()

    processed = 0
    for card in due:
        try:
            result = _run_card(card["id"], card["prompt"], api_key)
            interval = SCHEDULE_SECONDS.get(card["schedule"], 86400)
            db2 = get_db()
            db2.execute(
                "UPDATE custom_cards SET last_result = ?, last_run_at = ?, next_run_at = ? WHERE id = ?",
                (result, now, now + interval, card["id"]),
            )
            db2.commit()
            db2.close()
            processed += 1
            print(f"[custom_cards] ran card {card['id']} ({card['tile_name']})", flush=True)
        except Exception as e:
            print(f"[custom_cards] ERROR card {card['id']}: {e}", flush=True)

    return processed
