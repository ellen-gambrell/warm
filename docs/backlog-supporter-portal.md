# Backlog: Supporter Portal — warm.care/supporter

**Status:** Not started
**Priority:** High — required before any caretaker-facing features (menu editor, care coordination, etc.) can ship
**Depends on:** Infra fixing production auth (Resend email, Passenger restart)

---

## The problem

warm.care is currently single-user (Margaret). Every feature we build that involves a caretaker — updating the menu, viewing Check Run, coordinating care — needs a separate authenticated surface with role-appropriate access. That surface is `/supporter`.

Margaret's experience at `warm.care` does not change. Supporters get their own login, their own portal, and see only what their role permits.

---

## URL structure

```
warm.care/           → Margaret's app (unchanged)
warm.care/supporter  → Supporter login + portal
```

Supporters never see Margaret's app shell. They land directly in their own purpose-built UI.

---

## Roles

### Tier 1 — Legal / Primary Authority

**`key_contact`**
The person Margaret (or her confirmed legal representative) has designated as primary. In practice: the person with healthcare POA or the closest trusted person if no formal POA exists. Can manage all other supporter accounts. Has the broadest access. Cannot be changed without a verified request process (see Open Questions).

**`sdm_supporter`** *(Supported Decision-Making)*
A formal or informal supporter who helps Margaret navigate decisions but has no independent legal authority. Margaret is still in charge — this person facilitates. Sees only what Margaret explicitly shares. Cannot manage other accounts.

> **Note on guardianship:** Court-appointed guardians are rare in SCI (SCI does not affect cognitive capacity). If a legal guardian exists, they may have authority to set the key_contact role. The app cannot verify legal status — it logs who designated whom and when, and defers legal disputes to the courts. A disclaimer is shown during supporter setup.

---

### Tier 2 — Family & Daily Life

**`family_secondary`**
Family members, close friends, or daily non-professional helpers. Can update the menu, view daily schedule, send messages. Cannot see financial data or medical details.

**`homemaker`**
Non-medical household help — cooking, errands, cleaning. Lower access than family. Sees task queue, shopping list, schedule. Cannot see personal messages, medical info, or finances.

---

### Tier 3 — Professional Non-Medical Care

**`pca`** *(Personal Care Attendant)*
Paid professional, non-medical. Helps with bathing, dressing, mobility, activities of daily living. Contractors who may turn over. Sees care routines, daily schedule, emergency contacts. Does not see financial data or full medical history. Access should be reviewable quarterly.

**`home_health_aide`** *(HHA)*
Licensed, can perform skilled tasks under a care plan (wound care, vitals). Sees care plan specifics, medication list, provider contacts. Does not see financial data.

**`respite`**
Temporary fill-in. Mirrors the role of whoever they're covering, but access **automatically expires** at a set date/time. Time-bounding is enforced at the data layer — not a UI toggle that can be forgotten.

---

### Tier 4 — Medical

**`nurse_medical`**
Live-in nurse or visiting medical professional. Full clinical view: medications, health notes, provider contacts, care plan. Cannot see financial accounts. Cannot manage other supporters.

**`therapist`** *(OT / PT / Speech)*
Periodic, goal-focused. Sees therapy goals, home exercise program, functional notes, equipment list. Does not see unrelated medical history, messages, or finances.

---

### Tier 5 — Coordination & Services

**`case_manager`**
Social worker or care coordinator. Manages benefits (Medicaid, SSI, ABLE accounts), coordinates across providers. Sees a coordination summary view that spans roles — provider list, service log, upcoming appointments, benefits status. Does not see personal messages or detailed financial accounts beyond benefits.

**`financial_manager`**
Manages SSI, Medicaid, ABLE accounts, and other benefits or financial instruments. Distinct from a conservator (court-appointed). Sees financial summary and benefits documentation. Does not see medical detail beyond what's needed for benefits qualification.

**`transportation`**
Provides rides to appointments. Sees appointment schedule, pickup time, and destination. Does not have a permanently stored home address. Access is limited to upcoming appointments only — no history.

---

## Permission matrix

