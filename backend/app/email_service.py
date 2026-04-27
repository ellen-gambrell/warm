"""
Email delivery via GreenGeeks SMTP (port 465, implicit SSL).

In dev (SMTP_HOST not configured), emails are printed to stderr instead.
"""

import os
import smtplib
import sys
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

SMTP_HOST = os.environ.get("SMTP_HOST", "")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "465"))
SMTP_USER = os.environ.get("SMTP_USER", "")
SMTP_PASS = os.environ.get("SMTP_PASS", "")
SMTP_FROM = os.environ.get("SMTP_FROM", "") or SMTP_USER


def _send(to: str, subject: str, body: str) -> None:
    if not SMTP_HOST or not SMTP_USER or not SMTP_PASS:
        bar = "=" * 60
        print(f"\n{bar}", file=sys.stderr)
        print(f"[DEV EMAIL]  To: {to}", file=sys.stderr)
        print(f"[DEV EMAIL]  Subject: {subject}", file=sys.stderr)
        print(f"[DEV EMAIL]  Body:\n{body.strip()}", file=sys.stderr)
        print(f"{bar}\n", file=sys.stderr, flush=True)
        return

    msg = MIMEMultipart()
    msg["Subject"] = subject
    msg["From"]    = SMTP_FROM
    msg["To"]      = to
    msg.attach(MIMEText(body, "plain"))

    # Port 465 = implicit SSL; anything else = STARTTLS
    if SMTP_PORT == 465:
        with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT) as s:
            s.login(SMTP_USER, SMTP_PASS)
            s.sendmail(SMTP_FROM, to, msg.as_string())
    else:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as s:
            s.ehlo()
            s.starttls()
            s.login(SMTP_USER, SMTP_PASS)
            s.sendmail(SMTP_FROM, to, msg.as_string())


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
