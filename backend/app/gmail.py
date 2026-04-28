"""
Gmail integration routes.

GET  /api/gmail/messages                        → list inbox (max 20)
GET  /api/gmail/messages/{message_id}           → full message with decoded body
POST /api/gmail/messages/{message_id}/synopsis  → AI plain-language summary
POST /api/gmail/messages/{message_id}/reply     → send a reply (or reply-all)
"""

import base64
import email.mime.text
import json
import os
import re
import urllib.error
import urllib.parse
import urllib.request
from email.utils import parseaddr, getaddresses
from html import unescape

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from .auth import get_current_user
from .connections import get_google_access_token

router = APIRouter()

GMAIL_BASE = "https://gmail.googleapis.com/gmail/v1/users/me/"

GMAIL_SYNOPSIS_PROMPT = (
    "You are helping someone with a physical disability read an email. "
    "Provide a clear plain-language summary. Include: who sent it and what it's about, "
    "the most important information (amounts, dates, deadlines, links), "
    "any action required, and the tone (friendly/urgent/official/promotional). "
    "Be concise. Use short sentences."
)


def _gmail_get(path: str, token: str) -> dict:
    """Make an authenticated GET request to the Gmail API."""
    url = GMAIL_BASE + path
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as exc:
        raise HTTPException(status_code=exc.code, detail="Gmail request failed. Please re-connect your account in Settings.")


def _decode_b64url(data: str) -> str:
    padded = data + "=" * (4 - len(data) % 4)
    return base64.urlsafe_b64decode(padded).decode("utf-8", errors="replace")


def _strip_html(html: str) -> str:
    """Very lightweight HTML → plain text conversion."""
    text = re.sub(r"<br\s*/?>", "\n", html, flags=re.IGNORECASE)
    text = re.sub(r"<p[^>]*>", "\n", text, flags=re.IGNORECASE)
    text = re.sub(r"</p>", "\n", text, flags=re.IGNORECASE)
    text = re.sub(r"<[^>]+>", "", text)
    text = re.sub(r"&nbsp;", " ", text)
    text = re.sub(r"&amp;", "&", text)
    text = re.sub(r"&lt;", "<", text)
    text = re.sub(r"&gt;", ">", text)
    text = re.sub(r"&quot;", '"', text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _extract_body(payload: dict) -> str:
    """Recursively extract text/plain body from a Gmail message payload."""
    mime = payload.get("mimeType", "")
    parts = payload.get("parts", [])
    body_data = payload.get("body", {}).get("data", "")

    if mime == "text/plain" and body_data:
        return _decode_b64url(body_data)

    if mime == "text/html" and body_data and not parts:
        return _strip_html(_decode_b64url(body_data))

    # Prefer text/plain among multipart children
    plain_parts = [p for p in parts if p.get("mimeType") == "text/plain"]
    if plain_parts:
        data = plain_parts[0].get("body", {}).get("data", "")
        if data:
            return _decode_b64url(data)

    # Recurse into nested multipart
    for part in parts:
        result = _extract_body(part)
        if result:
            return result

    # Fall back to HTML if no plain text found
    html_parts = [p for p in parts if p.get("mimeType") == "text/html"]
    if html_parts:
        data = html_parts[0].get("body", {}).get("data", "")
        if data:
            return _strip_html(_decode_b64url(data))

    # Last resort: decode whatever body data exists
    if body_data:
        return _decode_b64url(body_data)

    return ""


def _header(headers: list, name: str) -> str:
    for h in headers:
        if h.get("name", "").lower() == name.lower():
            return h.get("value", "")
    return ""


def _has_attachment(payload: dict) -> bool:
    """Return True if any part of the message payload is a non-empty attachment."""
    filename = payload.get("filename", "")
    size = payload.get("body", {}).get("size", 0)
    if filename and size and size > 0:
        return True
    for part in payload.get("parts", []):
        if _has_attachment(part):
            return True
    return False


# ── Routes ─────────────────────────────────────────────────────────────────────

@router.get("/api/gmail/messages")
def list_messages(user: dict = Depends(get_current_user)):
    token = get_google_access_token(user["sub"], "gmail")

    # Get list of message IDs
    list_data = _gmail_get(
        "messages?" + urllib.parse.urlencode({
            "maxResults": 20,
            "labelIds": "INBOX",
        }),
        token,
    )

    messages = list_data.get("messages", [])
    result = []

    for msg in messages:
        msg_id = msg["id"]
        # format=full with fields restriction: headers + part structure only,
        # no body/data so the response stays lean while giving us attachment info.
        fields = (
            "id,threadId,labelIds,snippet,"
            "payload(headers(name,value),mimeType,"
            "parts(filename,mimeType,body(size),"
            "parts(filename,mimeType,body(size),"
            "parts(filename,mimeType,body(size)))))"
        )
        detail = _gmail_get(
            f"messages/{msg_id}?format=full&fields={urllib.parse.quote(fields)}",
            token,
        )
        payload = detail.get("payload", {})
        headers = payload.get("headers", [])
        label_ids = detail.get("labelIds", [])
        result.append({
            "id": msg_id,
            "threadId": detail.get("threadId", ""),
            "from": _header(headers, "From"),
            "subject": _header(headers, "Subject"),
            "date": _header(headers, "Date"),
            "snippet": unescape(detail.get("snippet", "")),
            "unread": "UNREAD" in label_ids,
            "hasAttachment": _has_attachment(payload),
        })

    return result


@router.get("/api/gmail/messages/{message_id}")
def get_message(message_id: str, user: dict = Depends(get_current_user)):
    token = get_google_access_token(user["sub"], "gmail")

    detail = _gmail_get(f"messages/{message_id}?format=full", token)
    payload = detail.get("payload", {})
    headers = payload.get("headers", [])
    label_ids = detail.get("labelIds", [])

    body = _extract_body(payload)

    return {
        "id": message_id,
        "from": _header(headers, "From"),
        "to": _header(headers, "To"),
        "subject": _header(headers, "Subject"),
        "date": _header(headers, "Date"),
        "snippet": detail.get("snippet", ""),
        "body": body,
        "unread": "UNREAD" in label_ids,
    }


@router.post("/api/gmail/messages/{message_id}/synopsis")
def message_synopsis(message_id: str, user: dict = Depends(get_current_user)):
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="Gemini API key not configured")

    token = get_google_access_token(user["sub"], "gmail")
    detail = _gmail_get(f"messages/{message_id}?format=full", token)
    payload = detail.get("payload", {})
    headers = payload.get("headers", [])

    from_addr = _header(headers, "From")
    subject = _header(headers, "Subject")
    body = _extract_body(payload)

    email_text = f"From: {from_addr}\nSubject: {subject}\n\n{body}"

    try:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[
                types.Part.from_text(text=GMAIL_SYNOPSIS_PROMPT),
                types.Part.from_text(text=email_text),
            ],
        )
        return {
            "synopsis": response.text,
            "subject": subject,
            "from": from_addr,
        }
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Could not generate a summary for this email.")


