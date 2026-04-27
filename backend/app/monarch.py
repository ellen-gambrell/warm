"""
Monarch Money data access for warm.care.

Routes:
  GET /api/monarch/summary   — raw accounts + transactions (for future MonarchView)

Helper:
  get_monarch_summary_text(user_id)  — returns AI-readable summary string;
                                       used by chat.py to inject financial context.
"""

import asyncio

from fastapi import APIRouter, Depends, HTTPException

from .auth import get_current_user
from .connections import get_monarch_session

router = APIRouter()


# ── Internal helper used by chat ───────────────────────────────────────────────

async def get_monarch_summary_text(user_id: str) -> str:
    """
    Return a brief AI-readable summary of the user's Monarch Money data.
    Returns empty string if Monarch is not connected or if the fetch fails.
    Never raises — chat.py calls this fire-and-forget style.
    """
    # Check if connected (raises HTTPException if not — we catch it)
    try:
        token = get_monarch_session(user_id)
    except HTTPException:
        return ""

    try:
        from monarchmoney import MonarchMoney  # type: ignore
    except ImportError:
        return ""

    try:
        mm = MonarchMoney(token=token)

        accounts_result, txn_result = await asyncio.gather(
            mm.get_accounts(),
            mm.get_transactions(limit=50),
            return_exceptions=True,
        )

        lines = ["--- Monarch Money (financial context) ---"]

        # Accounts
        if not isinstance(accounts_result, Exception) and accounts_result:
            accounts = accounts_result.get("accounts", [])
            if accounts:
                lines.append("Accounts:")
                for acc in accounts:
                    name    = acc.get("displayName") or acc.get("name", "Account")
                    balance = acc.get("displayBalance", 0) or 0
                    kind    = (acc.get("type") or {}).get("name", "")
                    lines.append(f"  - {name} ({kind}): ${balance:,.2f}")

        # Recent transactions
        if not isinstance(txn_result, Exception) and txn_result:
            txns = (txn_result.get("allTransactions") or {}).get("results", [])
            if txns:
                lines.append("Recent transactions (last 50):")
                for txn in txns[:30]:
                    date     = (txn.get("date") or "")[:10]
                    merchant = (
                        (txn.get("merchant") or {}).get("name")
                        or txn.get("plaidName")
                        or "Unknown"
                    )
                    amount = abs(txn.get("amount", 0) or 0)
                    lines.append(f"  - {merchant}: ${amount:.2f} on {date}")

        lines.append("---")
        return "\n".join(lines)

    except Exception:
        return ""


# ── Route ──────────────────────────────────────────────────────────────────────

@router.get("/api/monarch/summary")
async def monarch_summary_route(user: dict = Depends(get_current_user)):
    """Return raw Monarch account + transaction data as JSON."""
    token = get_monarch_session(user["sub"])  # raises 403 if not connected

    try:
        from monarchmoney import MonarchMoney  # type: ignore
    except ImportError:
        raise HTTPException(status_code=500, detail="monarchmoney library is not installed on the server.")

    try:
        mm = MonarchMoney(token=token)
        accounts_result, txn_result = await asyncio.gather(
            mm.get_accounts(),
            mm.get_transactions(limit=50),
            return_exceptions=True,
        )
        return {
            "accounts":     None if isinstance(accounts_result, Exception) else accounts_result,
            "transactions": None if isinstance(txn_result,    Exception) else txn_result,
        }
    except Exception:
        raise HTTPException(status_code=502, detail="Could not fetch Monarch Money data.")
