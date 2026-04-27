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

Stage: Pre-build — foundation decisions pending
Domain: TBD — check project_domain_naming.md; recommend myreach.ai or reachably.ai
Stack: DECISION NEEDED — React PWA vs React Native/Expo (see Open Questions)
Deployment: DECISION NEEDED — Vercel or Netlify
Hosting: Founder purchasing domain on Porkbun

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

[Security 2026-04-26] ⚠️ SECURITY CRITICAL — JWT stored in localStorage (XSS-extractable). Move to HttpOnly cookie before any additional integrations ship. Builder should pause and address first.
[Security 2026-04-26] ⚠️ SECURITY CRITICAL — /api/documents/synopsis has no auth guard. Unauthenticated Gemini API access + potential data exposure. Add `Depends(get_current_user)` immediately.

---

## Open Questions / Decisions Needed

- [ ] **Tech stack:** React PWA vs React Native/Expo — PWA is simpler (no app store), Expo enables better native AT integration (iOS Voice Control, Switch Control APIs)
- [ ] **Domain:** Purchase on Porkbun — myreach.ai → getreach.ai → reachably.ai → voxable.com (in priority order)
- [ ] **Voice accuracy:** Voiceitt SDK for atypical speech — evaluate cost/benefit for V1
- [ ] **Input profiles for V1:** Which access profiles ship in V1 vs later? (Recommend: Stylus + Voice for V1, Sip-and-Puff + Eye Gaze in V2)
- [ ] **Margaret's iOS setup:** Does she have iOS Voice Control enabled? Has she configured AssistiveTouch? What's her current iPhone model?
