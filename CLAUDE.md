# MargaretAI — Project State

## Working Principles

1. Don't assume. Don't hide confusion. Surface tradeoffs.
2. Minimum code that solves the problem. Nothing speculative.
3. Touch only what you must. Clean up only your own mess.
4. Define success criteria. Loop until verified.

> Accessibility-first AI assistant for people with spinal cord injuries.
> Built first for Margaret (ischemic spinal stroke, stylus use). Designed for the SCI spectrum.
> Every feature must be usable by someone with no hand function at all.

---

## Active Agents

| Agent | Role | Last Active |
|-------|------|-------------|
| Accessibility Director | Vision integrity, accessibility standards, user advocacy | 2026-04-25 |
| Builder/Architect | Implementation, architecture, source code | — |
| AT Specialist | Assistive technology compatibility review | — |
| Tester | Test coverage, AT testing, bug reporting | — |
| Security | Adversarial review, vulnerability reporting | — |
| Research | SCI community research, AT ecosystem monitoring | — |

---

## Memory Location

~/.claude/projects/-Users-ellengambrell-projects-MargaretAI/memory/

Full agent directives: margaretai_playbook.md
Research reference: research_sci_accessibility.md
Vision + founding user: project_vision.md
Domain/naming: project_domain_naming.md

---

## Current Project State

Stage: Live — active development
Domain: warm.care (live)
Stack: React PWA (TypeScript + Vite) + FastAPI (Python 3.11) + SQLite + Hetzner VPS
Auth: Google OAuth (HttpOnly cookie) — live in production
Last meaningful work: Security hardening (HIGH-1/2, MEDIUM-1/2/3, LOW-1) + admin pending-count badge (2026-05-12)

### What's Built and Live
- Home screen (2-column tile grid, 64px targets)
- AI Chat (voice input via Web Speech API, TTS, ConfirmationPanel)
- Gmail read view
- Google Drive browse view
- GIF finder (Giphy)
- MoneyView (Venmo)
- Check Run
- Today's Menu (read-only)
- Supporter Portal (invite flow, role-based dashboard, menu editor)
- Settings (connections, 4-theme picker, supporter management, password)
- Sign out button (Home + Settings)
- 4-theme system (warm dark, warm light, adaptive, high contrast)

### Pending Deploy
PR #6 ready to merge — security hardening + admin badge. See NOTES.md for test plan.

---

## Hard Constraints (never negotiate these)

- No timed UI of any kind
- No auto-execute of AI actions — ConfirmationPanel always required
- No session timeout that loses user work
- No multi-touch without AssistiveTouch fallback
- Touch targets ≥ 44px (64px preferred for this audience)
- All interactive elements reachable by voice command
- All interactive elements reachable by Switch Control scanning
- Color contrast ≥ 7:1 for text

---

## Legal — Required on Every Page

Footer: "The views, thoughts, and opinions expressed on this site are solely my own and do not represent those of my employer, KPMG."
Disclaimer page: "The content, views, and opinions expressed on this website belong strictly to the author and do not necessarily reflect the official policy, position, or views of KPMG or any of its affiliates. This site is a personal project and is not affiliated with, sponsored by, or endorsed by KPMG."
Copyright: "© 2026 Quantum Moon LLC. All rights reserved."

---

## PR Title Convention

PR titles on the `warm` repo are **sailing terms.** Short, evocative,
nautical. The descriptive change-summary lives in the PR body, not the
title.

warm.care is about steadying someone through their day. Sailing language
fits — every action is named, every motion intentional, the boat moves
because the crew works together.

Examples:

- "Maiden voyage"
- "Set the course"
- "Hoist the mainsail"
- "Trim the sails"
- "Tack into wind"
- "Steady the helm"
- "Make port"
- "Cast off lines"
- "Anchor's aweigh"
- "Plot the course"
- "Heading aweigh"
- "Right the rudder"

Branch names and commit messages stay descriptive — only the PR title
follows this convention.

---

## Recent Changes

