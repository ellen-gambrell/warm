import sys, os

_APP_ROOT = os.path.dirname(os.path.abspath(__file__))
_HOME = os.path.expanduser("~")
_rel_path = os.path.relpath(_APP_ROOT, _HOME)
venv_path = os.path.join(_HOME, "virtualenv", _rel_path, "3.11", "lib", "python3.11", "site-packages")
if os.path.isdir(venv_path) and venv_path not in sys.path:
    sys.path.insert(0, venv_path)

sys.path.insert(0, _APP_ROOT)
sys.path.insert(0, os.path.join(_APP_ROOT, "backend"))

PUBLIC_DIR = os.path.join(_HOME, "public_html", "warm.care")

CONTENT_TYPES = {
    "html": "text/html", "js": "application/javascript",
    "css": "text/css", "svg": "image/svg+xml",
    "png": "image/png", "jpg": "image/jpeg", "ico": "image/x-icon",
    "json": "application/json", "woff2": "font/woff2", "woff": "font/woff",
    "ttf": "font/ttf", "txt": "text/plain", "webmanifest": "application/manifest+json",
}

API_PREFIXES = ("/api/",)

_middleware = None


def _get_middleware():
    global _middleware
    if _middleware is None:
        from dotenv import load_dotenv
        load_dotenv(os.path.join(_APP_ROOT, ".env"))
        from backend.app.main import app as fastapi_app
        from a2wsgi import ASGIMiddleware
        _middleware = ASGIMiddleware(fastapi_app)
    return _middleware


def _serve_static(filepath, start_response):
    ext = filepath.rsplit(".", 1)[-1] if "." in filepath else ""
    content_type = CONTENT_TYPES.get(ext, "application/octet-stream")
    with open(filepath, "rb") as f:
        content = f.read()
    start_response("200 OK", [
        ("Content-Type", content_type),
        ("Content-Length", str(len(content))),
    ])
    return [content]


def application(environ, start_response):
    path = environ.get("PATH_INFO", "/")

    if path.startswith(API_PREFIXES):
        return _get_middleware()(environ, start_response)

    rel_path = path.lstrip("/") or "index.html"
    filepath = os.path.join(PUBLIC_DIR, rel_path)

    if os.path.isfile(filepath):
        return _serve_static(filepath, start_response)

    index_path = os.path.join(PUBLIC_DIR, "index.html")
    if os.path.isfile(index_path):
        return _serve_static(index_path, start_response)

    start_response("404 Not Found", [("Content-Type", "text/plain")])
    return [b"Not Found"]
