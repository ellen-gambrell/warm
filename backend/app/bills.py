"""
Bills management routes.

GET    /api/bills              → list user's bill records
POST   /api/bills              → create a bill record
PATCH  /api/bills/{id}         → update a bill record
DELETE /api/bills/{id}         → delete a bill record
GET    /api/bills/check        → query Gmail for new bills per configured sender_email.
                                 Returns [] silently if Gmail is not connected.
                                 Updates last_bill_seen_at for each checked bill.
"""

import json
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from .auth import get_current_user
from .database import get_db

router = APIRouter(prefix="/api/bills")

VALID_CATEGORIES = {"electric", "gas", "water", "phone", "internet", "other"}

GMAIL_BASE = "https://gmail.googleapis.com/gmail/v1/users/me/"


# ── Helpers ────────────────────────────────────────────────────────────────────

def _get_gmail_token(user_id: str) -> Optional[str]:
    """Return a valid Gmail access token for the user, or None if not connected.
    Does NOT raise — callers silently skip Gmail features when None is returned.
    """
    import time as _time
    db = get_db()
    row = db.execute(
        "SELECT access_token, refresh_token, expires_at FROM connections "
        "WHERE user_id = ? AND provider = 'gmail'",
        (user_id,),
    ).fetchone()
    db.close()
    if not row:
        return None

    from .connections import _decrypt, _encrypt, _google_cfg
    access_token  = _decrypt(row["access_token"])
    refresh_token = _decrypt(row["refresh_token"])

    # Return existing token if still valid (60s buffer)
    if row["expires_at"] and int(_time.time()) < row["expires_at"] - 60:
        return access_token

    # Attempt refresh
    if not refresh_token:
        return None
    try:
        cfg = _google_cfg()
        payload = urllib.parse.urlencode({
            "client_id":     cfg["client_id"],
            "client_secret": cfg["client_secret"],
            "refresh_token": refresh_token,
            "grant_type":    "refresh_token",
        }).encode()
        req = urllib.request.Request(
            "https://oauth2.googleapis.com/token", data=payload, method="POST"
        )
        with urllib.request.urlopen(req) as resp:
            tokens = json.loads(resp.read())
        new_token   = tokens["access_token"]
        new_expires = int(_time.time()) + tokens.get("expires_in", 3600)
        db2 = get_db()
        db2.execute(
            "UPDATE connections SET access_token=?, expires_at=?, updated_at=datetime('now') "
            "WHERE user_id=? AND provider='gmail'",
            (_encrypt(new_token), new_expires, user_id),
        )
        db2.commit()
        db2.close()
        return new_token
    except Exception:
        return None


def _gmail_search(query: str, token: str, max_results: int = 10) -> list:
    """Search Gmail and return a list of message metadata dicts (id, subject, date, from).
    Returns [] on any error.
    """
    try:
        url = (
            GMAIL_BASE + "messages?"
            + urllib.parse.urlencode({"q": query, "maxResults": max_results})
        )
        req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read())
        messages = data.get("messages", [])
        if not messages:
            return []

        results = []
        for msg in messages:
            mid = msg["id"]
            fields = "id,threadId,payload(headers(name,value))"
            detail_url = (
                GMAIL_BASE + f"messages/{mid}?format=metadata"
                f"&fields={urllib.parse.quote(fields)}"
            )
            dreq = urllib.request.Request(
                detail_url, headers={"Authorization": f"Bearer {token}"}
            )
            try:
                with urllib.request.urlopen(dreq) as dresp:
                    detail = json.loads(dresp.read())
            except Exception:
                continue
            headers = detail.get("payload", {}).get("headers", [])
            def _h(name: str) -> str:
                for h in headers:
                    if h.get("name", "").lower() == name.lower():
                        return h.get("value", "")
                return ""
            results.append({
                "id":      mid,
                "threadId": detail.get("threadId", ""),
                "subject": _h("Subject"),
                "date":    _h("Date"),
                "from":    _h("From"),
            })
        return results
    except Exception:
        return []


# ── Pydantic models ────────────────────────────────────────────────────────────

class BillBody(BaseModel):
    category:        str = "other"
    company_name:    str
    phone_number:    Optional[str] = None
    customer_number: Optional[str] = None
    sender_email:    Optional[str] = None


class BillPatch(BaseModel):
    category:        Optional[str] = None
    company_name:    Optional[str] = None
    phone_number:    Optional[str] = None
    customer_number: Optional[str] = None
    sender_email:    Optional[str] = None


# ── Routes ─────────────────────────────────────────────────────────────────────

@router.get("")
def list_bills(user: dict = Depends(get_current_user)):
    db = get_db()
    rows = db.execute(
        "SELECT id, category, company_name, phone_number, customer_number, "
        "sender_email, last_bill_seen_at, created_at, updated_at "
        "FROM bills WHERE user_id = ? ORDER BY company_name COLLATE NOCASE",
        (user["sub"],),
    ).fetchall()
    db.close()
    return [
        {
            "id":                r["id"],
            "category":          r["category"],
            "company_name":      r["company_name"],
            "phone_number":      r["phone_number"],
            "customer_number":   r["customer_number"],
            "sender_email":      r["sender_email"],
            "last_bill_seen_at": r["last_bill_seen_at"],
            "created_at":        r["created_at"],
            "updated_at":        r["updated_at"],
        }
        for r in rows
    ]


