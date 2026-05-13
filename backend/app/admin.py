"""
Admin API routes.

All routes require an authenticated session where users.role = 'admin'.
The role is verified against the database on every request — not trusted
from the JWT claim alone.

Routes
------
GET  /api/admin/requests              → list all user_requests, newest first
GET  /api/admin/pending-count         → { count: N } pending requests (for UI badge)
POST /api/admin/requests/{id}/approve → approve request, create user, send welcome email
POST /api/admin/requests/{id}/deny    → deny request, send denial email
"""

import json
import uuid
import time

from fastapi import APIRouter, Depends, HTTPException

from .auth import get_current_user
from .database import get_db
from .email_service import send_denial_email, send_welcome_email

router = APIRouter(prefix="/api/admin")


# ── Auth dependency ───────────────────────────────────────────────────────────

def require_admin(current: dict = Depends(get_current_user)) -> dict:
    """Verify the caller is an admin by querying the DB — never trusts JWT alone."""
    db = get_db()
    try:
        row = db.execute(
            "SELECT role FROM users WHERE id = ?", (current["sub"],)
        ).fetchone()
    finally:
        db.close()
    if not row or row["role"] != "admin":
        raise HTTPException(403, "Admin access required.")
    return current


def _log_event(db, admin_id: str, event: str, meta: dict) -> None:
    db.execute(
        "INSERT INTO user_events (id, user_id, actor_type, event, meta, ts) "
        "VALUES (?, ?, 'admin', ?, ?, ?)",
        (str(uuid.uuid4()), admin_id, event, json.dumps(meta), int(time.time())),
    )


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/requests")
def list_requests(admin: dict = Depends(require_admin)):
    db = get_db()
    try:
        rows = db.execute(
            "SELECT id, name, email, requested_at, status, reviewed_at, reviewed_by "
            "FROM user_requests ORDER BY requested_at DESC"
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        db.close()


@router.get("/pending-count")
def pending_count(admin: dict = Depends(require_admin)):
    db = get_db()
    try:
        n = db.execute(
            "SELECT COUNT(*) FROM user_requests WHERE status = 'pending'"
        ).fetchone()[0]
        return {"count": n}
    finally:
        db.close()


@router.post("/requests/{req_id}/approve")
def approve_request(req_id: str, admin: dict = Depends(require_admin)):
    db = get_db()
    now = int(time.time())
    try:
        req = db.execute(
            "SELECT id, name, email, status FROM user_requests WHERE id = ?", (req_id,)
        ).fetchone()
        if not req:
            raise HTTPException(404, "Request not found.")
        if req["status"] != "pending":
            raise HTTPException(409, "Request already actioned.")

        new_user_id = str(uuid.uuid4())
        try:
            db.execute(
                "INSERT INTO users (id, name, email, role) VALUES (?, ?, ?, 'user')",
                (new_user_id, req["name"], req["email"]),
            )
        except Exception:
            # UNIQUE constraint — user already exists (double-submit). Still mark approved.
            pass

        db.execute(
            "UPDATE user_requests SET status = 'approved', reviewed_at = ?, reviewed_by = ? "
            "WHERE id = ?",
            (now, admin["sub"], req_id),
        )
        _log_event(db, admin["sub"], "admin:approve_request", {
            "request_id": req_id,
            "email": req["email"],
        })
        db.commit()
    finally:
        db.close()

    send_welcome_email(to=req["email"], name=req["name"])
    return {"status": "approved"}


@router.post("/requests/{req_id}/deny")
def deny_request(req_id: str, admin: dict = Depends(require_admin)):
    db = get_db()
    now = int(time.time())
    try:
        req = db.execute(
            "SELECT id, name, email, status FROM user_requests WHERE id = ?", (req_id,)
        ).fetchone()
        if not req:
            raise HTTPException(404, "Request not found.")
        if req["status"] != "pending":
            raise HTTPException(409, "Request already actioned.")

        db.execute(
            "UPDATE user_requests SET status = 'denied', reviewed_at = ?, reviewed_by = ? "
            "WHERE id = ?",
            (now, admin["sub"], req_id),
        )
        _log_event(db, admin["sub"], "admin:deny_request", {
            "request_id": req_id,
            "email": req["email"],
        })
        db.commit()
    finally:
        db.close()

    send_denial_email(to=req["email"], name=req["name"])
    return {"status": "denied"}
