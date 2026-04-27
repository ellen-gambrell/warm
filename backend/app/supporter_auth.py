"""
Supporter portal: authentication, invite flow, account management.

Routes
------
POST /api/supporter/auth/logout         → clear session
GET  /api/supporter/me                  → current supporter profile + role

GET  /api/supporter/invite/{token}      → validate pending invite (returns role, email)

GET  /api/supporter/accounts            → list all supporters (key_contact only)
POST /api/supporter/accounts/invite     → send invite email (key_contact only)
DELETE /api/supporter/accounts/{id}     → revoke access (key_contact only)

Cookie
------
wc_supporter — HttpOnly, Secure in prod, SameSite=Lax, 30-day Max-Age.
JWT payload: {"sub": supporter_account_id, "role": role}

Login
-----
All supporter login (new and returning) flows through Google OAuth:
GET /api/auth/google/login?portal=supporter
GET /api/auth/google/login?portal=supporter&invite=TOKEN  (invite acceptance)
"""

import os
import secrets
import time
import uuid

import jwt
from fastapi import APIRouter, Cookie, Depends, HTTPException, Response
from pydantic import BaseModel

from .database import get_db
from .email_service import send_supporter_invite_email

router = APIRouter()

# ── Config ─────────────────────────────────────────────────────────────────────

SUPPORTER_COOKIE  = "wc_supporter"
JWT_SECRET        = os.getenv("JWT_SECRET", "dev-secret-change-me")
JWT_ALGORITHM     = "HS256"
INVITE_TTL        = 7 * 24 * 3600    # 7 days
SESSION_TTL       = 30 * 24 * 3600   # 30 days
IS_PROD           = os.getenv("ENVIRONMENT", "").lower() in ("production", "prod")
BASE_URL          = os.getenv("MAGIC_LINK_BASE_URL", "http://localhost:5173")

# Roles that are allowed in the system
VALID_ROLES = {
    "key_contact", "sdm_supporter", "family_secondary", "homemaker",
    "pca", "home_health_aide", "respite", "nurse_medical", "therapist",
    "case_manager", "financial_manager", "transportation",
}

# Human-readable role labels
ROLE_LABELS = {
    "key_contact":       "Key Contact",
    "sdm_supporter":     "SDM Supporter",
    "family_secondary":  "Family",
    "homemaker":         "Homemaker",
    "pca":               "Personal Care Attendant",
    "home_health_aide":  "Home Health Aide",
    "respite":           "Respite",
    "nurse_medical":     "Nurse",
    "therapist":         "Therapist",
    "case_manager":      "Case Manager",
    "financial_manager": "Financial Manager",
    "transportation":    "Transportation",
}


# ── Cookie + JWT helpers ───────────────────────────────────────────────────────

def _set_supporter_cookie(response: Response, supporter_id: str, role: str) -> None:
    token = jwt.encode(
        {"sub": supporter_id, "role": role, "iat": int(time.time())},
        JWT_SECRET,
        algorithm=JWT_ALGORITHM,
    )
    response.set_cookie(
        key=SUPPORTER_COOKIE,
        value=token,
        httponly=True,
        secure=IS_PROD,
        samesite="lax",
        max_age=SESSION_TTL,
        path="/",
    )


