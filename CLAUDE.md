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
Last meaningful work: Custom AI cards, input profile selector, onboarding rewrite, error states (2026-05-13)

### What's Built and Live
- Home screen (2-column tile grid, 64px targets; admin tile for ellengambrell@gmail.com with pending-count badge)
- AI Chat (voice input via Web Speech API, TTS, ConfirmationPanel)
- Gmail read view + reply/reply-all
- Google Drive browse view (not-connected vs load-failure error states)
- GIF finder (Giphy, with search error state)
- MoneyView (Venmo)
- Check Run (user-scoped)
- Today's Menu (read-only; user-scoped)
- Supporter Portal (invite flow, role-based dashboard, menu editor, read-only Cards tab)
- Settings (connections, 4-theme picker, font size, input profile selector, supporter management, custom AI cards, password)
- Custom AI Cards (Gemini 2.0 Flash + Google Search grounding; scheduled tiles; cron runs hourly)
- Onboarding flow (3-step: welcome → input profile → ready; inline CSS, no Tailwind)
- Admin portal (/admin — Ellen only; request queue, user list, usage stats)
- Multi-user: access request queue, approve/deny, email notifications
- Reminders (pressure relief / medication; TTS alert banner; global timers)
- Nav bar (back/forward)
- 4-theme system (warm dark, warm light, adaptive, high contrast)
- Font size control (Standard / Large / X-Large)
- Input profile (stylus / voice / switch / sip-and-puff / gaze; synced to server)

### Infrastructure
- Hetzner 5.78.110.203, systemd warmcare.service, port 8002, 2 uvicorn workers
- cron_cards.py runs hourly via crontab → /var/log/warmcare_cards.log
- Deploy: rsync from local + systemd restart

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

[Builder 2026-05-13] LIVE — custom AI cards, input profile, onboarding, error states (PR #7 Fair winds)
  Custom cards: subscriptions + custom_cards tables; CRUD + refresh at /api/cards; require_paid dep;
  Gemini 2.0 Flash + Google Search grounding; cron_cards.py hourly runner; Settings UI; Home tiles;
  Supporter read-only Cards tab via /api/supporter/cards.
  Input profile: users.input_profile column; PATCH /api/auth/preferences; ProfileContext server sync;
  data-input-profile on <html>; Settings radio group.
  Onboarding: 3-step flow, inline CSS (Tailwind removed), wires profile into ProfileContext.
  Error states: Drive not-connected vs failure; GifView search error.

[Builder 2026-05-13] LIVE — security hardening (PR #6 Steady the helm)
  HIGH-1: password_login → JSONResponse with cookie. HIGH-2: auth_states DB table (cross-worker OAuth).
  MEDIUM-1: role out of localStorage. MEDIUM-2: google-auth ID token verification.
  MEDIUM-3: 10 request/24h rate limit. LOW-1: uuid.UUID path params. ARCHITECTURE.md created.

[Builder 2026-05-13] LIVE — multi-user, admin portal, metrics (PR #4 Set the course)
  users.role, user_requests, user_events, daily_message_counts, user_visit_counts tables.
  Admin portal: request queue, approve/deny, user list, stats. ProfileContext per-user localStorage key.

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
