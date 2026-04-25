import json
import os
import time
import uuid
from typing import Optional

import jwt as pyjwt
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel
from webauthn import (
    generate_authentication_options,
    generate_registration_options,
    options_to_json,
    verify_authentication_response,
    verify_registration_response,
)
from webauthn.helpers import (
    parse_authentication_credential_json,
    parse_registration_credential_json,
)
from webauthn.helpers.structs import (
    AuthenticatorSelectionCriteria,
    PublicKeyCredentialDescriptor,
    ResidentKeyRequirement,
    UserVerificationRequirement,
)

from .database import get_db

RP_ID   = os.environ.get("RP_ID",   "localhost")
ORIGIN  = os.environ.get("ORIGIN",  "http://localhost:5173")
JWT_SECRET  = os.environ.get("JWT_SECRET", "dev-secret-change-in-production")
JWT_EXPIRY  = 30 * 24 * 3600  # 30 days

# Temporary in-memory challenge storage {key: {challenge, user_id, name, expires}}
_pending: dict[str, dict] = {}
CHALLENGE_TTL = 300  # 5 minutes

router  = APIRouter(prefix="/api/auth")
_bearer = HTTPBearer(auto_error=False)


def _issue_jwt(user_id: str, name: str) -> str:
    return pyjwt.encode(
        {"sub": user_id, "name": name, "exp": int(time.time()) + JWT_EXPIRY},
        JWT_SECRET,
        algorithm="HS256",
    )


def get_current_user(
    creds: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
) -> dict:
    if not creds:
        raise HTTPException(401, "Not authenticated")
    try:
        return pyjwt.decode(creds.credentials, JWT_SECRET, algorithms=["HS256"])
    except pyjwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired")
    except pyjwt.InvalidTokenError:
        raise HTTPException(401, "Invalid token")


# ---------------------------------------------------------------------------
# Status
# ---------------------------------------------------------------------------

@router.get("/status")
def auth_status():
    db = get_db()
    count = db.execute("SELECT COUNT(*) FROM users").fetchone()[0]
    db.close()
    return {"registered": count > 0}


# ---------------------------------------------------------------------------
# Registration
# ---------------------------------------------------------------------------

class RegisterBeginBody(BaseModel):
    name: str


@router.post("/register/begin")
def register_begin(body: RegisterBeginBody):
    user_id = str(uuid.uuid4())
    opts = generate_registration_options(
        rp_id=RP_ID,
        rp_name="Warm Care",
        user_id=user_id.encode(),
        user_name=body.name,
        user_display_name=body.name,
        authenticator_selection=AuthenticatorSelectionCriteria(
            user_verification=UserVerificationRequirement.REQUIRED,
            resident_key=ResidentKeyRequirement.PREFERRED,
        ),
    )
    key = str(uuid.uuid4())
    _pending[key] = {
        "challenge": opts.challenge,
        "user_id": user_id,
        "name": body.name,
        "expires": time.time() + CHALLENGE_TTL,
    }
    return {"challengeKey": key, "options": json.loads(options_to_json(opts))}


class CompleteBody(BaseModel):
    challenge_key: str
    credential: dict


@router.post("/register/complete")
def register_complete(body: CompleteBody):
    entry = _pending.pop(body.challenge_key, None)
    if not entry or time.time() > entry["expires"]:
        raise HTTPException(400, "Challenge expired")

    try:
        verified = verify_registration_response(
            credential=parse_registration_credential_json(json.dumps(body.credential)),
            expected_challenge=entry["challenge"],
            expected_rp_id=RP_ID,
            expected_origin=ORIGIN,
            require_user_verification=True,
        )
    except Exception as exc:
        raise HTTPException(400, f"Verification failed: {exc}")

    db = get_db()
    db.execute(
        "INSERT INTO users (id, name) VALUES (?, ?)",
        (entry["user_id"], entry["name"]),
    )
    db.execute(
        "INSERT INTO credentials (id, user_id, public_key, sign_count) VALUES (?, ?, ?, ?)",
        (
            verified.credential_id.hex(),
            entry["user_id"],
            verified.credential_public_key,
            verified.sign_count,
        ),
    )
    db.commit()
    db.close()

    return {"token": _issue_jwt(entry["user_id"], entry["name"]), "name": entry["name"]}


# ---------------------------------------------------------------------------
# Authentication
# ---------------------------------------------------------------------------

@router.post("/login/begin")
def login_begin():
    db = get_db()
    rows = db.execute("SELECT id FROM credentials").fetchall()
    db.close()
    if not rows:
        raise HTTPException(404, "No credentials registered")

    allow = [PublicKeyCredentialDescriptor(id=bytes.fromhex(r["id"])) for r in rows]
    opts = generate_authentication_options(
        rp_id=RP_ID,
        allow_credentials=allow,
        user_verification=UserVerificationRequirement.REQUIRED,
    )
    key = str(uuid.uuid4())
    _pending[key] = {"challenge": opts.challenge, "expires": time.time() + CHALLENGE_TTL}
    return {"challengeKey": key, "options": json.loads(options_to_json(opts))}


@router.post("/login/complete")
def login_complete(body: CompleteBody):
    entry = _pending.pop(body.challenge_key, None)
    if not entry or time.time() > entry["expires"]:
        raise HTTPException(400, "Challenge expired")

    # Decode credential id (base64url → hex) to look up stored public key
    import base64
    raw_id: str = body.credential.get("id", "")
    try:
        cred_id_hex = base64.urlsafe_b64decode(raw_id + "=" * (-len(raw_id) % 4)).hex()
    except Exception:
        raise HTTPException(400, "Invalid credential id")

    db = get_db()
    row = db.execute(
        "SELECT c.*, u.name FROM credentials c JOIN users u ON c.user_id = u.id WHERE c.id = ?",
        (cred_id_hex,),
    ).fetchone()
    db.close()
    if not row:
        raise HTTPException(400, "Credential not found")

    try:
        verified = verify_authentication_response(
            credential=parse_authentication_credential_json(json.dumps(body.credential)),
            expected_challenge=entry["challenge"],
            expected_rp_id=RP_ID,
            expected_origin=ORIGIN,
            credential_public_key=row["public_key"],
            credential_current_sign_count=row["sign_count"],
            require_user_verification=True,
        )
    except Exception as exc:
        raise HTTPException(400, f"Verification failed: {exc}")

    db = get_db()
    db.execute(
        "UPDATE credentials SET sign_count = ? WHERE id = ?",
        (verified.new_sign_count, cred_id_hex),
    )
    db.commit()
    db.close()

    return {"token": _issue_jwt(row["user_id"], row["name"]), "name": row["name"]}
