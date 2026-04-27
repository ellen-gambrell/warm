"""
Daily menu feature.

Margaret's read-only view (her session):
  GET  /api/menu

Supporter edit endpoints (supporter session, roles: key_contact / family_secondary / homemaker):
  GET  /api/supporter/menu
  POST /api/supporter/menu/item           → add item {section, name}
  DELETE /api/supporter/menu/item/{id}    → remove item
  DELETE /api/supporter/menu/section/{section} → clear section
  POST /api/supporter/menu/publish        → update last_published timestamp
"""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from .auth import get_current_user
from .database import get_db
from .supporter_auth import get_current_supporter, _log

router = APIRouter()

# ── Section metadata ────────────────────────────────────────────────────────────

SECTIONS = [
    {"key": "breakfast",  "label": "Breakfast",  "emoji": "🍳"},
    {"key": "leftovers",  "label": "Leftovers",  "emoji": "🥡"},
    {"key": "snacks",     "label": "Snacks",      "emoji": "🥨"},
    {"key": "sweets",     "label": "Sweets",      "emoji": "🍪"},
    {"key": "drinks",     "label": "Drinks",      "emoji": "🥤"},
]
VALID_SECTIONS = {s["key"] for s in SECTIONS}
EDIT_ROLES = {"key_contact", "family_secondary", "homemaker"}


# ── Shared data helper ─────────────────────────────────────────────────────────

def _build_menu() -> dict:
    db = get_db()
    rows = db.execute(
        "SELECT id, section, name FROM menu_items ORDER BY sort_order ASC, created_at ASC"
    ).fetchall()
    meta = db.execute("SELECT last_published FROM menu_meta WHERE id = 'singleton'").fetchone()
    db.close()

    items_by_section: dict[str, list] = {s["key"]: [] for s in SECTIONS}
    for r in rows:
        if r["section"] in items_by_section:
            items_by_section[r["section"]].append({"id": r["id"], "name": r["name"]})

    sections = [
        {
            "key": s["key"],
            "label": s["label"],
            "emoji": s["emoji"],
            "items": items_by_section[s["key"]],
        }
        for s in SECTIONS
        if items_by_section[s["key"]]  # hide empty sections
    ]

    last_published = meta["last_published"] if meta else None
    return {"sections": sections, "last_published": last_published}


# ── Margaret's read-only endpoint ─────────────────────────────────────────────

@router.get("/api/menu")
def get_menu(_user: dict = Depends(get_current_user)):
    return _build_menu()


# ── Supporter read endpoint ────────────────────────────────────────────────────

@router.get("/api/supporter/menu")
def get_menu_supporter(supporter: dict = Depends(get_current_supporter)):
    _log(supporter["id"], "view:menu")
    return _build_menu()


# ── Supporter edit endpoints ────────────────────────────────────────────────────

def _check_edit_permission(supporter: dict) -> None:
    if supporter["role"] not in EDIT_ROLES:
        raise HTTPException(status_code=403, detail="Your role does not permit editing the menu.")


class AddItemBody(BaseModel):
    section: str
    name: str


@router.post("/api/supporter/menu/item")
def add_item(body: AddItemBody, supporter: dict = Depends(get_current_supporter)):
    _check_edit_permission(supporter)

    section = body.section.strip().lower()
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Item name cannot be empty.")
    if section not in VALID_SECTIONS:
        raise HTTPException(status_code=400, detail=f"Unknown section: {section}")

    item_id = str(uuid.uuid4())
    db = get_db()
    db.execute(
        "INSERT INTO menu_items (id, section, name) VALUES (?, ?, ?)",
        (item_id, section, name),
    )
    db.commit()
    db.close()

    _log(supporter["id"], f"edit:menu:add:{section}")
    return {"id": item_id, "section": section, "name": name}


@router.delete("/api/supporter/menu/item/{item_id}")
def remove_item(item_id: str, supporter: dict = Depends(get_current_supporter)):
    _check_edit_permission(supporter)

    db = get_db()
    row = db.execute("SELECT id FROM menu_items WHERE id = ?", (item_id,)).fetchone()
    if not row:
        db.close()
        raise HTTPException(status_code=404, detail="Item not found.")
    db.execute("DELETE FROM menu_items WHERE id = ?", (item_id,))
    db.commit()
    db.close()

    _log(supporter["id"], "edit:menu:remove")
    return {"status": "deleted"}


@router.delete("/api/supporter/menu/section/{section}")
def clear_section(section: str, supporter: dict = Depends(get_current_supporter)):
    _check_edit_permission(supporter)

    if section not in VALID_SECTIONS:
        raise HTTPException(status_code=400, detail=f"Unknown section: {section}")

    db = get_db()
    db.execute("DELETE FROM menu_items WHERE section = ?", (section,))
    db.commit()
    db.close()

    _log(supporter["id"], f"edit:menu:clear:{section}")
    return {"status": "cleared"}


@router.post("/api/supporter/menu/publish")
def publish_menu(supporter: dict = Depends(get_current_supporter)):
    _check_edit_permission(supporter)

    now_iso = datetime.now(timezone.utc).isoformat()
    db = get_db()
    db.execute(
        "INSERT INTO menu_meta (id, last_published) VALUES ('singleton', ?) "
        "ON CONFLICT(id) DO UPDATE SET last_published = excluded.last_published",
        (now_iso,),
    )
    db.commit()
    db.close()

    _log(supporter["id"], "edit:menu:publish")
    return {"status": "published", "last_published": now_iso}
