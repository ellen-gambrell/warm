"""
sync_monarch.py — server-side Monarch Money transaction sync.

Pulls the current month's (and optionally the previous month's) transactions
from Monarch Money and POSTs them to the warm.care /api/checkrun/ingest endpoint.

Usage
─────
  python3 sync_monarch.py                   # current month
  python3 sync_monarch.py --months 2        # current + previous month
  python3 sync_monarch.py --start 2026-03-01 --end 2026-04-30  # explicit range

Required env vars
─────────────────
  MONARCH_TOKEN        Bearer token from Monarch (extract once from browser DevTools:
                       app.monarchmoney.com → DevTools → Network → any GraphQL
                       request → Authorization header value after "Token ")
  WARMCARE_API_URL     Base URL of the warm.care API (e.g. https://warm.care)
  WARMCARE_API_TOKEN   JWT token for a valid warm.care user (generate via password
                       login or keep a long-lived token in env)

Re-auth fallback env vars (used when MONARCH_TOKEN expires)
─────────────────────────────────────────────────────────────
  MONARCH_EMAIL          Monarch Money account email
  MONARCH_PASSWORD       Monarch Money account password
  MONARCH_TOTP_SECRET    Raw TOTP secret (NOT the 6-digit code) — only if 2FA enabled.
                         Found in Monarch Settings → Security → MFA setup.
                         Leave unset if no 2FA.

Hosting note
────────────
GreenGeeks shared hosting can run this via cPanel cron, but async Python processes
are unreliable on shared hosts. A lightweight VPS (Railway, Fly.io, DigitalOcean $5)
is significantly more reliable for scheduled sync jobs. Flag this to the infra agent
before productionizing.
"""

import argparse
import asyncio
import json
import os
import pathlib
import stat
import sys
import urllib.request
import urllib.error
from datetime import date, timedelta

# ── Monarch Money library ────────────────────────────────────────────────────────

try:
    from monarchmoney import MonarchMoney, RequireMFAException
except ImportError:
    print("ERROR: monarchmoney library not installed. Run: pip install monarchmoney", file=sys.stderr)
    sys.exit(1)


# ── Helpers ──────────────────────────────────────────────────────────────────────

def _require_env(name: str) -> str:
    val = os.environ.get(name, "").strip()
    if not val:
        print(f"ERROR: Required env var {name} is not set.", file=sys.stderr)
        sys.exit(1)
    return val


def _month_range(months_back: int = 0) -> tuple[str, str]:
    """Return (start, end) date strings for the month `months_back` months ago."""
    today = date.today()
    # Go back N months
    m = today.month - months_back
    y = today.year
    while m <= 0:
        m += 12
        y -= 1
    start = date(y, m, 1)
    # Last day of the month
    if m == 12:
        end = date(y + 1, 1, 1) - timedelta(days=1)
    else:
        end = date(y, m + 1, 1) - timedelta(days=1)
    return start.isoformat(), end.isoformat()


# ── Monarch auth ──────────────────────────────────────────────────────────────────

async def get_monarch_client() -> MonarchMoney:
    """
    Return an authenticated MonarchMoney client.

    Strategy:
    1. Try MONARCH_TOKEN from env (fastest, no network round-trip)
    2. On any exception (expired / invalid), fall back to email + password re-auth
    3. If re-auth raises RequireMFAException: print clear instructions and exit
    """
    token = os.environ.get("MONARCH_TOKEN", "").strip()

    mm = MonarchMoney()

    if token:
        mm.set_token(token)
        # Quick validation: try to fetch accounts — if this fails the token is dead
        try:
            await mm.get_accounts()
            print("✓ Authenticated with MONARCH_TOKEN")
            return mm
        except Exception as e:
            print(f"⚠ MONARCH_TOKEN appears invalid or expired ({e}). Attempting re-auth…")

    # Re-auth fallback
    email    = _require_env("MONARCH_EMAIL")
    password = _require_env("MONARCH_PASSWORD")
    totp_key = os.environ.get("MONARCH_TOTP_SECRET", "").strip() or None

    try:
        await mm.login(
            email=email,
            password=password,
            use_saved_session=False,
            save_session=False,
            mfa_secret_key=totp_key,
        )
        new_token = mm.token
        print("✓ Re-authenticated via email+password.")
        # Write new token to a chmod-600 file — never to stdout (cron logs are not private)
        token_file = pathlib.Path.home() / ".monarch_token_refresh"
        token_file.write_text(new_token + "\n")
        token_file.chmod(stat.S_IRUSR | stat.S_IWUSR)   # 0o600
        print(f"  New token written to {token_file} (chmod 600) — update MONARCH_TOKEN to match.")
        return mm

    except RequireMFAException:
        print(
            "ERROR: Your Monarch Money account has two-factor authentication enabled.\n"
            "  Option A: Disable 2FA temporarily, run this script, then re-enable it.\n"
            "  Option B: Set MONARCH_TOTP_SECRET to your raw TOTP secret (the long string\n"
            "            from Monarch Settings → Security → MFA setup, NOT the 6-digit code).",
            file=sys.stderr,
        )
        sys.exit(1)

    except Exception as e:
        print(f"ERROR: Monarch Money login failed: {e}", file=sys.stderr)
        sys.exit(1)


