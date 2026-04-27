"""
Check Run — monthly financial snapshot backed by Monarch Money transaction data.

Routes
──────
GET  /api/checkrun/data?year=&month=   bill list with computed cleared status
POST /api/checkrun/ingest              accept MM transaction/bill data from local sync
POST /api/checkrun/toggle              manual cleared override
GET  /api/checkrun/last-sync           timestamp of most recent ingest
"""

import re
import time
from datetime import datetime, date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from .auth import get_current_user
from .database import get_db

router = APIRouter()


# ── Helpers ─────────────────────────────────────────────────────────────────────

def _match(pattern: Optional[str], merchant: Optional[str]) -> bool:
    """Case-insensitive substring/regex match of pattern against merchant name."""
    if not pattern or not merchant:
        return False
    try:
        return bool(re.search(pattern, merchant, re.IGNORECASE))
    except re.error:
        return pattern.lower() in merchant.lower()


def _auto_cleared_by_date(due_day: Optional[int], year: int, month: int) -> bool:
    """True if the bill's due date has passed for the given month."""
    if due_day is None:
        return False
    today = date.today()
    if today.year == year and today.month == month:
        return due_day <= today.day
    # Past month → all cleared; future month → none
    bill_month = date(year, month, 1)
    return bill_month < date(today.year, today.month, 1)


def _third_wednesday(year: int, month: int) -> int:
    """Return the day-of-month of the 3rd Wednesday."""
    count = 0
    for d in range(1, 32):
        try:
            day = date(year, month, d)
        except ValueError:
            break
        if day.weekday() == 2:  # Wednesday
            count += 1
            if count == 3:
                return d
    return 0


# ── Data route ───────────────────────────────────────────────────────────────────

@router.get("/api/checkrun/data")
def get_checkrun_data(year: int, month: int, user: dict = Depends(get_current_user)):
    db = get_db()

    bills = db.execute(
        "SELECT * FROM checkrun_bills WHERE active = 1 ORDER BY sort_order, rowid"
    ).fetchall()

    # All transactions for this month from the cache
    month_str = f"{year}-{str(month).padStart(2,'0')}" if False else f"{year}-{month:02d}"
    txns = db.execute(
        "SELECT * FROM checkrun_transactions WHERE date LIKE ? AND is_pending = 0",
        (f"{month_str}-%",),
    ).fetchall()

    # Manual overrides
    overrides_rows = db.execute(
        "SELECT bill_id, cleared FROM checkrun_overrides WHERE year = ? AND month = ?",
        (year, month),
    ).fetchall()
    overrides = {r["bill_id"]: bool(r["cleared"]) for r in overrides_rows}

    # Last sync time
    last_sync_row = db.execute(
        "SELECT MAX(synced_at) AS ts FROM checkrun_transactions"
    ).fetchone()
    last_sync = last_sync_row["ts"] if last_sync_row else None

    db.close()

    result = []
    for b in bills:
        bill_id = b["id"]
        pattern = b["merchant_pattern"]

        # Matched transactions
        matched = [t for t in txns if _match(pattern, t["merchant"])]

        # Cleared status: override > transaction match > date-based auto
        if bill_id in overrides:
            cleared = overrides[bill_id]
            source = "manual"
        elif matched:
            cleared = True
            source = "transaction"
        else:
            # Special SSA rule: 3rd Wednesday
            if bill_id == "ssa":
                wed = _third_wednesday(year, month)
                today = date.today()
                cleared = (wed > 0 and today.year == year and
                           today.month == month and today.day >= wed)
            else:
                cleared = _auto_cleared_by_date(b["due_day"], year, month)
            source = "date" if cleared else "pending"

        result.append({
            "id":             bill_id,
            "section":        b["section"],
            "sort_order":     b["sort_order"],
            "name":           b["name"],
            "description":    b["description"],
            "payment_method": b["payment_method"],
            "expected_amount": b["expected_amount"],
            "due_day":        b["due_day"],
            "comment":        b["comment"],
            "cleared":        cleared,
            "cleared_source": source,   # 'manual' | 'transaction' | 'date' | 'pending'
            "matched_amount": matched[0]["amount"] if matched else None,
            "matched_merchant": matched[0]["merchant"] if matched else None,
            "matched_date":   matched[0]["date"] if matched else None,
        })

    return {
        "year": year,
        "month": month,
        "last_sync": last_sync,
        "items": result,
    }


