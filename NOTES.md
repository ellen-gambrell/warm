# NOTES.md — MargaretAI

All agents read and write here. Tag entries clearly.

---

## Security Review — 2026-04-26

[Security Agent] Full adversarial review complete. 2 CRITICAL findings, 3 HIGH, 5 MEDIUM, 4 LOW, 3 INFO.
Builder Agent should pause current work and address CRITICAL-1 and CRITICAL-2 first.
Full findings below and in the Security Agent session output.

### CRITICAL-1: JWT stored in localStorage — XSS-extractable session token
Location: frontend/src/context/AuthContext.tsx : lines 82-90
The JWT (which also grants access to Gmail, Drive, financial data) is persisted to localStorage under `warmcare_user_persistent`. Any XSS script can `localStorage.getItem('warmcare_user_persistent')` and extract a 30-day bearer token with full account access.
Recommendation: Move to HttpOnly SameSite=Strict cookie (set by the backend on login; cleared on logout). The existing JWT stays unchanged — only the transport mechanism changes.

### CRITICAL-2: /api/documents/synopsis has no authentication
Location: backend/app/documents.py : line 30
The document synopsis endpoint accepts file uploads and calls the Gemini API without requiring a JWT. Any unauthenticated request can consume Gemini API quota and potentially be used to extract information from uploaded files.
Recommendation: Add `user: dict = Depends(get_current_user)` to `get_synopsis()`.

See full Security Agent report for all findings.

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