| Feature | key_contact | sdm_supporter | family_secondary | homemaker | pca | hha | respite | nurse_medical | therapist | case_manager | financial_manager | transportation |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| View daily menu | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | — |
| Edit daily menu | ✓ | — | ✓ | ✓ | — | — | mirrors | — | — | — | — | — |
| View schedule / appointments | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | ✓ (upcoming only) |
| View task / shopping list | ✓ | ✓ | ✓ | ✓ | ✓ | — | mirrors | — | — | — | — | — |
| View care routines | ✓ | — | — | — | ✓ | ✓ | mirrors | ✓ | ✓ | — | — | — |
| View medication list | ✓ | — | — | — | — | ✓ | mirrors | ✓ | — | — | — | — |
| View provider contacts | ✓ | — | — | — | ✓ (emergency) | ✓ | mirrors | ✓ | ✓ | ✓ | — | — |
| View Check Run (financial) | ✓ | — | — | — | — | — | mirrors | — | — | — | ✓ | — |
| View benefits / SSI / ABLE | ✓ | — | — | — | — | — | mirrors | — | — | ✓ | ✓ | — |
| View health / clinical notes | ✓ | — | — | — | — | ✓ | mirrors | ✓ | ✓ (own notes) | summary only | — | — |
| Manage other supporters | ✓ | — | — | — | — | — | — | — | — | — | — | — |
| Revoke own access | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

Margaret can always see who has what access and revoke any non-guardian supporter instantly.

---

## Auth model for `/supporter`

Supporters have **separate accounts** from Margaret. They log in at `warm.care/supporter` with their own email + magic link (same Resend-based delivery as Margaret's auth, once that's fixed).

```
supporter_accounts table:
  id, name, email, role, invited_by, expires_at (null = permanent),
  created_at, last_active_at, revoked_at

supporter_invites table:
  id, email, role, invited_by, token, expires_at, accepted_at
```

**Invite flow:**
1. key_contact (or Margaret) initiates invite from `/supporter` dashboard
2. Backend generates a one-time invite link, emails it to the supporter
3. Supporter clicks link → sets their name → account created
4. Role is fixed at invite time — cannot be self-escalated

**Respite time-bounding:**
- Invite form for respite role requires an expiry date
- At expiry: account is automatically suspended (not deleted — audit trail preserved)
- key_contact is notified 24h before expiry

---

## Known supporters for Margaret's circle

| Person | Role | Invited by |
|--------|------|------------|
| Adam (brother) | `key_contact` | Margaret (self-designated) |
| Shannon (sister-in-law) | `family_secondary` | Adam or Margaret |
| Leslie | `pca` | Adam or Margaret |

Margaret is in **Scenario A** — full legal control, no guardian. This is the default and expected case for SCI. Both Margaret and Adam (as key_contact) can invite supporters.

---

## Key contact designation — the hard problem

This is the most legally sensitive part of the system. Three scenarios:

**Scenario A — Margaret is in full control (most common for SCI)**
Margaret logs into her app, navigates to Settings → Supporters, and designates her key_contact. She can change this at any time. This is the default assumption.

**Scenario B — Supported Decision-Making**
Margaret designates her key_contact with the help of an SDM supporter. The key_contact can then invite other supporters. Margaret retains the right to revoke.

**Scenario C — Legal guardian exists**
The guardian may have the authority to set the key_contact. In this case, the guardian contacts support (email/form) with documentation. A human reviews and sets the key_contact manually. This is not self-serve. The app logs who made the change, when, and what documentation was cited.

**Changing the key_contact:**
- Margaret can change it herself at any time (Scenario A/B)
- If a guardian is on record, changes require the same human review process
- Old key_contact receives an email notification when they are replaced
- 48-hour grace period where the old key_contact can flag a dispute

**Disclaimer shown during all supporter setup:**
> "warm.care does not verify legal authority. By designating a supporter, you confirm you have the right to share this access. Contact support if there is a legal dispute over access to this account."

---

## `/supporter` portal — what it looks like

**Login screen** (`/supporter`)
- Separate branding treatment from Margaret's app — same warm.care aesthetic but clearly labeled "Supporter sign-in"
- Email + magic link only (no password option for V1)
- "Are you Margaret? Sign in here →" link to main app

