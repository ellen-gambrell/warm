# warm.care

Accessibility-first AI assistant (codename: **MargaretAI**). Live at https://warm.care.

## Stack

- **Backend:** Python / FastAPI / SQLite (WebAuthn credentials live in `warm.db`)
- **Frontend:** React / TypeScript / Vite
- **Auth:** WebAuthn (passkeys) + Google OAuth + magic link
- **Email:** AWS SES, custom MAIL FROM `mail.warm.care`, separate `warmcare-ses` IAM user
- **Hosting:** Hetzner CPX11 — `warmcare.service` (systemd, port 8002) behind nginx; SSL via Certbot

## Deploy

Normally via GitHub Actions on push to `main`. Manual deploy procedure, emergency triage (502 / 404 / 500 / SSL), env-var inventory, log locations, and disaster recovery all live in [`program_playbook.md`](https://github.com/ellen-gambrell/program/blob/main/program_playbook.md) (private repo).

Common shortcuts:

```bash
ssh hetzner 'sudo systemctl restart warmcare'
curl -si https://warm.care/api/health | head -2
ssh hetzner 'journalctl -u warmcare -n 50 --no-pager'
```

## Local development

```bash
# Backend
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # fill in OAuth / JWT / SES secrets
python -m uvicorn app.main:app --reload --port 8002

# Frontend
cd frontend
npm install
npm run dev
```

## Status

Production. Multi-user with admin portal (`/admin`). Hourly cron drives `cron_cards.py` for content refresh.

## Critical operational notes

- `warm.db` holds all WebAuthn credentials. **No automated backups yet** — see the playbook's weekly manual backup procedure. If the DB is lost, every user must re-register.
- `*.env`, `*.db`, and `venv/` must never be rsync'd to the server — these are server-side only.
- AWS SES has a known silent-failure mode if the SMTP password is mistyped. `email_service.py` carries loud startup warnings + per-send logs specifically to prevent recurrence.

## PR title convention

warm.git PRs use **sailing terms** (e.g. "Maiden voyage", "Trim the sails", "Hands to braces", "Steady the helm"). Branch names and commit messages stay descriptive; only the PR title follows the convention.
