"""
Third-party service connections: Google (Gmail + Drive) OAuth2, Venmo username.

Google OAuth flow:
  1. GET  /api/connections/google/start?service=gmail|drive  →  {"url": "<google oauth url>"}
  2. Frontend does window.location.href = url
  3. Google redirects to GET /api/connections/google/callback?code=&state=
  4. Backend exchanges code, stores tokens, redirects to frontend /settings?connected=<service>

Venmo (no public OAuth API):
  PUT  /api/connections/venmo   {"username": "@you"}   → stores username
  GET  /api/connections/venmo                          → {"username": "@you" | null}

Status:
  GET  /api/connections/status  →  {"gmail": bool, "drive": bool, "venmo": bool}

Disconnect:
  DELETE /api/connections/<provider>
"""

import json
import logging
import os
import secrets
import time
import urllib.parse
import urllib.request
import uuid

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
from pydantic import BaseModel

from .auth import get_current_user
from .database import get_db

router = APIRouter()

_log = logging.getLogger(__name__)

# ── Token encryption ───────────────────────────────────────────────────────────
# Tokens (OAuth access/refresh, Monarch session) are encrypted with Fernet
# symmetric encryption before storage. Set TOKEN_ENCRYPTION_KEY in .env to a
# 32-byte URL-safe base64 key (generate with: python -c "from cryptography.fernet
# import Fernet; print(Fernet.generate_key().decode())").
#
# If the env var is absent (local dev), tokens are stored plaintext with a warning.
# Decrypt is forward-compatible: tries Fernet first, falls back to plaintext so
# existing rows work before a migration re-encrypts them.

_fernet = None

def _get_fernet():
    global _fernet
    if _fernet is not None:
        return _fernet
    key = os.getenv("TOKEN_ENCRYPTION_KEY", "")
    if not key:
        _log.warning(
            "TOKEN_ENCRYPTION_KEY is not set — OAuth tokens stored in plaintext. "
            "Set this env var in production."
        )
        return None
    try:
        from cryptography.fernet import Fernet
        _fernet = Fernet(key.encode())
        return _fernet
    except Exception as exc:
        _log.error("Invalid TOKEN_ENCRYPTION_KEY: %s — tokens stored in plaintext.", exc)
        return None


def _encrypt(value: str | None) -> str | None:
    if value is None:
        return None
    f = _get_fernet()
    if f is None:
        return value
    return f.encrypt(value.encode()).decode()


def _decrypt(value: str | None) -> str | None:
    if value is None:
        return None
    f = _get_fernet()
    if f is None:
        return value
    try:
        return f.decrypt(value.encode()).decode()
    except Exception:
        # Value is plaintext (pre-encryption migration) — return as-is
        return value


# ── Token helper ───────────────────────────────────────────────────────────────

def get_google_access_token(user_id: str, provider: str) -> str:
    """Return a valid access token, refreshing if expired. Raises 403 if not connected."""
    db = get_db()
    row = db.execute(
        "SELECT access_token, refresh_token, expires_at FROM connections WHERE user_id = ? AND provider = ?",
        (user_id, provider)
    ).fetchone()
    db.close()
    if not row:
        raise HTTPException(status_code=403, detail=f"{provider} not connected")
    access_token  = _decrypt(row["access_token"])
    refresh_token = _decrypt(row["refresh_token"])
    # Return existing token if still valid (60s buffer)
    if row["expires_at"] and int(time.time()) < row["expires_at"] - 60:
        return access_token
    # Refresh
    if not refresh_token:
        raise HTTPException(status_code=403, detail=f"{provider} token expired — please reconnect in Settings")
    cfg = _google_cfg()
    payload = urllib.parse.urlencode({
        "client_id": cfg["client_id"],
        "client_secret": cfg["client_secret"],
        "refresh_token": refresh_token,
        "grant_type": "refresh_token",
    }).encode()
    req = urllib.request.Request("https://oauth2.googleapis.com/token", data=payload, method="POST")
    with urllib.request.urlopen(req) as resp:
        tokens = json.loads(resp.read())
    new_token = tokens["access_token"]
    new_expires = int(time.time()) + tokens.get("expires_in", 3600)
    db = get_db()
    db.execute(
        "UPDATE connections SET access_token=?, expires_at=?, updated_at=datetime('now') WHERE user_id=? AND provider=?",
        (_encrypt(new_token), new_expires, user_id, provider)
    )
    db.commit()
    db.close()
    return new_token


# ── Google OAuth config ────────────────────────────────────────────────────────

GOOGLE_SCOPES = {
    # gmail.send added for Reply / Reply All — existing gmail.readonly tokens
    # will need to be reconnected in Settings to pick up the new scope.
    "gmail": (
        "https://www.googleapis.com/auth/gmail.readonly "
        "https://www.googleapis.com/auth/gmail.send"
    ),
    "drive": "https://www.googleapis.com/auth/drive.readonly",
}