[Builder 2026-05-12] LIVE — admin roles, multi-user frontend, request queue, admin API (PR #3/#4, merged + deployed)
  Backend: users.role (admin|user), ellengambrell@gmail.com = admin. user_requests + user_events tables.
  google_callback: request/approval flow replaces single-user guard; email_verified gap closed.
  GET /api/admin/requests, GET /api/admin/pending-count, POST approve/deny with audit events.
  ADMIN_EMAIL env var. send_access_request_email, send_welcome_email, send_denial_email.
  Frontend: ProfileContext keyed by user ID (fixes "Hi Margaret" for Ellen). AuthContext exposes role.
  /admin route → AdminPanel (pending queue, approve/deny, 64px targets). Login reads ?error= params.
  DB migrations applied on startup. CI green. Health 200 OK.

[Builder 2026-05-13] PENDING DEPLOY — security hardening + polish (PR #6, branch claude/cool-maxwell-30b110)
  Security (HIGH-1/2, MEDIUM-1/2/3, LOW-1/2, INFO-2): all 2026-05-12 findings resolved.
    password_login cookie, auth_states DB, role removed from cache, google-auth sig verify,
    access request rate limit, uuid.UUID path params, ARCHITECTURE.md created.
  Admin: pending-count badge on Home tile (admin-only, live count from /api/admin/pending-count).
  AT: AdminPanel loading state announced, badge ARIA fixed, status tag aria-label added.
  Login: pending_approval uses info style (muted/role=status), not error red. Copy improved.
  Chat: financial context disclosure pill rendered when Monarch data used in Gemini prompt.
  auth.py: get_profile now returns role (consistent with get_me).
  No infra steps required — google-auth already in venv; requirements.txt pin handles CI.

---

## ⚠️ Flags

[Security 2026-04-26] ✅ RESOLVED — CRITICAL-1: JWT in localStorage. Fixed: HttpOnly cookie auth via Google OAuth (commit 2863472).
[Security 2026-04-26] ✅ RESOLVED — CRITICAL-2: /api/documents/synopsis auth guard. Confirmed present in production codebase (documents.py line 32).
[Security 2026-04-27] ✅ RESOLVED — HIGH-1: OAuth/Monarch tokens encrypted at rest with Fernet. Fernet key confirmed valid and active 2026-04-28.
[Security 2026-04-27] ✅ RESOLVED — HIGH-2: warm.db chmod 600, not web-accessible, confirmed 2026-04-28.
[Security 2026-04-27] ✅ RESOLVED — HIGH-3: CSP header added to SecurityHeadersMiddleware. Commit 6730c42.
[Security 2026-04-27] ✅ RESOLVED — MEDIUM-4: Primary user signup gated after first registration. Commit 6730c42.
[Security 2026-04-27] ✅ RESOLVED — MEDIUM-5: GOOGLE_AUTH_REDIRECT_URI standardized in connections.py. Commit 6730c42.

[Security 2026-05-12] ✅ RESOLVED — HIGH-1: password_login discards session cookie. Fixed: JSONResponse with cookie. PR #6.
[Security 2026-05-12] ✅ RESOLVED — HIGH-2: _oauth_states in-memory broken on 2-worker deploy. Fixed: auth_states DB table. PR #6.
[Security 2026-05-12] ✅ RESOLVED — MEDIUM-1: role in localStorage cache. Fixed: removed from writeCache; defaults to 'user'. PR #6.
[Security 2026-05-12] ✅ RESOLVED — MEDIUM-2: Google ID token signature not verified. Fixed: google-auth library. PR #6.
[Security 2026-05-12] ✅ RESOLVED — MEDIUM-3: No rate limit on access request creation. Fixed: 10/24h global limit. PR #6.
[Security 2026-05-12] ✅ RESOLVED — LOW-1: req_id not UUID-typed. Fixed: uuid.UUID path param. PR #6.
[Security 2026-05-12] ✅ RESOLVED — LOW-2: _oauth_states memory leak. Moot — HIGH-2 fixed by moving to DB.
[Security 2026-05-12] 🟡 OPEN — MEDIUM (policy) — Gemini API receives financial PII without DPA. Needs policy decision, not code fix.

---

## Open Questions / Decisions Needed

- [x] **Google OAuth infra deploy** — LIVE 2026-05-12. Login works in production.
- [x] **Pressure relief / medication reminders** — BUILT 2026-05-06. Reminders tile on Home, interval timers, TTS alert banner.
- [ ] **What is Margaret actually using?** — Which features does she use daily? What's broken or frustrating for her right now? Needs real-user feedback.
- [ ] **Supporter invitations** — Has Margaret invited anyone yet? Are her key contacts set up?
- [ ] **Font / text size** — Default sizes may be too small for Margaret's use case. Needs real-device validation.
- [ ] **AT testing pass** — No component has been tested with iOS Voice Control "show names" or Switch Control simulation yet. AT Specialist agent needed.
- [ ] **Gemini + financial PII** — Monarch data sent to Gemini API without DPA. Policy decision: add UI disclosure or restrict. (Security MEDIUM — 2026-05-12)
