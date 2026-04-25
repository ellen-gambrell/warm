# BACKLOG.md — MargaretAI

Priority order. Director owns sequencing. Builder picks highest unassigned item.

---

## Phase 0 — Foundation Decisions (Pre-Build)

- [ ] **Founder: choose tech stack** — React PWA vs React Native/Expo. Decision gates all Phase 1 work.
- [ ] **Founder: purchase domain** — Porkbun, priority order: myreach.ai → getreach.ai → reachably.ai → voxable.com
- [ ] **Founder: confirm Margaret's iPhone model and iOS version** — gates Voice Control and Eye Tracking feature planning

---

## Phase 1 — Core Shell (V1, Margaret's Profile)

- [ ] Input profile setup screen — "How do you use your device?" with 5 profile options; stylus + voice selected by default for Margaret
- [ ] Home screen with large-tile navigation — Gmail, Drive, Monarch Money, GIF Finder, Games, Chat
- [ ] AI chat interface — voice input (Web Speech API), TTS output, large text display
- [ ] ConfirmationPanel — plain-language synopsis + confirm/cancel for every AI action
- [ ] Profile persistence and update — user can change their input profile at any time

## Phase 1 — Integrations (V1)

- [ ] Gmail integration — Google OAuth, read inbox, compose and send via AI + ConfirmationPanel
- [ ] Google Drive integration — browse, open, search files via AI
- [ ] Monarch Money integration — read accounts, transactions, budgets via MCP tool; query via AI chat
- [ ] GIF Finder — Tenor/Giphy search, tap or voice-select GIF, share to iMessage / clipboard

## Phase 2 — Expanded Access Profiles

- [ ] Sip-and-puff / Switch Scanning profile — scan-optimized layout, row-column scan groups, minimal menu depth
- [ ] Eye Gaze profile — dwell navigation, no animated distractors, eye-gaze-friendly dwell time config
- [ ] Voice-only profile (C3-C4) — zero touch required, voice "confirm" / "cancel" wired everywhere
- [ ] Voiceitt SDK integration — atypical speech support (dysarthric, breathy, low-volume)

## Phase 2 — Polish

- [ ] Dark mode (default) with accessible contrast
- [ ] Onboarding flow — first-run profile setup with clear plain-language explanations
- [ ] Accessibility settings panel — adjust font size, contrast, dwell time, scan speed
- [ ] "Read back" command — TTS reads current screen content on voice command

## Phase 3 — Expansion

- [ ] iMessage / texting integration — compose and send texts via AI
- [ ] Wordle daily launch shortcut
- [ ] Reminder / timer system (medication, pressure relief schedule)
- [ ] Smart home voice pass-through (Alexa/Google Home commands via AI)

---

## Testing

- [ ] Switch Control scan simulation on every Phase 1 component
- [ ] iOS Voice Control "show names" pass on every Phase 1 component
- [ ] ConfirmationPanel: verify it cannot be bypassed or auto-executed
- [ ] Session persistence: verify no data loss on device lock / short inactivity

## Security

- [ ] Google OAuth token handling — storage audit
- [ ] Monarch Money MCP invocation audit logging
- [ ] Voice command prompt injection surface review
- [ ] CSP, HSTS, security headers baseline

---

*within reach.*
