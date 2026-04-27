"""
GIF search via Tenor v2 API.

GET /api/gif/search?q=<query>&limit=20
  Returns: { results: [{id, title, url, preview}], configured: bool }
"""

import os
import urllib.parse
import urllib.request
import json

from fastapi import APIRouter, Depends

from .auth import get_current_user

gif_router = APIRouter()

LIMIT_MAX = 50


@gif_router.get("/api/gif/search")
def gif_search(q: str = "", limit: int = 20, _user: dict = Depends(get_current_user)):
    limit = min(limit, LIMIT_MAX)   # cap — never send more than 50
    api_key = os.getenv("TENOR_API_KEY")
    if not api_key:
        return {"results": [], "configured": False}

    try:
        if q.strip():
            url = (
                "https://tenor.googleapis.com/v2/search?"
                + urllib.parse.urlencode({"q": q, "key": api_key, "limit": limit, "media_filter": "gif"})
            )
        else:
            url = (
                "https://tenor.googleapis.com/v2/featured?"
                + urllib.parse.urlencode({"key": api_key, "limit": limit, "media_filter": "gif"})
            )

        with urllib.request.urlopen(url) as resp:
            data = json.loads(resp.read())

        results = []
        for result in data.get("results", []):
            formats = result.get("media_formats", {})
            gif_fmt = formats.get("gif", {})
            tiny_fmt = formats.get("tinygif", {})
            results.append({
                "id": result.get("id"),
                "title": result.get("title", ""),
                "url": gif_fmt.get("url", ""),
                "preview": tiny_fmt.get("url", ""),
            })

        return {"results": results, "configured": True}
    except Exception:
        return {"results": [], "configured": True}
