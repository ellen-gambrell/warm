"""
Reminder routes — persistent recurring reminders with TTS notification.

Routes
------
GET    /api/reminders           → list user's reminders
POST   /api/reminders           → create reminder
PATCH  /api/reminders/{id}      → update (label, interval_minutes, enabled)
DELETE /api/reminders/{id}      → delete
"""

import time
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from .auth import get_current_user
from .database import get_db

router = APIRouter(prefix="/api/reminders")

MIN_INTERVAL =    5   # minutes
MAX_INTERVAL = 1440   # 24 hours


class ReminderBody(BaseModel):
    label: str
    interval_minutes: int = 120
    enabled: bool = True


class ReminderPatch(BaseModel):
    label: Optional[str] = None
    interval_minutes: Optional[int] = None
    enabled: Optional[bool] = None


@router.get("")
def list_reminders(user: dict = Depends(get_current_user)):
    db = get_db()
    rows = db.execute(
        "SELECT id, label, interval_minutes, enabled, created_at "
        "FROM reminders WHERE user_id = ? ORDER BY created_at",
        (user["sub"],),
    ).fetchall()
    db.close()
    return {
        "reminders": [
            {
                "id": r["id"],
                "label": r["label"],
                "interval_minutes": r["interval_minutes"],
                "enabled": bool(r["enabled"]),
                "created_at": r["created_at"],
            }
            for r in rows
        ]
    }


@router.post("")
def create_reminder(body: ReminderBody, user: dict = Depends(get_current_user)):
    label = body.label.strip()
    if not label:
        raise HTTPException(400, "Label is required.")
    if not (MIN_INTERVAL <= body.interval_minutes <= MAX_INTERVAL):
        raise HTTPException(400, f"Interval must be between {MIN_INTERVAL} and {MAX_INTERVAL} minutes.")

    db = get_db()
    rid = str(uuid.uuid4())
    now = int(time.time())
    db.execute(
        "INSERT INTO reminders (id, user_id, label, interval_minutes, enabled, created_at) "
        "VALUES (?, ?, ?, ?, ?, ?)",
        (rid, user["sub"], label, body.interval_minutes, 1 if body.enabled else 0, now),
    )
    db.commit()
    db.close()
    return {
        "id": rid,
        "label": label,
        "interval_minutes": body.interval_minutes,
        "enabled": body.enabled,
        "created_at": now,
    }


@router.patch("/{reminder_id}")
def update_reminder(reminder_id: str, body: ReminderPatch, user: dict = Depends(get_current_user)):
    db = get_db()
    row = db.execute(
        "SELECT id FROM reminders WHERE id = ? AND user_id = ?",
        (reminder_id, user["sub"]),
    ).fetchone()
    if not row:
        db.close()
        raise HTTPException(404, "Reminder not found.")

    updates, vals = [], []
    if body.label is not None:
        label = body.label.strip()
        if not label:
            db.close()
            raise HTTPException(400, "Label cannot be empty.")
        updates.append("label = ?")
        vals.append(label)
    if body.interval_minutes is not None:
        if not (MIN_INTERVAL <= body.interval_minutes <= MAX_INTERVAL):
            db.close()
            raise HTTPException(400, f"Interval must be between {MIN_INTERVAL} and {MAX_INTERVAL} minutes.")
        updates.append("interval_minutes = ?")
        vals.append(body.interval_minutes)
    if body.enabled is not None:
        updates.append("enabled = ?")
        vals.append(1 if body.enabled else 0)

    if updates:
        vals.append(reminder_id)
        db.execute(f"UPDATE reminders SET {', '.join(updates)} WHERE id = ?", vals)
        db.commit()
    db.close()
    return {"status": "ok"}


@router.delete("/{reminder_id}")
def delete_reminder(reminder_id: str, user: dict = Depends(get_current_user)):
    db = get_db()
    db.execute(
        "DELETE FROM reminders WHERE id = ? AND user_id = ?",
        (reminder_id, user["sub"]),
    )
    db.commit()
    db.close()
    return {"status": "ok"}
