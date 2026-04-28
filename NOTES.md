# NOTES.md — MargaretAI

All agents read and write here. Tag entries clearly.

---

## Security Review — 2026-04-26

[Security Agent] Full adversarial review complete. 2 CRITICAL findings, 3 HIGH, 5 MEDIUM, 4 LOW, 3 INFO.
Builder Agent should pause current work and address CRITICAL-1 and CRITICAL-2 first.
Full findings below and in the Security Agent session output.

### CRITICAL-1: JWT stored in localStorage — XSS-extractable session token
Status: ✅ FIXED — commit 2863472. Switched to HttpOnly cookie auth (Google OAuth). JWT never touches localStorage.

### CRITICAL-2: /api/documents/synopsis has no authentication
Status: ✅ FIXED — `_user: dict = Depends(get_current_user)` confirmed present at line 32 of backend/app/documents.py. Auth guard was in place in the recovered production codebase.

See full Security Agent report for remaining HIGH/MEDIUM/LOW findings.

---

## Infra Needed — 2026-04-26

[Builder Agent] The following server-side changes are required for Google OAuth + SMTP to work in production.
All code changes are committed and ready — only the infra steps below are outstanding.

### 1. Google Cloud Console — configure OAuth credentials
- Go to Google Cloud Console → APIs & Services → Credentials
- Edit the existing OAuth 2.0 Client ID (or create one)
- Add to **Authorized JavaScript origins**: `https://warm.care`
- Add to **Authorized redirect URIs**: `https://warm.care/api/auth/google/callback`
- Save. Copy **Client ID** and **Client Secret** for step 2.

### 2. .env on GreenGeeks — add Google OAuth variables
SSH or cPanel File Manager → `/home/shimmeri/MargaretAI/backend/.env`

Add these lines (values from step 1):
```
GOOGLE_CLIENT_ID=<your-client-id>
GOOGLE_CLIENT_SECRET=<your-client-secret>
GOOGLE_AUTH_REDIRECT_URI=https://warm.care/api/auth/google/callback
```

Verify these are already set (should be from SMTP work):
```
SMTP_HOST=chi210.greengeeks.net
SMTP_PORT=465
SMTP_USER=noreply@warm.care
SMTP_PASS=<password>
SMTP_FROM=noreply@warm.care
MAGIC_LINK_BASE_URL=https://warm.care
```

### 3. Deploy + restart Passenger
```bash
cd /home/shimmeri/MargaretAI
git pull
source venv/bin/activate
pip install -r backend/requirements.txt
# restart Passenger via cPanel → Passenger Apps → Restart
```

### 4. Verify
- Visit https://warm.care — should show "Sign in with Google" button
- Click it → redirects to Google → returns to https://warm.care signed in
- Visit https://warm.care/supporter → should show supporter Google sign-in page

---

## Director: copy/UX fix — 2026-04-27

Supporter portal role display is missing context. Currently shows:

> warm.care supporter
> Ellen
> Family

Should read:

> warm.care supporter
> Ellen
> Family for Margaret

The role label everywhere in the supporter portal should be `[role_label] for [primary user name]`. This applies to: the dashboard header/profile display, any place role is shown to the supporter.

"Margaret" is the known primary user of this instance. Simplest correct fix: append "for Margaret" to `role_label` in the SupporterDashboard component wherever it's rendered for the supporter's own context. If the primary user name is ever dynamic, fetch it from the existing `/api/auth/status` or a new `/api/profile` endpoint — but for now, "Margaret" is correct and hardcoding it is fine.

Builder: find `role_label` display in `frontend/src/components/SupporterDashboard.tsx` and update to `{role_label} for Margaret`.

---

## Session Notes — 2026-04-25

### Founding session
- Project vision established; see memory/project_vision.md
- Deep SCI accessibility research completed; see memory/research_sci_accessibility.md
- Full multi-agent playbook written; see memory/margaretai_playbook.md
- Domain names researched; top recommendation: myreach.ai (check live price on Porkbun)
- Product name recommendation: "Reach"

### Open for Director Review
- V1 access profile scope: recommend Stylus + Voice for V1 (Margaret's profile), defer Sip-and-Puff and Eye Gaze to V2 — but architecture must support them from day one
- Stack decision required before Builder can begin