# ── Fetch transactions ────────────────────────────────────────────────────────────

async def fetch_transactions(mm: MonarchMoney, start: str, end: str) -> list[dict]:
    """Return transactions for the given date range as plain dicts."""
    print(f"  Fetching transactions {start} → {end}…")
    try:
        result = await mm.get_transactions(
            start_date=start,
            end_date=end,
            limit=500,
        )
        # monarchmoney returns a dict with nested structure; extract the list
        txns_raw = result.get("allTransactions", {}).get("results", [])
    except Exception as e:
        print(f"ERROR: Could not fetch transactions: {e}", file=sys.stderr)
        sys.exit(1)

    txns = []
    for t in txns_raw:
        # Normalize to the shape the ingest endpoint expects
        merchant = (
            t.get("merchant", {}).get("name")
            if isinstance(t.get("merchant"), dict)
            else t.get("merchant")
        )
        txns.append({
            "id":         t["id"],
            "date":       t["date"],
            "amount":     float(t.get("amount", 0)),
            "merchant":   merchant,
            "account":    t.get("account", {}).get("displayName") if isinstance(t.get("account"), dict) else t.get("account"),
            "category":   t.get("category", {}).get("name") if isinstance(t.get("category"), dict) else t.get("category"),
            "is_pending": bool(t.get("isPending", False)),
        })

    print(f"  → {len(txns)} transactions fetched")
    return txns


# ── POST to warm.care API ─────────────────────────────────────────────────────────

def post_to_api(transactions: list[dict], api_url: str, api_token: str) -> None:
    """POST transaction batch to /api/checkrun/ingest."""
    payload = json.dumps({"transactions": transactions, "bills": []}).encode()
    url = api_url.rstrip("/") + "/api/checkrun/ingest"
    req = urllib.request.Request(
        url,
        data=payload,
        headers={
            "Authorization": f"Bearer {api_token}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            body = json.loads(resp.read())
            print(f"  → Ingested {body['transactions_ingested']} transactions (synced_at {body['synced_at']})")
    except urllib.error.HTTPError as e:
        print(f"ERROR: API returned {e.code}: {e.read().decode()}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"ERROR: Could not reach warm.care API: {e}", file=sys.stderr)
        sys.exit(1)


# ── Main ──────────────────────────────────────────────────────────────────────────

async def main() -> None:
    parser = argparse.ArgumentParser(description="Sync Monarch Money → warm.care Check Run")
    parser.add_argument("--months",  type=int, default=1,    help="Number of recent months to sync (default: 1)")
    parser.add_argument("--start",   type=str, default=None, help="Explicit start date YYYY-MM-DD")
    parser.add_argument("--end",     type=str, default=None, help="Explicit end date YYYY-MM-DD")
    args = parser.parse_args()

    api_url   = _require_env("WARMCARE_API_URL")
    api_token = _require_env("WARMCARE_API_TOKEN")

    # Determine date ranges to sync
    if args.start and args.end:
        date_ranges = [(args.start, args.end)]
    else:
        date_ranges = [_month_range(i) for i in range(args.months)]

    print("Monarch Money → warm.care sync")
    print(f"  API: {api_url}")
    print(f"  Ranges: {date_ranges}")

    mm = await get_monarch_client()

    all_txns: list[dict] = []
    seen_ids: set[str] = set()
    for start, end in date_ranges:
        batch = await fetch_transactions(mm, start, end)
        for t in batch:
            if t["id"] not in seen_ids:
                seen_ids.add(t["id"])
                all_txns.append(t)

    if not all_txns:
        print("No transactions found — nothing to ingest.")
        return

    print(f"Posting {len(all_txns)} unique transactions to warm.care…")
    post_to_api(all_txns, api_url, api_token)
    print("✓ Sync complete.")


if __name__ == "__main__":
    asyncio.run(main())