def _google_cfg():
    return {
        "client_id":     os.getenv("GOOGLE_CLIENT_ID", ""),
        "client_secret": os.getenv("GOOGLE_CLIENT_SECRET", ""),
        "redirect_uri":  os.getenv(
            "GOOGLE_AUTH_REDIRECT_URI",
            "http://localhost:8000/api/connections/google/callback",
        ),
        "frontend_url":  os.getenv("MAGIC_LINK_BASE_URL", "http://localhost:5173"),
    }


# ── Status ─────────────────────────────────────────────────────────────────────

@router.get("/api/connections/status")
def get_status(user: dict = Depends(get_current_user)):
    db = get_db()
    rows = db.execute(
        "SELECT provider FROM connections WHERE user_id = ?", (user["sub"],)
    ).fetchall()
    db.close()
    connected = {row["provider"] for row in rows}
    return {
        "gmail":    "gmail"    in connected,
        "drive":    "drive"    in connected,
        "venmo":    "venmo"    in connected,
        "monarch":  "monarch"  in connected,
    }


# ── Google: start OAuth ────────────────────────────────────────────────────────

@router.get("/api/connections/google/start")
def google_start(service: str, user: dict = Depends(get_current_user)):
    cfg = _google_cfg()
    if not cfg["client_id"]:
        raise HTTPException(status_code=500, detail="Google OAuth not configured. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to backend/.env")
    if service not in GOOGLE_SCOPES:
        raise HTTPException(status_code=400, detail=f"Unknown service '{service}'. Use 'gmail' or 'drive'.")

    state = secrets.token_urlsafe(32)
    db = get_db()
    db.execute(
        "INSERT INTO oauth_states (id, user_id, state, provider, scopes, expires_at) VALUES (?, ?, ?, ?, ?, ?)",
        (str(uuid.uuid4()), user["sub"], state, service, GOOGLE_SCOPES[service], int(time.time()) + 600),
    )
    db.commit()
    db.close()

    params = {
        "client_id":     cfg["client_id"],
        "redirect_uri":  cfg["redirect_uri"],
        "response_type": "code",
        "scope":         GOOGLE_SCOPES[service],
        "state":         state,
        "access_type":   "offline",
        "prompt":        "consent",
    }
    url = "https://accounts.google.com/o/oauth2/v2/auth?" + urllib.parse.urlencode(params)
    return {"url": url}


# ── Google: OAuth callback ─────────────────────────────────────────────────────

@router.get("/api/connections/google/callback")
def google_callback(
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
):
    cfg = _google_cfg()
    frontend_url = cfg["frontend_url"]

    if error or not code or not state:
        return RedirectResponse(f"{frontend_url}/settings?error=google_denied")

    db = get_db()

    # Validate CSRF state
    row = db.execute(
        "SELECT * FROM oauth_states WHERE state = ? AND expires_at > ?",
        (state, int(time.time())),
    ).fetchone()
    if not row:
        db.close()
        return RedirectResponse(f"{frontend_url}/settings?error=google_state_invalid")

    user_id  = row["user_id"]
    provider = row["provider"]
    db.execute("DELETE FROM oauth_states WHERE state = ?", (state,))

    # Exchange auth code for tokens
    token_payload = urllib.parse.urlencode({
        "code":          code,
        "client_id":     cfg["client_id"],
        "client_secret": cfg["client_secret"],
        "redirect_uri":  cfg["redirect_uri"],
        "grant_type":    "authorization_code",
    }).encode()

    try:
        req = urllib.request.Request(
            "https://oauth2.googleapis.com/token",
            data=token_payload,
            method="POST",
        )
        with urllib.request.urlopen(req) as resp:
            tokens = json.loads(resp.read())
    except Exception:
        db.close()
        return RedirectResponse(f"{frontend_url}/settings?error=google_token_failed")

    expires_at = int(time.time()) + tokens.get("expires_in", 3600)

    db.execute(
        """
        INSERT INTO connections (id, user_id, provider, access_token, refresh_token, scopes, expires_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id, provider) DO UPDATE SET
            access_token  = excluded.access_token,
            refresh_token = COALESCE(excluded.refresh_token, refresh_token),
            scopes        = excluded.scopes,
            expires_at    = excluded.expires_at,
            updated_at    = datetime('now')
        """,
        (
            str(uuid.uuid4()), user_id, provider,
            _encrypt(tokens.get("access_token")), _encrypt(tokens.get("refresh_token")),
            tokens.get("scope"), expires_at,
        ),
    )
    db.commit()
    db.close()

    return RedirectResponse(f"{frontend_url}/settings?connected={provider}")


# ── Disconnect any provider ────────────────────────────────────────────────────

@router.delete("/api/connections/{provider}")
def disconnect(provider: str, user: dict = Depends(get_current_user)):
    db = get_db()
    db.execute(
        "DELETE FROM connections WHERE user_id = ? AND provider = ?",
        (user["sub"], provider),
    )
    db.commit()
    db.close()
    return {"status": "disconnected"}