**Dashboard** (after login)
- Shows the user's name and role prominently ("You're signed in as Ellen · Family")
- Only shows sections relevant to their role (no empty sections for things they can't see)
- No app-shell navigation — supporters get a purpose-built set of views, not Margaret's home screen

**Role-specific views (examples):**
- `family_secondary`: Menu editor + upcoming schedule
- `pca`: Care routines + emergency contacts + daily schedule
- `nurse_medical`: Care plan + medications + health notes + provider contacts
- `key_contact`: All of the above + supporter management

---

## Data model additions

```sql
CREATE TABLE supporter_accounts (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    email           TEXT NOT NULL UNIQUE,
    role            TEXT NOT NULL,
    invited_by      TEXT,              -- supporter_account id or 'margaret'
    expires_at      INTEGER,           -- null = permanent; unix timestamp for respite
    created_at      INTEGER NOT NULL,
    last_active_at  INTEGER,
    revoked_at      INTEGER,
    revoked_by      TEXT               -- who revoked it
);

CREATE TABLE supporter_invites (
    id          TEXT PRIMARY KEY,
    email       TEXT NOT NULL,
    role        TEXT NOT NULL,
    invited_by  TEXT NOT NULL,
    token       TEXT NOT NULL UNIQUE,
    expires_at  INTEGER NOT NULL,      -- invite link expires in 7 days
    accepted_at INTEGER
);

CREATE TABLE supporter_access_log (
    id              TEXT PRIMARY KEY,
    supporter_id    TEXT NOT NULL,
    action          TEXT NOT NULL,     -- 'login' | 'view:menu' | 'edit:menu' | etc.
    timestamp       INTEGER NOT NULL
);
```

---

## API routes

```
POST /api/supporter/auth/send           → send magic link to supporter email
POST /api/supporter/auth/verify         → verify token → set supporter session cookie
POST /api/supporter/auth/logout         → clear session
GET  /api/supporter/me                  → current supporter profile + role

GET  /api/supporter/invite/{token}      → validate invite token
POST /api/supporter/invite/{token}      → accept invite, create account

GET  /api/supporter/accounts            → (key_contact only) list all supporters
POST /api/supporter/accounts/invite     → (key_contact only) send invite
DELETE /api/supporter/accounts/{id}     → (key_contact only) revoke access

-- Role-gated data endpoints (same backend data, different auth layer)
GET  /api/supporter/menu                → menu data (all roles with menu permission)
POST /api/supporter/menu/edit           → update menu (roles with edit permission)
GET  /api/supporter/schedule            → appointments (roles with schedule permission)
-- ... etc for each data domain
```

---

## Files to create / touch

**Backend:**
- `backend/app/supporter_auth.py` — supporter login, invite, session
- `backend/app/supporter_data.py` — role-gated data endpoints
- `backend/app/database.py` — add supporter tables to `init_db()`
- `backend/app/main.py` — register supporter routers

**Frontend:**
- `frontend/src/components/SupporterLogin.tsx`
- `frontend/src/components/SupporterDashboard.tsx`
- `frontend/src/components/supporter/MenuEditor.tsx`
- `frontend/src/components/supporter/CareRoutines.tsx`
- `frontend/src/components/supporter/Schedule.tsx`
- `frontend/src/components/supporter/SupporterManagement.tsx` (key_contact only)
- `frontend/src/context/SupporterAuthContext.tsx`
- `frontend/src/App.tsx` — add `/supporter/*` routes

---

## Open questions

- [ ] **Key contact change process for guardian scenario**: What documentation do we accept? Who reviews it? Is this a support email or a form?
- [ ] **Does Margaret get notified** when a supporter logs in or views sensitive data? Probably yes for medical/financial views — opt-in or always-on?
- [x] **Multi-user households**: Adam (brother) = `key_contact`, Shannon (sister-in-law) = `family_secondary`. Two separate accounts with distinct roles — correct split.
- [x] **Role for the sister-in-law specifically**: Shannon = `family_secondary`. Covers menu editing + schedule view. Correct for her involvement.
- [ ] **SDM agreement upload**: Should supporters be able to upload a scanned SDM agreement for record-keeping? Or is that out of scope?
- [ ] **Session length for supporters**: Margaret's session is 30 days. Supporters who are paid staff (PCA, HHA) should probably be 8 hours or require re-auth daily. Family might be 30 days. Should be configurable per role.
- [ ] **Offline access**: PCAs and respite workers may be in areas with poor connectivity. Should any supporter data be available offline?

---

## Out of scope for V1

- Supporter-to-supporter messaging
- Shift scheduling and handoff notes between PCAs
- Integration with agency systems (most home care is agency-billed)
- Medication administration logging (this is clinical software territory — regulatory risk)
- Video check-in
- Geographic restrictions on access (e.g., only accessible when in the home)
