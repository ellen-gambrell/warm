import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request as StarletteRequest
from dotenv import load_dotenv

# Explicitly load backend/.env so it works regardless of cwd
_here = Path(__file__).parent.parent  # backend/
load_dotenv(_here / ".env", override=True)

from .database import init_db
from .auth import router as auth_router

# Run at import time so Passenger's WSGI adapter (which doesn't fire ASGI
# lifespan events) still initialises the database on first load.
init_db()
from .documents import router as documents_router
from .connections import router as connections_router
from .gmail import router as gmail_router
from .gdrive import router as gdrive_router
from .chat import chat_router
from .gif import gif_router
from .checkrun import router as checkrun_router
from .supporter_auth import router as supporter_router
from .menu import router as menu_router
from .monarch import router as monarch_router
from .reminders import router as reminders_router
from .admin import router as admin_router
from .custom_cards import router as cards_router
from .bills import router as bills_router


_IS_PROD = os.environ.get("ENVIRONMENT", "").lower() in ("production", "prod")


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add security response headers to every API response."""

    # microphone=() is intentionally absent — Web Speech API requires it.
    _CSP = (
        "default-src 'self'; "
        "script-src 'self'; "
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data: https://media.tenor.com https://c.tenor.com; "
        "connect-src 'self' https://generativelanguage.googleapis.com; "
        "frame-ancestors 'none';"
    )

    async def dispatch(self, request: StarletteRequest, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), camera=()"
        response.headers["Content-Security-Policy"] = self._CSP
        if _IS_PROD:
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"
        return response


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    yield


app = FastAPI(title="warm.care API", docs_url=None, redoc_url=None, lifespan=lifespan)

app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://warm.care", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "Cookie"],
)

app.include_router(auth_router)
app.include_router(documents_router)
app.include_router(connections_router)
app.include_router(gmail_router)
app.include_router(gdrive_router)
app.include_router(chat_router)
app.include_router(gif_router)
app.include_router(checkrun_router)
app.include_router(supporter_router)
app.include_router(menu_router)
app.include_router(monarch_router)
app.include_router(reminders_router)
app.include_router(admin_router)
app.include_router(cards_router)
app.include_router(bills_router)


@app.get("/api/health")
def health():
    return {"status": "ok"}
