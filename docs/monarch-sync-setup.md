# Monarch Money Sync — Setup Guide

Keeps Check Run current by pushing your Monarch Money transactions to warm.care.

---

## How it works

`backend/sync_monarch.py` runs locally (or on a server), fetches transactions from
Monarch Money, and POSTs them to `/api/checkrun/ingest`. The backend matches them
against your bill list and updates cleared status automatically.

---

## Step 1 — Get your Monarch Money session token (one-time)

1. Open [app.monarchmoney.com](https://app.monarchmoney.com) in Chrome
2. Open DevTools → **Network** tab
3. Reload the page, then click any request that goes to `api.monarchmoney.com`
4. In the request headers, find **Authorization** — it looks like:
   ```
   Authorization: Token abc123xyz...
   ```
5. Copy everything **after** `Token ` (the long alphanumeric string)

That's your `MONARCH_TOKEN`.

---

## Step 2 — Get your warm.care API token

Generate a long-lived JWT (valid 30 days) by logging in to warm.care and copying
the token from your browser's localStorage:

1. Open [warm.care](https://warm.care) and log in
2. Open DevTools → **Application** → **Local Storage** → `https://warm.care`
3. Find `warmcare_user` or `warmcare_user_persistent`
4. Copy the `token` value from the JSON object

---

## Step 3 — Set environment variables

Create or update `backend/.env.sync` (never commit this file):

```bash
# Monarch Money
MONARCH_TOKEN=abc123xyz...          # from Step 1
MONARCH_EMAIL=you@example.com       # your Monarch login email
MONARCH_PASSWORD=yourpassword       # your Monarch login password
MONARCH_TOTP_SECRET=                # leave blank if no 2FA; raw TOTP secret if 2FA enabled

# warm.care API
WARMCARE_API_URL=https://warm.care
WARMCARE_API_TOKEN=eyJ...           # from Step 2
```

---

## Step 4 — Run the sync

```bash
cd /path/to/MargaretAI

# Sync the current month
MONARCH_TOKEN=... WARMCARE_API_URL=https://warm.care WARMCARE_API_TOKEN=... \
  .venv/bin/python3 backend/sync_monarch.py

# Or load from .env file:
set -a && source backend/.env.sync && set +a
.venv/bin/python3 backend/sync_monarch.py

# Sync current + previous month:
.venv/bin/python3 backend/sync_monarch.py --months 2

# Explicit date range:
.venv/bin/python3 backend/sync_monarch.py --start 2026-04-01 --end 2026-04-30
```

---

## Token expiry & re-auth

`MONARCH_TOKEN` typically lasts weeks to months, but can expire.
When it does, the script automatically re-authenticates using
`MONARCH_EMAIL` + `MONARCH_PASSWORD` (+ `MONARCH_TOTP_SECRET` if 2FA is on)
and prints the new token:

```
✓ Re-authenticated via email+password.
  Update MONARCH_TOKEN to: newtoken123...
```

Copy the new token back into your env.

---

## Automating with cron (Mac)

Run the sync daily at 6 AM:

```bash
# Edit your crontab:
crontab -e

# Add this line (adjust paths to match your setup):
0 6 * * * cd /Users/you/projects/MargaretAI && \
  source backend/.env.sync && \
  .venv/bin/python3 backend/sync_monarch.py --months 2 \
  >> /tmp/monarch-sync.log 2>&1
```

> **Note:** GreenGeeks shared hosting can technically run cPanel cron jobs, but
> async Python processes are unreliable on shared hosts. A lightweight VPS
> (Railway, Fly.io, $5 DigitalOcean droplet) is significantly more reliable.
> Flag this to the infra agent before setting up server-side cron.

---

## Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| `HTTP 429 Too Many Requests` | Monarch rate-limited after repeated logins | Wait 10 min and retry |
| `HTTP 401` from warm.care | JWT expired | Re-generate token from Step 2 |
| `No session token returned` | Monarch auth succeeded but token missing | File a bug; check monarchmoney library version |
| `RequireMFAException` | 2FA on but no TOTP secret set | Set `MONARCH_TOTP_SECRET` in env |
| `monarchmoney library not installed` | Missing dependency | `pip install monarchmoney` |
