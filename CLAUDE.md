# MargaretAI — Project State

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
Stack: React PWA (TypeScript + Vite) + FastAPI (Python 3.11) + SQLite + GreenGeeks shared hosting
Auth: Google OAuth (HttpOnly cookie) — live in production
Last meaningful work: Google OAuth + SMTP migration, security CRITICALs resolved (2026-04-27)

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

### Pending Infra (before Google OAuth goes live)
See NOTES.md "Infra Needed — 2026-04-26"

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

## Recent Changes

<!-- Builder Agent updates after each meaningful commit -->

---

## ⚠️ Flags

[Security 2026-04-26] ✅ RESOLVED — CRITICAL-1: JWT in localStorage. Fixed: HttpOnly cookie auth via Google OAuth (commit 2863472).
[Security 2026-04-26] ✅ RESOLVED — CRITICAL-2: /api/documents/synopsis auth guard. Confirmed present in production codebase (documents.py line 32).
[Security 2026-04-27] ✅ RESOLVED — HIGH-1: OAuth/Monarch tokens encrypted at rest with Fernet. Fernet key confirmed valid and active 2026-04-28.
[Security 2026-04-27] ✅ RESOLVED — HIGH-2: warm.db chmod 600, not web-accessible, confirmed 2026-04-28.
[Security 2026-04-27] ✅ RESOLVED — HIGH-3: CSP header added to SecurityHeadersMiddleware. Commit 6730c42.
[Security 2026-04-27] ✅ RESOLVED — MEDIUM-4: Primary user signup gated after first registration. Commit 6730c42.
[Security 2026-04-27] ✅ RESOLVED — MEDIUM-5: GOOGLE_AUTH_REDIRECT_URI standardized in connections.py. Commit 6730c42.

---

## Open Questions / Decisions Needed

- [ ] **Google OAuth infra deploy** — see NOTES.md "Infra Needed — 2026-04-26". Must happen before login works in production.
- [ ] **What is Margaret actually using?** — Which features does she use daily? What's broken or frustrating for her right now?
- [ ] **Supporter invitations** — Has Margaret invited anyone yet? Are her key contacts set up?
- [ ] **Font / text size** — Default sizes may be too small for Margaret's use case. Needs validation.
- [ ] **AT testing pass** — No component has been tested with iOS Voice Control "show names" or Switch Control simulation yet.
- [ ] **Pressure relief / medication reminders** — Safety-critical for SCI. Is this something Margaret needs now?