@router.post("")
def create_bill(body: BillBody, user: dict = Depends(get_current_user)):
    company = body.company_name.strip()
    if not company:
        raise HTTPException(400, "Company name is required.")
    category = body.category.lower() if body.category else "other"
    if category not in VALID_CATEGORIES:
        raise HTTPException(400, f"Category must be one of: {', '.join(sorted(VALID_CATEGORIES))}.")

    bill_id = str(uuid.uuid4())
    now = _now_iso()
    db = get_db()
    db.execute(
        "INSERT INTO bills (id, user_id, category, company_name, phone_number, "
        "customer_number, sender_email, created_at, updated_at) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (
            bill_id, user["sub"], category, company,
            _opt(body.phone_number), _opt(body.customer_number),
            _opt(body.sender_email), now, now,
        ),
    )
    db.commit()
    row = db.execute("SELECT * FROM bills WHERE id = ?", (bill_id,)).fetchone()
    db.close()
    return _row_to_dict(row)


@router.patch("/{bill_id}")
def update_bill(bill_id: str, body: BillPatch, user: dict = Depends(get_current_user)):
    db = get_db()
    row = db.execute(
        "SELECT id FROM bills WHERE id = ? AND user_id = ?",
        (bill_id, user["sub"]),
    ).fetchone()
    if not row:
        db.close()
        raise HTTPException(404, "Bill not found.")

    updates, vals = [], []

    if body.category is not None:
        cat = body.category.lower()
        if cat not in VALID_CATEGORIES:
            db.close()
            raise HTTPException(400, f"Category must be one of: {', '.join(sorted(VALID_CATEGORIES))}.")
        updates.append("category = ?"); vals.append(cat)

    if body.company_name is not None:
        name = body.company_name.strip()
        if not name:
            db.close()
            raise HTTPException(400, "Company name cannot be empty.")
        updates.append("company_name = ?"); vals.append(name)

    # Optional nullable fields — explicit None in patch means "clear the field"
    # We use a sentinel: if the field is present in the JSON payload, update it.
    # Pydantic will pass None for missing optional fields, so we check via model_fields_set.
    for field, col in [
        ("phone_number",    "phone_number"),
        ("customer_number", "customer_number"),
        ("sender_email",    "sender_email"),
    ]:
        if field in body.model_fields_set:
            updates.append(f"{col} = ?")
            vals.append(getattr(body, field) or None)

    if updates:
        updates.append("updated_at = datetime('now')")
        vals.append(bill_id)
        db.execute(f"UPDATE bills SET {', '.join(updates)} WHERE id = ?", vals)
        db.commit()

    updated = db.execute("SELECT * FROM bills WHERE id = ?", (bill_id,)).fetchone()
    db.close()
    return _row_to_dict(updated)


@router.delete("/{bill_id}")
def delete_bill(bill_id: str, user: dict = Depends(get_current_user)):
    db = get_db()
    db.execute(
        "DELETE FROM bills WHERE id = ? AND user_id = ?",
        (bill_id, user["sub"]),
    )
    db.commit()
    db.close()
    return {"status": "ok"}


@router.get("/check")
def check_bills(user: dict = Depends(get_current_user)):
    """
    For each bill with a sender_email, query Gmail for emails from that sender
    since last_bill_seen_at.  Returns [{ bill_id, new_count, recent_messages }].
    Silently returns [] if Gmail is not connected.
    Updates last_bill_seen_at to now for each bill that was checked.
    """
    token = _get_gmail_token(user["sub"])
    if token is None:
        return []

    db = get_db()
    bills = db.execute(
        "SELECT id, company_name, sender_email, last_bill_seen_at "
        "FROM bills WHERE user_id = ? AND sender_email IS NOT NULL AND sender_email != ''",
        (user["sub"],),
    ).fetchall()
    db.close()

    if not bills:
        return []

    results = []
    now_iso = _now_iso()

    for bill in bills:
        bill_id      = bill["id"]
        sender       = bill["sender_email"]
        company_name = bill["company_name"]
        last_seen    = bill["last_bill_seen_at"]

        # Build Gmail query: from sender, optionally after last seen date
        query = f"from:{sender}"
        if last_seen:
            # Gmail 'after:' filter uses epoch seconds
            try:
                import datetime as dt
                ts = dt.datetime.fromisoformat(last_seen)
                epoch = int(ts.timestamp())
                query += f" after:{epoch}"
            except Exception:
                pass  # Malformed timestamp — ignore the date filter

        messages = _gmail_search(query, token, max_results=10)
        new_count = len(messages)

        # Update last_bill_seen_at regardless of whether new messages were found
        db2 = get_db()
        db2.execute(
            "UPDATE bills SET last_bill_seen_at = ?, updated_at = datetime('now') WHERE id = ?",
            (now_iso, bill_id),
        )
        db2.commit()
        db2.close()

        results.append({
            "bill_id":          bill_id,
            "company_name":     company_name,
            "new_count":        new_count,
            "recent_messages":  messages,
        })

    return results


# ── Utilities ──────────────────────────────────────────────────────────────────

def _now_iso() -> str:
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _opt(v: Optional[str]) -> Optional[str]:
    return v.strip() or None if v else None


def _row_to_dict(row) -> dict:
    return {
        "id":                row["id"],
        "category":          row["category"],
        "company_name":      row["company_name"],
        "phone_number":      row["phone_number"],
        "customer_number":   row["customer_number"],
        "sender_email":      row["sender_email"],
        "last_bill_seen_at": row["last_bill_seen_at"],
        "created_at":        row["created_at"],
        "updated_at":        row["updated_at"],
    }