def get_current_supporter(
    wc_supporter: str | None = Cookie(default=None),
) -> dict:
    """FastAPI dependency — returns supporter profile or raises 401."""
    if not wc_supporter:
        raise HTTPException(status_code=401, detail="Supporter sign-in required.")
    try:
        payload = jwt.decode(wc_supporter, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        supporter_id = payload["sub"]
        role = payload["role"]
    except Exception:
        raise HTTPException(status_code=401, detail="Session expired. Please sign in again.")

    db = get_db()
    row = db.execute(
        "SELECT id, name, email, role, expires_at, revoked_at "
        "FROM supporter_accounts WHERE id = ?",
        (supporter_id,),
    ).fetchone()
    db.close()

    if not row:
        raise HTTPException(status_code=401, detail="Account not found.")
    if row["revoked_at"]:
        raise HTTPException(status_code=403, detail="Your access has been revoked.")
    if row["expires_at"] and int(time.time()) > row["expires_at"]:
        raise HTTPException(status_code=403, detail="Your access has expired.")

    # Update last_active_at (fire-and-forget, ignore errors)
    try:
        db2 = get_db()
        db2.execute(
            "UPDATE supporter_accounts SET last_active_at = ? WHERE id = ?",
            (int(time.time()), supporter_id),
        )
        db2.commit()
        db2.close()
    except Exception:
        pass

    return {"id": row["id"], "name": row["name"], "email": row["email"], "role": role}


def require_role(*allowed_roles: str):
    """Return a dependency that checks the supporter's role."""
    def _check(supporter: dict = Depends(get_current_supporter)) -> dict:
        if supporter["role"] not in allowed_roles:
            raise HTTPException(status_code=403, detail="Your role does not permit this action.")
        return supporter
    return _check


def _log(supporter_id: str, action: str) -> None:
    try:
        db = get_db()
        db.execute(
            "INSERT INTO supporter_access_log (id, supporter_id, action, timestamp) VALUES (?, ?, ?, ?)",
            (str(uuid.uuid4()), supporter_id, action, int(time.time())),
        )
        db.commit()
        db.close()
    except Exception:
        pass


# ── Session management ────────────────────────────────────────────────────────

@router.post("/api/supporter/auth/logout")
def logout(response: Response):
    response.delete_cookie(SUPPORTER_COOKIE, path="/")
    return {"status": "ok"}


@router.get("/api/supporter/me")
def get_me(supporter: dict = Depends(get_current_supporter)):
    _log(supporter["id"], "view:me")
    return {
        "id": supporter["id"],
        "name": supporter["name"],
        "email": supporter["email"],
        "role": supporter["role"],
        "role_label": ROLE_LABELS.get(supporter["role"], supporter["role"]),
    }


# ── Invite flow ───────────────────────────────────────────────────────────────

@router.get("/api/supporter/invite/{token}")
def get_invite(token: str):
    """Validate an invite token and return the pending invite details."""
    db = get_db()
    now = int(time.time())
    row = db.execute(
        "SELECT email, role, expires_at, accepted_at FROM supporter_invites WHERE token = ?",
        (token,),
    ).fetchone()
    db.close()

    if not row:
        raise HTTPException(status_code=404, detail="Invite not found.")
    if row["accepted_at"]:
        raise HTTPException(status_code=400, detail="This invite has already been accepted.")
    if row["expires_at"] < now:
        raise HTTPException(status_code=400, detail="This invite link has expired.")

    return {
        "email": row["email"],
        "role": row["role"],
        "role_label": ROLE_LABELS.get(row["role"], row["role"]),
    }


# ── Account management (key_contact only) ─────────────────────────────────────

MENU_EDIT_ROLES = {"key_contact", "family_secondary", "homemaker"}
CAN_INVITE_ROLES = {"key_contact"}


@router.get("/api/supporter/accounts")
def list_accounts(supporter: dict = Depends(require_role("key_contact"))):
    db = get_db()
    rows = db.execute(
        "SELECT id, name, email, role, invited_by, expires_at, created_at, "
        "last_active_at, revoked_at "
        "FROM supporter_accounts ORDER BY created_at ASC"
    ).fetchall()
    db.close()
    return {
        "supporters": [
            {
                "id": r["id"],
                "name": r["name"],
                "email": r["email"],
                "role": r["role"],
                "role_label": ROLE_LABELS.get(r["role"], r["role"]),
                "invited_by": r["invited_by"],
                "expires_at": r["expires_at"],
                "created_at": r["created_at"],
                "last_active_at": r["last_active_at"],
                "revoked": bool(r["revoked_at"]),
            }
            for r in rows
        ]
    }


class InviteBody(BaseModel):
    email: str
    role: str
    expires_at: int | None = None  # unix timestamp; required for respite role


@router.post("/api/supporter/accounts/invite")
def send_invite(body: InviteBody, supporter: dict = Depends(require_role("key_contact"))):
    email = body.email.strip().lower()
    role = body.role.strip()

    if role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail=f"Unknown role: {role}")
    if role == "respite" and not body.expires_at:
        raise HTTPException(status_code=400, detail="Respite role requires an expiry date.")

    db = get_db()
    # Don't invite someone who already has an active account
    existing = db.execute(
        "SELECT id, revoked_at FROM supporter_accounts WHERE email = ?", (email,)
    ).fetchone()
    if existing and not existing["revoked_at"]:
        db.close()
        raise HTTPException(status_code=400, detail="This person already has an active supporter account.")

    token = secrets.token_urlsafe(32)
    now = int(time.time())
    invite_id = str(uuid.uuid4())

    db.execute(
        "INSERT INTO supporter_invites (id, email, role, invited_by, token, expires_at) "
        "VALUES (?, ?, ?, ?, ?, ?)",
        (invite_id, email, role, supporter["id"], token, now + INVITE_TTL),
    )
    db.commit()
    db.close()

    link = f"{BASE_URL}/supporter/accept?token={token}"
    role_label = ROLE_LABELS.get(role, role)
    try:
        send_supporter_invite_email(to=email, role_label=role_label, link=link)
    except Exception:
        raise HTTPException(status_code=502, detail="Could not send invite email. Please try again.")

    _log(supporter["id"], f"invite:sent:{role}:{email}")
    return {"status": "invited"}