# ── Ingest route (called by local MM sync) ────────────────────────────────────────

class Transaction(BaseModel):
    id: str
    date: str
    amount: float
    merchant: Optional[str] = None
    account: Optional[str] = None
    category: Optional[str] = None
    is_pending: bool = False


class BillUpsert(BaseModel):
    id: str
    sort_order: int = 0
    section: str = "bills"
    name: str
    description: Optional[str] = None
    payment_method: Optional[str] = None
    expected_amount: Optional[float] = None
    due_day: Optional[int] = None
    comment: Optional[str] = None
    merchant_pattern: Optional[str] = None


class IngestPayload(BaseModel):
    transactions: list[Transaction] = []
    bills: list[BillUpsert] = []


@router.post("/api/checkrun/ingest")
def ingest(payload: IngestPayload, user: dict = Depends(get_current_user)):
    db = get_db()

    if payload.transactions:
        db.executemany(
            """
            INSERT INTO checkrun_transactions
                (id, date, amount, merchant, account, category, is_pending, synced_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
            ON CONFLICT(id) DO UPDATE SET
                date       = excluded.date,
                amount     = excluded.amount,
                merchant   = excluded.merchant,
                account    = excluded.account,
                category   = excluded.category,
                is_pending = excluded.is_pending,
                synced_at  = datetime('now')
            """,
            [
                (t.id, t.date, t.amount, t.merchant, t.account, t.category, int(t.is_pending))
                for t in payload.transactions
            ],
        )

    if payload.bills:
        db.executemany(
            """
            INSERT INTO checkrun_bills
                (id, sort_order, section, name, description, payment_method,
                 expected_amount, due_day, comment, merchant_pattern)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                sort_order      = excluded.sort_order,
                section         = excluded.section,
                name            = excluded.name,
                description     = excluded.description,
                payment_method  = excluded.payment_method,
                expected_amount = excluded.expected_amount,
                due_day         = excluded.due_day,
                comment         = excluded.comment,
                merchant_pattern = excluded.merchant_pattern
            """,
            [
                (b.id, b.sort_order, b.section, b.name, b.description,
                 b.payment_method, b.expected_amount, b.due_day,
                 b.comment, b.merchant_pattern)
                for b in payload.bills
            ],
        )

    db.commit()
    db.close()
    return {
        "status": "ok",
        "transactions_ingested": len(payload.transactions),
        "bills_upserted": len(payload.bills),
        "synced_at": datetime.utcnow().isoformat(),
    }


# ── Toggle override ────────────────────────────────────────────────────────────────

class ToggleBody(BaseModel):
    bill_id: str
    year: int
    month: int
    cleared: bool


@router.post("/api/checkrun/toggle")
def toggle_override(body: ToggleBody, user: dict = Depends(get_current_user)):
    db = get_db()
    db.execute(
        """
        INSERT INTO checkrun_overrides (bill_id, year, month, cleared)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(bill_id, year, month) DO UPDATE SET cleared = excluded.cleared
        """,
        (body.bill_id, body.year, body.month, int(body.cleared)),
    )
    db.commit()
    db.close()
    return {"status": "ok"}


# ── Last sync time ─────────────────────────────────────────────────────────────────

@router.get("/api/checkrun/last-sync")
def last_sync(user: dict = Depends(get_current_user)):
    db = get_db()
    row = db.execute("SELECT MAX(synced_at) AS ts FROM checkrun_transactions").fetchone()
    db.close()
    return {"last_sync": row["ts"] if row else None}
