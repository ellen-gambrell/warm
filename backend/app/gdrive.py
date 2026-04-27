"""
Google Drive integration routes.

GET  /api/drive/files                   → list recent Drive files (PDFs, images, Docs, Sheets, Slides)
POST /api/drive/files/{file_id}/synopsis → AI plain-language summary of file content
"""

import json
import os
import urllib.error
import urllib.parse
import urllib.request

from fastapi import APIRouter, Depends, HTTPException

from .auth import get_current_user
from .connections import get_google_access_token
from .documents import SYNOPSIS_PROMPT

router = APIRouter()

DRIVE_BASE = "https://www.googleapis.com/drive/v3/"

# Google Workspace MIME types that must be exported rather than downloaded directly
GOOGLE_EXPORT_TYPES = {
    "application/vnd.google-apps.document": "application/pdf",
    "application/vnd.google-apps.spreadsheet": "application/pdf",
    "application/vnd.google-apps.presentation": "application/pdf",
}


def _drive_get(path: str, token: str) -> dict:
    """Make an authenticated GET request to the Drive API."""
    url = DRIVE_BASE + path
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as exc:
        raise HTTPException(status_code=exc.code, detail="Google Drive request failed. Please re-connect your account in Settings.")


def _drive_download(url: str, token: str) -> bytes:
    """Download binary content from a Drive URL."""
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.read()
    except urllib.error.HTTPError as exc:
        raise HTTPException(status_code=exc.code, detail="Could not download this file from Google Drive.")


# ── Routes ─────────────────────────────────────────────────────────────────────

@router.get("/api/drive/files")
def list_files(user: dict = Depends(get_current_user)):
    token = get_google_access_token(user["sub"], "drive")

    query = (
        "trashed=false and ("
        "mimeType='application/pdf' or "
        "mimeType contains 'image/' or "
        "mimeType='application/vnd.google-apps.document' or "
        "mimeType='application/vnd.google-apps.spreadsheet' or "
        "mimeType='application/vnd.google-apps.presentation'"
        ")"
    )

    params = urllib.parse.urlencode({
        "q": query,
        "orderBy": "modifiedTime desc",
        "pageSize": 30,
        "fields": "files(id,name,mimeType,modifiedTime,size,webViewLink)",
    })

    data = _drive_get(f"files?{params}", token)
    return {"files": data.get("files", [])}


@router.post("/api/drive/files/{file_id}/synopsis")
def file_synopsis(file_id: str, user: dict = Depends(get_current_user)):
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="Gemini API key not configured")

    token = get_google_access_token(user["sub"], "drive")

    # Get file metadata
    metadata = _drive_get(
        f"files/{file_id}?" + urllib.parse.urlencode({
            "fields": "id,name,mimeType,webViewLink",
        }),
        token,
    )
    mime_type = metadata.get("mimeType", "")
    filename = metadata.get("name", "Document")

    # Determine download URL and effective MIME type
    if mime_type in GOOGLE_EXPORT_TYPES:
        export_mime = GOOGLE_EXPORT_TYPES[mime_type]
        download_url = (
            f"https://www.googleapis.com/drive/v3/files/{file_id}/export?"
            + urllib.parse.urlencode({"mimeType": export_mime})
        )
        effective_mime = export_mime
    else:
        download_url = f"https://www.googleapis.com/drive/v3/files/{file_id}?alt=media"
        effective_mime = mime_type

    content = _drive_download(download_url, token)

    if len(content) > 20 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 20 MB)")

    try:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[
                types.Part.from_bytes(data=content, mime_type=effective_mime),
                SYNOPSIS_PROMPT,
            ],
        )
        return {
            "synopsis": response.text,
            "filename": filename,
        }
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Could not generate a summary for this document.")
