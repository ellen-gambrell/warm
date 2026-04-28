"""
Auth routes — Google OAuth (primary login) + password (secondary, Settings-only).

Routes
------
GET  /api/auth/google/login            → redirect to Google OAuth
GET  /api/auth/google/callback         → handle Google callback → set cookie
GET  /api/auth/me                      → (auth) return current user from cookie
POST /api/auth/logout                  → clear session cookie
GET  /api/auth/status                  → { registered: bool }
GET  /api/auth/profile/{user_id}       → (auth) re-verify + return profile data
POST /api/auth/request-set-password    → (auth) email token for setting password
POST /api/auth/set-password            → set/update password via token
POST /api/auth/password-login          → bcrypt verify → set cookie (backup login)
"""

import base64
import json
import os
import secrets
import time
import urllib.parse
import uuid
from typing import Optional

import bcrypt
import httpx
import jwt as pyjwt
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import RedirectResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel

from .database import get_db
from .email_service import send_password_set_email

# ── Config ───────────────────────────────────────────────────────────────────

_raw_secret = os.environ.get("JWT_SECRET", "")
if not _raw_secret or _raw_secret == "dev-secret-change-in-production":
    if os.environ.get("ENVIRONMENT", "").lower() in ("production", "prod"):
        raise RuntimeError("JWT_SECRET must be set to a strong secret in production")
    _raw_secret = "dev-only-not-for-production"

JWT_SECRET   = _raw_secret
JWT_EXPIRY   = 30 * 24 * 3600
PW_SET_TTL   = 60 * 60
IS_PROD      = os.environ.get("ENVIRONMENT", "").lower() in ("production", "prod")
COOKIE_NAME  = "wc_session"