# ── Venmo: store username ──────────────────────────────────────────────────────

class VenmoBody(BaseModel):
    username: str


@router.put("/api/connections/venmo")
def connect_venmo(body: VenmoBody, user: dict = Depends(get_current_user)):
    username = body.username.strip()
    if not username:
        raise HTTPException(status_code=400, detail="Venmo username is required")

    db = get_db()
    db.execute(
        """
        INSERT INTO connections (id, user_id, provider, data)
        VALUES (?, ?, 'venmo', ?)
        ON CONFLICT(user_id, provider) DO UPDATE SET
            data       = excluded.data,
            updated_at = datetime('now')
        """,
        (str(uuid.uuid4()), user["sub"], json.dumps({"username": username})),
    )
    db.commit()
    db.close()
    return {"status": "connected", "username": username}


@router.get("/api/connections/venmo")
def get_venmo(user: dict = Depends(get_current_user)):
    db = get_db()
    row = db.execute(
        "SELECT data FROM connections WHERE user_id = ? AND provider = 'venmo'",
        (user["sub"],),
    ).fetchone()
    db.close()
    if not row:
        return {"username": None}
    data = json.loads(row["data"] or "{}")
    return {"username": data.get("username")}


# ── Monarch Money ──────────────────────────────────────────────────────────────────

class MonarchBody(BaseModel):
    email: str
    password: str
    totp_code: str | None = None   # optional 6-digit OTP if account has 2FA


@router.post("/api/connections/monarch/connect")
async def connect_monarch(body: MonarchBody, user: dict = Depends(get_current_user)):
    """
    Authenticate with Monarch Money, store the session token.
    Password is never persisted — only the session token.
    """
    try:
        from monarchmoney import MonarchMoney, RequireMFAException
    except ImportError:
        raise HTTPException(status_code=500, detail="monarchmoney library not installed on server")

    mm = MonarchMoney()
    email = body.email.strip()
    try:
        if body.totp_code and body.totp_code.strip():
            # User provided a 6-digit OTP — use the dedicated MFA method
            await mm.multi_factor_authenticate(
                email=email,
                password=body.password,
                code=body.totp_code.strip(),
            )
        else:
            # No OTP — attempt normal login; raises RequireMFAException if 2FA is on
            await mm.login(
                email=email,
                password=body.password,
                use_saved_session=False,
                save_session=False,
            )
    except RequireMFAException:
        # Signal the frontend to reveal the OTP field and retry
        raise HTTPException(
            status_code=400,
            detail=(
                "Your Monarch Money account has two-factor authentication enabled. "
                "Enter the 6-digit code from your authenticator app to continue."
            ),
        )
    except Exception as e:
        err = str(e).lower()
        if "invalid" in err or "credentials" in err or "password" in err or "401" in err:
            raise HTTPException(status_code=401, detail="Incorrect email or password.")
        if "429" in err or "too many" in err:
            raise HTTPException(status_code=429, detail="Monarch Money is rate-limiting login attempts. Wait a few minutes and try again.")
        raise HTTPException(status_code=502, detail="Could not connect to Monarch Money. Please check your credentials and try again.")

    session_token = mm.token
    if not session_token:
        raise HTTPException(status_code=502, detail="Monarch Money returned no session token.")

    db = get_db()
    db.execute(
        """
        INSERT INTO connections (id, user_id, provider, access_token, data)
        VALUES (?, ?, 'monarch', ?, ?)
        ON CONFLICT(user_id, provider) DO UPDATE SET
            access_token = excluded.access_token,
            data         = excluded.data,
            updated_at   = datetime('now')
        """,
        (str(uuid.uuid4()), user["sub"], _encrypt(session_token),
         json.dumps({"email": body.email.strip()})),
    )
    db.commit()
    db.close()
    return {"status": "connected", "email": body.email.strip()}


@router.get("/api/connections/monarch")
def get_monarch(user: dict = Depends(get_current_user)):
    """Return the stored Monarch Money email (display only)."""
    db = get_db()
    row = db.execute(
        "SELECT data FROM connections WHERE user_id = ? AND provider = 'monarch'",
        (user["sub"],),
    ).fetchone()
    db.close()
    if not row:
        return {"email": None}
    data = json.loads(row["data"] or "{}")
    return {"email": data.get("email")}


def get_monarch_session(user_id: str) -> str:
    """
    Return the stored Monarch Money session token.
    Raises HTTP 403 if not connected, or 401 with a reconnect prompt if expired.
    Call this from Check Run routes that need live Monarch data.
    """
    db = get_db()
    row = db.execute(
        "SELECT access_token FROM connections WHERE user_id = ? AND provider = 'monarch'",
        (user_id,),
    ).fetchone()
    db.close()
    if not row or not row["access_token"]:
        raise HTTPException(
            status_code=403,
            detail="Monarch Money not connected — go to Settings to connect.",
        )
    return _decrypt(row["access_token"])
