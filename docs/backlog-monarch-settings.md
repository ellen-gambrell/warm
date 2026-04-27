# Backlog: Monarch Money Connection Card in Settings

**Status:** Not started — blocked on auth research (see Open Questions)
**Priority:** High — Monarch is the data source for Check Run; without a live connection the sync is manual

---

## What to build

A "Monarch Money" connection card in the Settings page, following the exact same `ServiceCard` pattern used by Gmail, Google Drive, and Venmo.

### Connected state
- Border highlights in Monarch's brand green (`#00c805` or nearest accessible equivalent — verify contrast)
- "Connected ✓" badge
- "Connected as [email]" shown inside the card body (same pattern we'd use for any credential-based connection)
- "Disconnect" button (calls `DELETE /api/connections/monarch`, same generic disconnect handler already in `connections.py:226`)

### Disconnected state
- Two inline inputs: **Email** (type=email) and **Password** (type=password)
- "Connect Monarch Money" button
- On click: POST credentials to `POST /api/connections/monarch/connect`
- Show loading state ("Connecting…") during the request
- On success: `fetchStatus()` to refresh the card, `showNotice('Monarch Money connected!', true)`
- On failure: `showNotice(errorMessage, false)` — surface the specific error from the backend (bad credentials vs. network error vs. 2FA required)

---

## Files to touch

### Frontend

**`frontend/src/components/Settings.tsx`**

1. Add `monarch` to the `ConnectionStatus` interface (line 30):
   ```ts
   interface ConnectionStatus {
     gmail: boolean
     drive: boolean
     venmo: boolean
     monarch: boolean   // ← add
   }
   ```

2. Add state for the credential inputs (alongside `venmoUsername` at line 147):
   ```ts
   const [monarchEmail, setMonarchEmail]       = useState('')
   const [monarchPassword, setMonarchPassword] = useState('')
   ```
   Clear these on successful connect and on disconnect.

3. Add a `connectMonarch()` async function (alongside `connectGoogle` and `saveVenmo`):
   ```ts
   async function connectMonarch() {
     if (!user || !monarchEmail.trim() || !monarchPassword) return
     setBusy(b => ({ ...b, monarch: true }))
     try {
       const res = await fetch('/api/connections/monarch/connect', {
         method: 'POST',
         headers: authHeaders(user.token),
         body: JSON.stringify({ email: monarchEmail.trim(), password: monarchPassword }),
       })
       if (!res.ok) {
         const err = await res.json().catch(() => ({}))
         throw new Error(err.detail || 'Could not connect Monarch Money')
       }
       setMonarchEmail(''); setMonarchPassword('')
       fetchStatus()
       showNotice('Monarch Money connected!', true)
     } catch (e: unknown) {
       showNotice(e instanceof Error ? e.message : 'Monarch connection failed.', false)
     } finally {
       setBusy(b => ({ ...b, monarch: false }))
     }
   }
   ```

4. Add the `ServiceCard` JSX after the Venmo card (inside the Connected services `<div>` at line 344):
   ```tsx
   {/* Monarch Money */}
   <ServiceCard
     icon="👑"
     label="Monarch Money"
     description="Sync your transactions so Check Run can match bills automatically."
     accentColor="#00c805"
     connected={status?.monarch ?? false}
     busy={busy['monarch'] ?? false}
     onConnect={connectMonarch}
     onDisconnect={() => disconnect('monarch')}
   >
     {!status?.monarch && (
       <>
         <div>
           <label htmlFor="monarch-email" style={...}>Email</label>
           <input id="monarch-email" type="email" value={monarchEmail}
             onChange={e => setMonarchEmail(e.target.value)} ... />
         </div>
         <div>
           <label htmlFor="monarch-password" style={...}>Password</label>
           <input id="monarch-password" type="password" value={monarchPassword}
             onChange={e => setMonarchPassword(e.target.value)}
             onKeyDown={e => e.key === 'Enter' && connectMonarch()} ... />
         </div>
       </>
     )}
     {status?.monarch && (
       <p style={{ margin: 0, fontSize: 15, color: 'var(--color-text-muted)' }}>
         Connected as {monarchConnectedEmail}
       </p>
     )}
   </ServiceCard>
   ```
   The `monarchConnectedEmail` requires a new state value populated when status loads (see backend notes below).

5. Update `disconnect()` at line 240 to also clear Monarch inputs:
   ```ts
   if (provider === 'monarch') { setMonarchEmail(''); setMonarchPassword('') }
   ```

6. Add a `useEffect` (alongside the Venmo one at line 176) to fetch the connected email when `status.monarch` is true:
   ```ts
   useEffect(() => {
     if (status?.monarch && user) {
       fetch('/api/connections/monarch', { headers: authHeaders(user.token) })
         .then(r => r.json())
         .then(d => { if (d.email) setMonarchConnectedEmail(d.email) })
         .catch(() => {})
     }
   }, [status?.monarch])
   ```

### Backend

**`backend/app/connections.py`**

1. Add `"monarch"` to the status endpoint response (line 109):
   ```python
   return {
       "gmail":   "gmail"   in connected,
       "drive":   "drive"   in connected,
       "venmo":   "venmo"   in connected,
       "monarch": "monarch" in connected,
   }
   ```

2. Add a Pydantic body model:
   ```python
   class MonarchBody(BaseModel):
       email: str
       password: str
   ```

3. Add `POST /api/connections/monarch/connect`:
   ```python
   @router.post("/api/connections/monarch/connect")
   async def connect_monarch(body: MonarchBody, user: dict = Depends(get_current_user)):
       # --- auth logic here (see Open Questions) ---
       # On success: store session token / cookie jar in connections.data
       db = get_db()
       db.execute(
           """
           INSERT INTO connections (id, user_id, provider, access_token, data)
           VALUES (?, ?, 'monarch', ?, ?)
           ON CONFLICT(user_id, provider) DO UPDATE SET
               access_token = excluded.access_token,
               data         = excluded.data,
               updated_at   = datetime('now')
           """,
           (str(uuid.uuid4()), user["sub"], session_token, json.dumps({"email": body.email})),
       )
       db.commit()
       db.close()
       return {"status": "connected", "email": body.email}
   ```

4. Add `GET /api/connections/monarch` to return the stored email (used by the Settings card to show "Connected as [email]"):
   ```python
   @router.get("/api/connections/monarch")
   def get_monarch(user: dict = Depends(get_current_user)):
       db = get_db()
       row = db.execute(
           "SELECT data FROM connections WHERE user_id = ? AND provider = 'monarch'",
           (user["sub"],),
       ).fetchone()
       db.close()
       if not row:
           return {"email": None}
       data = json.loads(row["data"] or "{}")
       return {"email": data.get("email")}
   ```

5. Add a helper `get_monarch_session(user_id)` (analogous to `get_google_access_token`) for use by Check Run routes that need to call the Monarch API.

**`backend/app/database.py`**

No schema changes needed. The existing `connections` table already has:
- `access_token TEXT` — store the Monarch session token here
- `data TEXT` — store `{"email": "..."}` JSON here
- `UNIQUE(user_id, provider)` — handles upsert correctly

**`backend/requirements.txt`** (or equivalent)

Add `monarchmoney` if the library is available and supports the auth method chosen. See Open Questions.

---

## Storage model

| Column | What goes in it |
|--------|----------------|
| `provider` | `'monarch'` |
| `access_token` | Session token returned by Monarch auth (string) |
| `expires_at` | Token expiry if the API provides one; `NULL` otherwise |
| `data` | `{"email": "user@example.com"}` — display-only, never re-used for auth |
| `refresh_token` | Not used; `NULL` |

Credentials (email + password) are **never stored** — only the session token.

---

## Open Questions

### 1. What auth does Monarch Money actually support?

This is the primary blocker. There are three possibilities, in order of preference:

**Option A — Official OAuth / API key (preferred)**
Monarch has hinted at a developer API. If they offer OAuth or API keys, use that instead of credentials. Check their developer portal before implementing.

**Option B — `monarchmoney` Python library (most likely for now)**
The [`monarchmoney`](https://github.com/hammem/monarchmoney) community library authenticates via email+password and returns a session token. It also handles MFA/2FA. This is the most practical option today. Install with `pip install monarchmoney`.

Relevant library call:
```python
from monarchmoney import MonarchMoney
mm = MonarchMoney()
await mm.login(email=body.email, password=body.password)
# mm.session_token is now available
```
Note: the library is `async`-native — the endpoint must be `async def` and use `await`.

**Option C — Scrape the Monarch web app (not recommended)**
Fragile and likely against ToS. Avoid.

### 2. Does Monarch require MFA / 2FA?

If the account has MFA enabled, the `monarchmoney` library raises an exception asking for a one-time code. The Settings card would need a second step (OTP input) to handle this. Recommend:
- V1: attempt login, catch MFA exception, surface a friendly error ("Your account has two-factor authentication enabled. Disable it temporarily or use an app password if Monarch supports them.")
- V2: add OTP field inline when MFA is detected.

### 3. Do session tokens expire? How often?

Unknown. If the `monarchmoney` library's session token expires, Check Run syncs will start failing silently. The backend `get_monarch_session()` helper should catch auth errors and surface them to the user (e.g. re-flag the card as disconnected).

### 4. Is storing the session token in SQLite acceptable from a security standpoint?

The same question applies to Google OAuth tokens (already stored in `connections`), so the pattern is already established. Ensure `warm.db` has appropriate filesystem permissions on the server. This is worth a brief security review before deploying.

### 5. Monarch brand color

The Monarch Money brand uses a deep green. Verify the hex and check it meets WCAG 7:1 contrast against `var(--color-surface)` before using it as `accentColor`. Fallback: use `#00a804` (slightly darker) or adjust to pass contrast.

---

## Accessibility checklist (do not skip)

- [ ] Email and password inputs have explicit `<label>` elements with `htmlFor`
- [ ] Both inputs have `autoComplete` hints (`email`, `current-password`)
- [ ] "Connect" button has a descriptive `aria-label` ("Connect Monarch Money")
- [ ] Error messages go in the existing `role="status" aria-live="polite"` flash notice
- [ ] Touch targets: inputs `minHeight: 56`, button `minHeight: 64`
- [ ] Password input has a show/hide toggle (`type="password"` ↔ `type="text"`) so stylus users can verify what they typed

---

## Out of scope for this ticket

- Automatic transaction sync (that's Check Run infrastructure)
- Syncing on a schedule (that's a separate cron/background job)
- Multi-account support
- Importing historical transactions on first connect
