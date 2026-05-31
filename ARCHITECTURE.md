# warm.care — Architecture

> Last updated: 2026-05-12

---

## System Boundaries

```
Browser (Margaret's iPhone / iPad / desktop)
    │
    │  HTTPS (Hetzner 5.78.110.203)
    ▼
nginx (TLS termination, static file serving)
    │
    ├── /                     → /var/www/warm.care/  (Vite React SPA)
    └── /api/*                → uvicorn 127.0.0.1:8002 (FastAPI, 2 workers)
                                         │
                                         ├── warm.db           (SQLite, project root)
                                         ├── Google OAuth       (accounts.google.com)
                                         ├── Google Gemini API  (generativelanguage.googleapis.com)
                                         ├── Gmail / Drive API  (googleapis.com)
                                         └── AWS SES            (email delivery)
```

---

## Auth Flow

### Primary user (Google OAuth)

1. `GET /api/auth/google/login` — generates 256-bit state token, writes to `auth_states` DB table, redirects to Google.
2. Google redirects to `GET /api/auth/google/callback?code=...&state=...`.
3. Callback atomically reads and deletes state from DB (prevents replay across workers).
4. Exchanges `code` for tokens at Google's `/token` endpoint (HTTPS, server-side only).
5. Verifies ID token signature via `google-auth` library (checks `aud`, `iss`, `exp`, signature).
6. Checks `email_verified` claim — unverified emails rejected.
7. Looks up email in `users` table:
   - **Known user** → issues JWT, sets `wc_session` HttpOnly cookie → redirects `/`.
   - **Unknown email, pending request** → redirects `/?error=pending_approval`.
   - **Unknown email, denied** → redirects `/?error=auth_failed`.
   - **Unknown email, first time** → checks rate limit (max 10 requests/24h), inserts into `user_requests`, emails admin, redirects `/?error=pending_approval`.

### Supporter (Google OAuth)

Same OAuth flow with `portal=supporter` + optional `invite` token in state.
Sets `wc_supporter` cookie (separate from `wc_session`).
Supporter routes live under `/supporter/*` — completely separate from primary auth.

### Session cookies

| Cookie | Path | HttpOnly | Secure | SameSite | Max-Age |
|--------|------|----------|--------|----------|---------|
| `wc_session` | `/` | ✅ | IS_PROD | strict | 30 days |
| `wc_supporter` | `/` | ✅ | IS_PROD | strict | 7 days |

JWT payload: `{ sub: user_id, name, exp }`. Role is NOT stored in the JWT — it is queried from the DB on every request that requires it (see `require_admin`).

### Password login (backup only)

`POST /api/auth/password-login` — bcrypt verify, returns `JSONResponse` with `wc_session` cookie set. Rate limited by `login_attempts` table (10 attempts/5 min per email).

---

## DB Schema Ownership

**File:** `backend/app/database.py` — `init_db()` owns all schema creation and migrations.

All schema changes go in `init_db()`:
- Table creation → `executescript()` block (idempotent `IF NOT EXISTS`)
- Column additions → separate `try/except ALTER TABLE` blocks (safe on existing DBs)
- Seed data → direct `UPDATE`/`INSERT` after migrations

**Never** run raw `CREATE TABLE` or `ALTER TABLE` outside `init_db()`.

### Tables

| Table | Owner | Purpose |
|-------|-------|---------|
| `users` | auth.py | Primary user accounts (id, name, email, role) |
| `user_requests` | auth.py, admin.py | Access request queue |
| `user_events` | admin.py | Admin action audit log |
| `auth_states` | auth.py | Short-lived OAuth state tokens (cross-worker safe) |
| `credentials` | legacy | WebAuthn (unused; kept for safe migration) |
| `user_passwords` | auth.py | Optional bcrypt passwords |
| `password_set_tokens` | auth.py | One-time password-set links |
| `login_attempts` | auth.py | Rate limiting for password login |
| `connections` | connections.py | Google OAuth tokens (Fernet-encrypted), Venmo |
| `oauth_states` | connections.py | OAuth state for Gmail/Drive connections |
| `supporter_accounts` | supporter_auth.py | Supporter accounts |
| `supporter_invites` | supporter_auth.py | Invite tokens |
| `supporter_access_log` | supporter_auth.py | Supporter audit log |
| `checkrun_bills` | checkrun.py | Monthly bill templates |
| `checkrun_transactions` | checkrun.py | Monarch Money transaction cache |
| `checkrun_overrides` | checkrun.py | Manual cleared/uncleared overrides |
| `menu_items` | menu.py | Today's menu items |
| `menu_meta` | menu.py | Menu publish state |
| `reminders` | reminders.py | Recurring reminder definitions |

**DB path:** `backend/app/../../warm.db` → project root `warm.db`. Permissions: `600`.

---

## Role System

| Role | Who | Access |
|------|-----|--------|
| `admin` | ellengambrell@gmail.com | All routes + `/api/admin/*` |
| `user` | margaretgambrell@gmail.com + approved users | All app routes |

Role is stored in `users.role`. `require_admin` dependency queries the DB on every call — does not trust the JWT claim. JWT does not contain `role`.

---

## Threat Model

**User population:** People with spinal cord injuries in care/home settings. Devices may be shared with caregivers or family. Physical access to the device is a realistic threat vector.

**Primary concerns:**
1. Session cookie exfiltration (XSS, network) — mitigated: HttpOnly, SameSite=strict, CSP header
2. Physical device access — mitigated: no tokens in localStorage, role not in localStorage cache
3. Caregiver/family accessing Margaret's data via the app — mitigated: single-user auth, session cookies
4. OAuth token theft from DB — mitigated: Fernet encryption at application layer, DB chmod 600
5. Admin inbox flooding — mitigated: 10 request/24h global rate limit on access requests

**Accepted risks:**
- Google Gemini API receives financial PII when user asks financial questions (no DPA — see NOTES.md MEDIUM-3)
- Role changes propagate to client only after next `/api/auth/me` call (INFO-1 — by design for AT connection resilience)

---

## Multi-Worker Notes

Production runs 2 uvicorn workers (`warmcare.service`). Do NOT use in-process shared state:

- ❌ Module-level dicts (`_oauth_states` — removed 2026-05-12)
- ❌ In-memory rate limiters shared across workers
- ✅ SQLite DB (WAL mode enabled — concurrent reads during writes)
- ✅ `auth_states` table for OAuth state (atomic read-and-delete in callback)

---

## Deploy

GitHub push to `main` → CI builds frontend (Vite), rsyncs backend, restarts `warmcare.service`.
See `NOTES.md` for per-release infra steps and env var requirements.

**Health check:** `GET /api/health` → `{ "status": "ok" }`
