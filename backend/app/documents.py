import os
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException

from .auth import get_current_user

router = APIRouter()

SYNOPSIS_PROMPT = (
    "You are helping someone with a physical disability read a document they received. "
    "Please provide a clear, plain-language summary. Include:\n"
    "- What type of document this is (e.g. 'This is a water bill from the City of Springfield')\n"
    "- The most important facts: amounts due, due dates, account numbers, contact info\n"
    "- Any deadlines or urgent action required\n"
    "- What the person needs to do next, if anything\n\n"
    "Be concise. Use short sentences. Avoid jargon. "
    "This person may have difficulty reading small print."
)

ALLOWED_TYPES = (
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/webp",
    "image/heic",
    "image/heif",
)

MAX_BYTES = 20 * 1024 * 1024  # 20 MB


@router.post("/api/documents/synopsis")
async def get_synopsis(file: UploadFile = File(...), _user: dict = Depends(get_current_user)):
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="Gemini API key not configured")

    content_type = (file.content_type or "").split(";")[0].strip()
    if content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Only PDF and image files are supported",
        )

    content = await file.read()
    if len(content) > MAX_BYTES:
        raise HTTPException(status_code=400, detail="File too large (max 20 MB)")

    try:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[
                types.Part.from_bytes(data=content, mime_type=content_type),
                SYNOPSIS_PROMPT,
            ],
        )
        return {
            "synopsis": response.text,
            "filename": file.filename or "Document",
        }
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Could not generate a summary for this document.",
        )
