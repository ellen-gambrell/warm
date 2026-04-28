# BACKLOG.md — warm.care

Priority order. Director owns sequencing. Builder picks highest unassigned item.

---

## Now — Margaret's Daily Use

- [ ] **Global nav: persistent Back and Forward buttons** — Two large buttons (≥64px, full accessible tap target) pinned to the top of every screen, always present. Back goes to the previous screen in the navigation stack; Forward goes forward if available. Both are visually disabled (not hidden) when the action is unavailable — they must always occupy the same position so Margaret knows exactly where to reach. Never collapse, never hide, never move. This is the primary navigation pattern for the app. Builder: implement a global nav bar in App.tsx using `window.history` state; track a navigation stack in context so disabled state is deterministic, not inferred from the browser alone.

- [ ] **Gmail: Reply and Reply All with voice dictation** — On any open email, two clearly labeled buttons: "Reply" and "Reply All". Tapping either opens a compose view scoped to that thread, with voice dictation available (Web Speech API, same pattern as AI chat). Reply populates only the sender; Reply All populates all recipients. The distinction must be explicit and labeled — never ambiguous. Goes through ConfirmationPanel before sending ("Reply to [name]: [preview of message]. Send?"). Builder: this likely extends GmailView and the existing Gmail API integration; confirm the Gmail connection scopes include `gmail.send` and `gmail.compose`.

- [ ] **Gmail: attachment indicator on email list** — When an email in the list view has one or more attachments, show a paperclip icon (📎 or SVG equivalent) alongside the subject line. No count needed — presence or absence is sufficient. Must be visible at a glance without opening the email. Builder: the Gmail API `messages.list` response includes a `payload.parts` field; an attachment is present when any part has a `filename` and a non-zero `body.size`.

---

These are the highest-leverage improvements for the person actually using this app today.

- [ ] **Font size control** — Margaret uses a stylus; she reads from a phone. Default text sizes have not been validated with her. Add a font size setting (small / medium / large / x-large) that persists and applies globally. Do not bury in Settings — surface it prominently.
- [ ] **Voice input: does it work for Margaret?** — Web Speech API accuracy on iOS Safari needs validation. If it's unreliable, it's her primary input degraded. Test and document. Flag to AT Specialist if issues found.
- [ ] **Pressure relief / medication reminders** — Scheduled reminders are a safety-critical need for SCI users (repositioning every 2 hours prevents pressure injuries). Simple recurring reminder with TTS readout. No complex scheduling UI.
- [ ] **Supporter setup** — Margaret needs to actually invite her key contacts. Validate the invite flow end-to-end: send email, receive invite, accept via Google, view in supporter dashboard. Fix anything broken.

---

## Soon — Polish and Reliability

- [ ] **Onboarding / first-run experience** — New users land on the Home screen with no guidance. A first-run flow (2-3 screens max) should explain what warm.care is, confirm the Google account, and offer to send a test message. Plain language, no jargon, skippable.
- [ ] **AT testing pass — Voice Control** — Run iOS Voice Control "show names" overlay on every component. Every interactive element must have a speakable label. Log findings to NOTES.md.
- [ ] **AT testing pass — Switch Control** — Keyboard tab simulation on every component. Confirm scan order is logical and all actions are reachable within reasonable cycles.
- [ ] **Error states** — What does a user see when Gmail is disconnected and they try to open Gmail? What when the AI call fails? Every dead end needs a clear, human message and a path forward.
- [ ] **Offline / poor connection handling** — GreenGeeks shared hosting has latency spikes. The app should degrade gracefully, not hang silently.

---

## Later — Supporter Multi-Person Support

- [ ] **Supporter: switch between people they support** — A supporter (e.g. a case manager, home health aide, or family member) may support more than one person using warm.care. They should be able to see which people they support and switch between them without logging out and back in.

  User story: Ellen is "Family for Margaret" on one warm.care instance and "Family for David" on another. From the supporter portal, she should see both and tap to switch.

  Architectural note for Builder: warm.care is currently single-user per instance (one Margaret per deployment). Multi-person supporter switching implies either (a) cross-instance supporter identity — the supporter portal knows about multiple warm.care instances — or (b) a future shared identity layer. This needs an architecture decision before Builder touches it. Flag for Builder + Director discussion before any code is written.

---

## Later — Expanded Capability

- [ ] **"Read back" command** — TTS reads the current screen on voice command "read page" or similar. Critical for voice-primary users.
- [ ] **Accessibility settings panel** — Font size (if not done above), contrast preference, motion reduction. Not a checkbox — these are daily-use controls.
- [ ] **iMessage / texting** — Margaret texts constantly. Compose and send texts via AI + ConfirmationPanel.
- [ ] **Smart home pass-through** — Alexa/Google Home commands via AI chat. Common workaround for SCI users who already have smart home devices.
- [ ] **Reminder / timer system (full)** — Beyond pressure relief: medications, appointments, recurring tasks. Must have TTS readout and a voice "snooze" / "done" path.

---

## Access Profile Expansion (V2)

These require architecture support that must be designed in from now, even if not shipped yet.

- [ ] **Sip-and-puff / Switch Scanning profile** — Scan-optimized layout. Row-column scan groups. Minimal menu depth (max 2 levels). Builder must design the current home screen to be scan-safe even before this is wired up.
- [ ] **Voice-only profile (C3-C4)** — Zero touch required anywhere. Voice "confirm" / "cancel" on ConfirmationPanel. All nav by voice command.
- [ ] **Eye Gaze profile** — Dwell navigation. No animated distractors near interactive elements. Dwell time configurable.
- [ ] **Voiceitt integration** — Atypical speech support. Evaluate cost/API availability before committing.

---

## Testing

- [ ] Switch Control scan simulation on every current component (none done yet)
- [ ] iOS Voice Control "show names" pass on every current component (none done yet)
- [ ] ConfirmationPanel: verify it cannot be bypassed or auto-executed
- [ ] Supporter invite flow: end-to-end with real email
- [ ] Google OAuth: end-to-end in production after infra deploy
- [ ] Session persistence: verify no state loss on device lock / short inactivity

---

## Security (remaining findings from 2026-04-26 review)

- [ ] HIGH: Google OAuth connection token handling audit (connections.py)
- [ ] HIGH: Monarch Money session token — confirm warm.db filesystem permissions on server
- [ ] MEDIUM: Voice command prompt injection surface — user voice input into Gemini prompts
- [ ] MEDIUM: Rate limiting on AI chat endpoint
- [ ] MEDIUM: CSP header review — SecurityHeadersMiddleware baseline audit

---

*within reach.*