# ── Reply / Reply All ──────────────────────────────────────────────────────────

class ReplyBody(BaseModel):
    body: str
    reply_all: bool = False


@router.post("/api/gmail/messages/{message_id}/reply")
def reply_to_message(
    message_id: str,
    payload: ReplyBody,
    user: dict = Depends(get_current_user),
):
    """
    Send a reply to an email thread.
    reply_all=False: replies to sender only.
    reply_all=True:  replies to all recipients, excluding the user's own address.
    """
    token = get_google_access_token(user["sub"], "gmail")

    # Fetch the original message headers (metadata only — no body needed)
    detail = _gmail_get(
        f"messages/{message_id}?format=metadata"
        "&metadataHeaders=From"
        "&metadataHeaders=To"
        "&metadataHeaders=Cc"
        "&metadataHeaders=Subject"
        "&metadataHeaders=Message-ID"
        "&metadataHeaders=References",
        token,
    )
    orig_headers = detail.get("payload", {}).get("headers", [])
    thread_id    = detail.get("threadId", "")

    orig_from       = _header(orig_headers, "From")
    orig_to         = _header(orig_headers, "To")
    orig_cc         = _header(orig_headers, "Cc")
    orig_subject    = _header(orig_headers, "Subject")
    orig_message_id = _header(orig_headers, "Message-ID") or _header(orig_headers, "Message-Id")
    orig_references = _header(orig_headers, "References")

    # Build the To: field
    _, sender_email = parseaddr(orig_from)

    if payload.reply_all:
        # Collect all addresses, strip the user's own
        from .database import get_db
        db = get_db()
        user_row = db.execute("SELECT email FROM users WHERE id = ?", (user["sub"],)).fetchone()
        db.close()
        user_email = (user_row["email"] or "").lower() if user_row else ""

        all_addresses = getaddresses(
            [a for a in [orig_from, orig_to, orig_cc] if a]
        )
        to_addrs = [
            f"{name} <{addr}>" if name else addr
            for name, addr in all_addresses
            if addr and addr.lower() != user_email
        ]
        to_str = ", ".join(to_addrs) if to_addrs else sender_email
    else:
        to_str = orig_from or sender_email

    # Build Re: subject (avoid stacking "Re: Re:")
    subject = orig_subject if orig_subject.lower().startswith("re:") else f"Re: {orig_subject}"

    # Build References header for threading
    references = orig_references or ""
    if orig_message_id:
        references = f"{references} {orig_message_id}".strip()

    # Construct MIME message
    mime_msg = email.mime.text.MIMEText(payload.body, "plain", "utf-8")
    mime_msg["To"]      = to_str
    mime_msg["Subject"] = subject
    if orig_message_id:
        mime_msg["In-Reply-To"] = orig_message_id
    if references:
        mime_msg["References"] = references

    raw = base64.urlsafe_b64encode(mime_msg.as_bytes()).decode("utf-8")

    # Send via Gmail API
    send_data = json.dumps({"raw": raw, "threadId": thread_id}).encode()
    req = urllib.request.Request(
        "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
        data=send_data,
        method="POST",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req) as resp:
            result = json.loads(resp.read())
    except urllib.error.HTTPError as exc:
        if exc.code == 403:
            raise HTTPException(
                status_code=403,
                detail="Gmail send permission not granted. Please reconnect Gmail in Settings.",
            )
        raise HTTPException(status_code=502, detail="Could not send the reply. Please try again.")

    return {"status": "sent", "id": result.get("id", "")}