@router.delete("/api/supporter/accounts/{account_id}")
def revoke_account(account_id: str, supporter: dict = Depends(require_role("key_contact"))):
    if account_id == supporter["id"]:
        raise HTTPException(status_code=400, detail="You cannot revoke your own access.")

    db = get_db()
    row = db.execute(
        "SELECT id, revoked_at FROM supporter_accounts WHERE id = ?", (account_id,)
    ).fetchone()
    if not row:
        db.close()
        raise HTTPException(status_code=404, detail="Account not found.")
    if row["revoked_at"]:
        db.close()
        raise HTTPException(status_code=400, detail="Account is already revoked.")

    db.execute(
        "UPDATE supporter_accounts SET revoked_at = ?, revoked_by = ? WHERE id = ?",
        (int(time.time()), supporter["id"], account_id),
    )
    db.commit()
    db.close()

    _log(supporter["id"], f"account:revoked:{account_id}")
    return {"status": "revoked"}


# ── Margaret's own supporter management (her session, not supporter cookie) ────

from .auth import get_current_user  # noqa: E402  (avoids circular at top)


@router.get("/api/margaret/supporters")
def margaret_list_supporters(_user: dict = Depends(get_current_user)):
    """Margaret views all supporters."""
    db = get_db()
    rows = db.execute(
        "SELECT id, name, email, role, expires_at, created_at, last_active_at, revoked_at "
        "FROM supporter_accounts ORDER BY created_at ASC"
    ).fetchall()
    db.close()
    return {
        "supporters": [
            {
                "id": r["id"],
                "name": r["name"],
                "email": r["email"],
                "role": r["role"],
                "role_label": ROLE_LABELS.get(r["role"], r["role"]),
                "expires_at": r["expires_at"],
                "created_at": r["created_at"],
                "last_active_at": r["last_active_at"],
                "revoked": bool(r["revoked_at"]),
            }
            for r in rows
        ]
    }


@router.post("/api/margaret/supporters/invite")
def margaret_invite_supporter(body: InviteBody, user: dict = Depends(get_current_user)):
    """Margaret invites a new supporter."""
    email = body.email.strip().lower()
    role = body.role.strip()

    if role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail=f"Unknown role: {role}")
    if role == "respite" and not body.expires_at:
        raise HTTPException(status_code=400, detail="Respite role requires an expiry date.")

    db = get_db()
    existing = db.execute(
        "SELECT id, revoked_at FROM supporter_accounts WHERE email = ?", (email,)
    ).fetchone()
    if existing and not existing["revoked_at"]:
        db.close()
        raise HTTPException(status_code=400, detail="This person already has an active supporter account.")

    token = secrets.token_urlsafe(32)
    now = int(time.time())
    db.execute(
        "INSERT INTO supporter_invites (id, email, role, invited_by, token, expires_at) VALUES (?,?,?,?,?,?)",
        (str(uuid.uuid4()), email, role, "margaret", token, now + INVITE_TTL),
    )
    db.commit()
    db.close()

    link = f"{BASE_URL}/supporter/accept?token={token}"
    role_label = ROLE_LABELS.get(role, role)
    try:
        send_supporter_invite_email(to=email, role_label=role_label, link=link)
    except Exception:
        raise HTTPException(status_code=502, detail="Could not send invite email. Please try again.")

    return {"status": "invited"}


@router.delete("/api/margaret/supporters/{account_id}")
def margaret_revoke_supporter(account_id: str, _user: dict = Depends(get_current_user)):
    """Margaret revokes a supporter's access."""
    db = get_db()
    row = db.execute(
        "SELECT id, revoked_at FROM supporter_accounts WHERE id = ?", (account_id,)
    ).fetchone()
    if not row:
        db.close()
        raise HTTPException(status_code=404, detail="Account not found.")
    if row["revoked_at"]:
        db.close()
        raise HTTPException(status_code=400, detail="Account is already revoked.")

    db.execute(
        "UPDATE supporter_accounts SET revoked_at = ?, revoked_by = ? WHERE id = ?",
        (int(time.time()), "margaret", account_id),
    )
    db.commit()
    db.close()
    return {"status": "revoked"}