GOOGLE_CLIENT_ID         = os.environ.get("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET     = os.environ.get("GOOGLE_CLIENT_SECRET", "")
GOOGLE_AUTH_REDIRECT_URI = os.environ.get(
    "GOOGLE_AUTH_REDIRECT_URI", "https://warm.care/api/auth/google/callback"
)
GOOGLE_AUTH_URL  = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"

# In-memory OAuth state store {state: {payload, expires}}
_oauth_states: dict[str, dict] = {}
STATE_TTL = 600  # 10 minutes

# Supporter cookie name (set here when a supporter accepts an invite via Google)
SUPPORTER_COOKIE = "wc_supporter"

router  = APIRouter(prefix="/api/auth")
_bearer = HTTPBearer(auto_error=False)


# ── Helpers ──────────────────────────────────────────────────────────────────

def _issue_jwt(user_id: str, name: str) -> str:
    return pyjwt.encode(
        {"sub": user_id, "name": name, "exp": int(time.time()) + JWT_EXPIRY},
        JWT_SECRET,
        algorithm="HS256",
    )


def _set_cookie(response: Response, token: str, cookie_name: str = COOKIE_NAME) -> None:
    response.set_cookie(
        key=cookie_name,
        value=token,
        httponly=True,
        secure=IS_PROD,
        samesite="strict",
        max_age=JWT_EXPIRY,
        path="/",
    )


def get_current_user(
    request: Request,
    creds: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
) -> dict:
    cookie_token = request.cookies.get(COOKIE_NAME)
    if cookie_token:
        try:
            return pyjwt.decode(cookie_token, JWT_SECRET, algorithms=["HS256"])
        except pyjwt.ExpiredSignatureError:
            raise HTTPException(401, "Session expired — please sign in again")
        except pyjwt.InvalidTokenError:
            pass

    if creds:
        try:
            return pyjwt.decode(creds.credentials, JWT_SECRET, algorithms=["HS256"])
        except pyjwt.ExpiredSignatureError:
            raise HTTPException(401, "Token expired")
        except pyjwt.InvalidTokenError:
            raise HTTPException(401, "Invalid token")

    raise HTTPException(401, "Not authenticated")


def _decode_google_id_token(id_token: str) -> dict:
    try:
        seg = id_token.split(".")[1]
        seg += "=" * (-len(seg) % 4)
        return json.loads(base64.urlsafe_b64decode(seg))
    except Exception:
        raise HTTPException(400, "Failed to parse Google identity")


# ── Status ───────────────────────────────────────────────────────────────────

@router.get("/status")
def auth_status():
    db = get_db()
    count = db.execute("SELECT COUNT(*) FROM users").fetchone()[0]
    db.close()
    return {"registered": count > 0}


# ── Current user ─────────────────────────────────────────────────────────────

@router.get("/me")
def get_me(current: dict = Depends(get_current_user)):
    user_id = current["sub"]
    db = get_db()
    try:
        user = db.execute(
            "SELECT id, name, email FROM users WHERE id = ?", (user_id,)
        ).fetchone()
        if not user:
            raise HTTPException(404, "User not found.")
        return {"id": user["id"], "name": user["name"], "email": user["email"]}
    finally:
        db.close()


# ── Logout ────────────────────────────────────────────────────────────────────

@router.post("/logout")
def logout(response: Response):
    response.delete_cookie(COOKIE_NAME, path="/", samesite="lax")
    return {"status": "logged_out"}


# ── Profile (rolling TTL) ─────────────────────────────────────────────────────

@router.get("/profile/{user_id}")
def get_profile(user_id: str, response: Response, current: dict = Depends(get_current_user)):
    if current["sub"] != user_id:
        raise HTTPException(403, "Forbidden.")
    db = get_db()
    try:
        user = db.execute(
            "SELECT id, name, email FROM users WHERE id = ?", (user_id,)
        ).fetchone()
        if not user:
            raise HTTPException(404, "User not found.")
        _set_cookie(response, _issue_jwt(user["id"], user["name"]))
        return {"id": user["id"], "name": user["name"], "email": user["email"]}
    finally:
        db.close()


# ── Google OAuth ──────────────────────────────────────────────────────────────

@router.get("/google/login")
def google_login(
    portal: str = "primary",
    invite: Optional[str] = None,
):
    """
    portal = "primary"   → logs in as Margaret (sets wc_session)
    portal = "supporter" → logs in as supporter (sets wc_supporter)
    invite = TOKEN       → (supporter only) accepts invite after Google auth
    """
    state = secrets.token_urlsafe(16)
    _oauth_states[state] = {
        "portal": portal,
        "invite": invite,
        "expires": time.time() + STATE_TTL,
    }
    params = {
        "client_id":     GOOGLE_CLIENT_ID,
        "redirect_uri":  GOOGLE_AUTH_REDIRECT_URI,
        "response_type": "code",
        "scope":         "openid email profile",
        "state":         state,
        "prompt":        "select_account",
    }
    return RedirectResponse(GOOGLE_AUTH_URL + "?" + urllib.parse.urlencode(params))


@router.get("/google/callback")
def google_callback(code: str, state: str, response: Response):
    entry = _oauth_states.pop(state, None)
    if not entry or time.time() > entry["expires"]:
        return RedirectResponse("/?error=auth_failed")

    with httpx.Client() as client:
        resp = client.post(GOOGLE_TOKEN_URL, data={
            "code":          code,
            "client_id":     GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "redirect_uri":  GOOGLE_AUTH_REDIRECT_URI,
            "grant_type":    "authorization_code",
        })
    if resp.status_code != 200:
        return RedirectResponse("/?error=auth_failed")

    claims = _decode_google_id_token(resp.json().get("id_token", ""))
    email  = claims.get("email", "").lower()
    name   = claims.get("name") or claims.get("given_name") or email.split("@")[0]

    portal = entry.get("portal", "primary")
    invite_token = entry.get("invite")

    if portal == "supporter":
        return _handle_supporter_google(email, name, invite_token, response)

    # Primary user
    db = get_db()
    try:
        row = db.execute("SELECT id, name FROM users WHERE email = ?", (email,)).fetchone()
        if row:
            user_id, user_name = row["id"], row["name"]
        else:
            # Only allow a new primary user if no primary user exists yet (first-run).
            # After first registration, warm.care is single-user — no open signup.
            existing_count = db.execute("SELECT COUNT(*) FROM users").fetchone()[0]
            if existing_count > 0:
                return RedirectResponse("/?error=auth_failed")
            user_id, user_name = str(uuid.uuid4()), name
            db.execute(
                "INSERT INTO users (id, name, email) VALUES (?, ?, ?)",
                (user_id, user_name, email),
            )
            db.commit()
    finally:
        db.close()

    redirect = RedirectResponse("/")
    _set_cookie(redirect, _issue_jwt(user_id, user_name))
    return redirect


def _handle_supporter_google(email: str, name: str, invite_token: Optional[str], response: Response):
    from .supporter_auth import (
        SUPPORTER_COOKIE as SUP_COOKIE,
        JWT_SECRET as SUP_SECRET,
        SESSION_TTL,
        ROLE_LABELS,
        IS_PROD as SUP_IS_PROD,
        _log,
    )
    import jwt as _jwt

    def _supporter_jwt(supporter_id: str, role: str) -> str:
        return _jwt.encode(
            {"sub": supporter_id, "role": role, "iat": int(time.time())},
            SUP_SECRET,
            algorithm="HS256",
        )

    db = get_db()
    now = int(time.time())
    try:
        if invite_token:
            inv = db.execute(
                "SELECT * FROM supporter_invites WHERE token = ? AND accepted_at IS NULL",
                (invite_token,),
            ).fetchone()
            if not inv or now > inv["expires_at"]:
                return RedirectResponse("/supporter?error=invite_expired")

            # Check if a supporter account already exists for this email
            existing = db.execute(
                "SELECT id, role FROM supporter_accounts WHERE email = ?", (email,)
            ).fetchone()
            if existing:
                supporter_id = existing["id"]
                role = existing["role"]
            else:
                supporter_id = str(uuid.uuid4())
                role = inv["role"]
                db.execute(
                    "INSERT INTO supporter_accounts "
                    "(id, name, email, role, invited_by, created_at) VALUES (?,?,?,?,?,?)",
                    (supporter_id, name, email, role, inv["invited_by"], now),
                )

            db.execute(
                "UPDATE supporter_invites SET accepted_at = ? WHERE token = ?",
                (now, invite_token),
            )
            db.commit()
            _log(supporter_id, "login:google:invite")
        else:
            row = db.execute(
                "SELECT id, role, revoked_at, expires_at FROM supporter_accounts WHERE email = ?",
                (email,),
            ).fetchone()
            if not row:
                return RedirectResponse("/supporter?error=no_account")
            if row["revoked_at"]:
                return RedirectResponse("/supporter?error=revoked")
            if row["expires_at"] and now > row["expires_at"]:
                return RedirectResponse("/supporter?error=expired")

            supporter_id = row["id"]
            role = row["role"]
            _log(supporter_id, "login:google")

        db.execute(
            "UPDATE supporter_accounts SET last_active_at = ? WHERE id = ?",
            (now, supporter_id),
        )
        db.commit()
    finally:
        db.close()

    token = _supporter_jwt(supporter_id, role)
    redirect = RedirectResponse("/supporter")
    redirect.set_cookie(
        key=SUP_COOKIE,
        value=token,
        httponly=True,
        secure=SUP_IS_PROD,
        samesite="strict",
        max_age=SESSION_TTL,
        path="/",
    )
    return redirect


# ── Password login (backup — Google is primary) ───────────────────────────────

class PasswordLoginBody(BaseModel):
    email: str
    password: str


@router.post("/password-login")
def password_login(body: PasswordLoginBody, response: Response):
    email = body.email.strip().lower()
    db = get_db()
    try:
        user   = db.execute("SELECT id, name FROM users WHERE email = ?", (email,)).fetchone()
        pw_row = None
        if user:
            pw_row = db.execute(
                "SELECT password_hash FROM user_passwords WHERE user_id = ?", (user["id"],)
            ).fetchone()

        dummy   = b"$2b$12$invalidhashfortimingprotectiononly000000000000000000000"
        candidate = pw_row["password_hash"].encode() if pw_row else dummy
        matched = bcrypt.checkpw(body.password.encode(), candidate)

        if matched and pw_row and user:
            redirect_response = Response()
            _set_cookie(redirect_response, _issue_jwt(user["id"], user["name"]))
            return {"status": "authenticated", "profile": {"id": user["id"], "name": user["name"], "email": email}}

        raise HTTPException(401, "Email or password is incorrect.")
    finally:
        db.close()


# ── Set password (Settings flow) ──────────────────────────────────────────────

@router.post("/request-set-password")
def request_set_password(current: dict = Depends(get_current_user)):
    user_id = current["sub"]
    db = get_db()
    try:
        user = db.execute("SELECT name, email FROM users WHERE id = ?", (user_id,)).fetchone()
        if not user:
            raise HTTPException(404, "User not found.")
        token = secrets.token_urlsafe(32)
        now   = int(time.time())
        db.execute(
            "INSERT INTO password_set_tokens (id, user_id, token, expires_at, created_at) "
            "VALUES (?, ?, ?, ?, ?)",
            (str(uuid.uuid4()), user_id, token, now + PW_SET_TTL, now),
        )
        db.commit()
        send_password_set_email(to=user["email"], name=user["name"], token=token)
        return {"status": "sent"}
    finally:
        db.close()


class SetPasswordBody(BaseModel):
    token: str
    password: str


@router.post("/set-password")
def set_password(body: SetPasswordBody):
    if len(body.password) < 12:
        raise HTTPException(400, "Password must be at least 12 characters.")
    db = get_db()
    try:
        row = db.execute(
            "SELECT * FROM password_set_tokens WHERE token = ?", (body.token,)
        ).fetchone()
        if not row or row["used_at"] is not None:
            raise HTTPException(400, "This link is invalid or has already been used.")
        if int(time.time()) > row["expires_at"]:
            raise HTTPException(400, "This link has expired. Please request a new one.")

        pw_hash = bcrypt.hashpw(body.password.encode(), bcrypt.gensalt()).decode()
        db.execute(
            "UPDATE password_set_tokens SET used_at = ? WHERE token = ?",
            (int(time.time()), body.token),
        )
        db.execute(
            """
            INSERT INTO user_passwords (user_id, password_hash, created_at)
            VALUES (?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
                password_hash = excluded.password_hash,
                created_at    = excluded.created_at
            """,
            (row["user_id"], pw_hash, int(time.time())),
        )
        db.commit()
        return {"status": "ok"}
    finally:
        db.close()
