"""
Email delivery via AWS SES.

Replaces the previous SMTP/GreenGeeks integration. The SMTP code silently
dropped emails when any required env var was missing or misnamed (a real
issue we hit: `SMTP_PASs` typo caused all warm.care emails to fall through
to dev-mode stderr prints in production). This module is designed so silent
failure cannot happen:

  - At import time, if AWS_ACCESS_KEY_ID is missing, we log a loud WARNING.
  - On every send, success and failure are logged explicitly to stderr.
  - In dev (no creds), emails print to stderr with an UNMISSABLE banner.

External API (`send_magic_link_email`, `send_password_set_email`,
`send_supporter_invite_email`) is unchanged — callers don't move.
"""

import os
import sys
from typing import Optional

AWS_ACCESS_KEY_ID = os.environ.get("AWS_ACCESS_KEY_ID", "")
AWS_SECRET_ACCESS_KEY = os.environ.get("AWS_SECRET_ACCESS_KEY", "")
AWS_REGION = os.environ.get("AWS_REGION", "us-east-1")
EMAIL_FROM = os.environ.get("EMAIL_FROM", "warm.care <hello@warm.care>")
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "ellengambrell@gmail.com")

# Loud startup signal — caught the silent-fail regression we hit before.
if not AWS_ACCESS_KEY_ID:
    print(
        "[email_service] WARNING: AWS_ACCESS_KEY_ID not set — emails will "
        "NOT be delivered (dev mode: printed to stderr instead).",
        file=sys.stderr,
        flush=True,
    )

_ses_client = None


def _get_client():
    """Lazy boto3 client. Returns None when creds aren't configured."""
    global _ses_client
    if _ses_client is not None:
        return _ses_client
    if not AWS_ACCESS_KEY_ID:
        return None
    import boto3
    _ses_client = boto3.client(
        "ses",
        region_name=AWS_REGION,
        aws_access_key_id=AWS_ACCESS_KEY_ID,
        aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
    )
    return _ses_client


def _send(to: str, subject: str, body: str) -> None:
    client = _get_client()
    if client is None:
        # Loud dev fallback. Never silent.
        bar = "=" * 60
        print(f"\n{bar}", file=sys.stderr)
        print(f"[EMAIL NOT SENT — no AWS creds]", file=sys.stderr)
        print(f"  To:      {to}", file=sys.stderr)
        print(f"  Subject: {subject}", file=sys.stderr)
        print(f"  Body:\n{body.strip()}", file=sys.stderr)
        print(f"{bar}\n", file=sys.stderr, flush=True)
        return

    try:
        response = client.send_email(
            Source=EMAIL_FROM,
            Destination={"ToAddresses": [to]},
            Message={
                "Subject": {"Data": subject, "Charset": "UTF-8"},
                "Body": {"Text": {"Data": body, "Charset": "UTF-8"}},
            },
        )
        msg_id = response.get("MessageId", "?")
        print(f"[email_service] SES sent to={to} subject={subject!r} id={msg_id}",
              file=sys.stderr, flush=True)
    except Exception as e:
        print(f"[email_service] SES FAILED to={to} subject={subject!r} err={e}",
              file=sys.stderr, flush=True)
        raise


def send_magic_link_email(to: str, name: str, link: str) -> None:
    """Still used for the set-password flow in Settings."""
    _send(
        to=to,
        subject="Your warm.care sign-in link",
        body=f"""Hi {name},

Click the link below to sign in to warm.care:

{link}

This link expires in 15 minutes and can only be used once.

If you didn't request this, you can safely ignore this email.

— warm.care
""",
    )


def send_password_set_email(to: str, name: str, token: str) -> None:
    base_url = os.getenv("MAGIC_LINK_BASE_URL", "http://localhost:5173")
    link = f"{base_url}/settings/set-password?token={token}"
    _send(
        to=to,
        subject="Set your warm.care password",
        body=f"""Hi {name},

You requested to set a password for your warm.care account.
Click the link below (expires in 1 hour):

{link}

If you didn't request this, you can safely ignore this email.

— warm.care
""",
    )


def send_access_request_email(name: str, email: str) -> None:
    _send(
        to=ADMIN_EMAIL,
        subject="New access request — warm.care",
        body=(
            f"{name} ({email}) has requested access to warm.care. "
            "Log in to review it at https://warm.care/admin.\n\n— warm.care\n"
        ),
    )


def send_welcome_email(to: str, name: str) -> None:
    _send(
        to=to,
        subject="You have been approved — warm.care",
        body=(
            f"Hi {name},\n\n"
            "Your access to warm.care has been approved.\n\n"
            "Log in at https://warm.care\n\n— warm.care\n"
        ),
    )


def send_denial_email(to: str, name: str) -> None:
    _send(
        to=to,
        subject="Your warm.care access request",
        body=(
            f"Hi {name},\n\n"
            "We weren't able to approve your request for access to warm.care. "
            "If you think this is a mistake, reach out to the account holder directly.\n\n"
            "— warm.care\n"
        ),
    )


def send_supporter_invite_email(to: str, role_label: str, link: str) -> None:
    _send(
        to=to,
        subject="You've been invited to warm.care",
        body=f"""Hi,

Margaret has invited you to join her warm.care supporter network as {role_label}.

Click the link below to accept your invitation:

{link}

This invitation expires in 7 days.

— warm.care
""",
    )
