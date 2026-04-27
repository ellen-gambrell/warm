# Backlog: Daily Menu

**Status:** Not started — blocked on Supporter Portal
**Priority:** Medium — quality of life for Margaret; reduces food waste; requested by family caregiver
**Source:** Sister-in-law (primary caregiver, updates menu nightly)
**Depends on:** `backlog-supporter-portal.md` — the menu editor is a supporter feature, not a standalone passphrase flow

---

## Problem

Margaret cannot see into the pantry or most of the fridge due to her mobility limitations. She forgets when told verbally what's available. Food goes to waste because she doesn't know it's there. She needs a persistent, always-visible answer to "what can I eat right now?"

---

## What to build

Two surfaces:

### 1. Menu view — Margaret's experience (`/menu`)

A beautiful, easy-to-read daily menu she can pull up any time. Organized into sections. Large text. Feels like a real menu, not a spreadsheet.

**Sections (configurable, defaults):**
- 🍳 Breakfast
- 🥡 Leftovers
- 🥨 Snacks
- 🍪 Sweets
- 🥤 Drinks

**Design requirements:**
- Touch targets ≥ 64px per item
- Section headers are large and visually distinct
- Empty sections are hidden (don't show "Snacks — nothing listed")
- Show "Last updated [time]" at the top so Margaret knows it's current
- Read-only — no edit controls visible to Margaret
- Home screen tile: add "🍽️ Menu" to `Home.tsx` shortcuts grid

### 2. Menu editor — sister-in-law's experience (`/menu/edit`)

A fast, phone-friendly editing interface she can use in a few minutes each evening.

**Requirements:**
- Protected by a simple shared passphrase (no full account login required — she doesn't have an account)
- Add items to any section (free-text, one item per line or one at a time)
- Remove individual items with a single tap (large ✕ button)
- Clear an entire section with one tap
- "Publish" saves and timestamps the menu
- Works well on iPhone in the kitchen at the end of the day

---

## Data model

```sql
-- One row per menu item
CREATE TABLE menu_items (
    id          TEXT PRIMARY KEY,
    section     TEXT NOT NULL,       -- 'breakfast' | 'leftovers' | 'snacks' | 'sweets' | 'drinks'
    name        TEXT NOT NULL,
    sort_order  INTEGER DEFAULT 0,
    created_at  TEXT DEFAULT (datetime('now')),
    updated_at  TEXT DEFAULT (datetime('now'))
);

-- Tracks last publish time and editor passphrase hash
CREATE TABLE menu_meta (
    id              TEXT PRIMARY KEY DEFAULT 'singleton',
    last_published  TEXT,
    passphrase_hash TEXT    -- bcrypt hash of the editor passphrase
);
```

---

## API routes

```
GET  /api/menu              → { sections: [{name, label, emoji, items: [{id, name}]}], last_published }
POST /api/menu/edit/auth    → verify passphrase → set editor cookie (short-lived, 8hr)
GET  /api/menu/edit         → return current items for editing (requires editor cookie)
POST /api/menu/edit/item    → add item { section, name }
DELETE /api/menu/edit/item/{id} → remove item
DELETE /api/menu/edit/section/{section} → clear section
POST /api/menu/edit/publish → save + update last_published timestamp
```

The editor passphrase is set once by the app owner (in `.env` as `MENU_EDITOR_PASSPHRASE`). The backend bcrypt-hashes it on first use and stores it in `menu_meta`.

Margaret's `/api/menu` read endpoint requires her normal session cookie (standard `Depends(get_current_user)`).

---

## Files to create / touch

**Backend:**
- `backend/app/menu.py` — new router with all menu routes
- `backend/app/main.py` — register `menu_router`
- `backend/app/database.py` — add `menu_items` and `menu_meta` table creation to `init_db()`

**Frontend:**
- `frontend/src/components/MenuView.tsx` — Margaret's read-only menu
- `frontend/src/components/MenuEditor.tsx` — sister-in-law's edit interface
- `frontend/src/components/Home.tsx` — add menu tile to shortcuts grid
- `frontend/src/App.tsx` — add `/menu` and `/menu/edit` routes

---

## Design notes

**MenuView aesthetic direction:**
- Off-white or warm cream background (or use `--color-surface` with warm tint)
- Section headers: large, serif-feel weight, with the emoji left-aligned
- Items: clean list, good line-height, easy to scan
- Subtle divider lines between sections
- "Last updated" in small muted text at the top (e.g. "Updated this evening at 9:14 PM")
- If nothing is on the menu yet: a friendly empty state ("Nothing on the menu yet — check back soon.")

**MenuEditor UX:**
- Full-screen per section, swipe or tab to navigate sections
- OR single scrolling page with all sections (simpler, probably better)
- Each item has a large red ✕ at 64px tap target
- Text input at the bottom of each section: type item name → tap Add
- "Publish" button is prominent and at the bottom — big, green, satisfying to tap
- After publish: "Menu updated! Margaret can see it now." confirmation

---

## Open questions

- [ ] Should the editor passphrase be set via `.env` only, or should there be a first-run setup flow in the app?
- [ ] Does sister-in-law want to add items from a predefined list (autocomplete from history) or always free-text?
- [ ] Should Margaret be able to mark an item as "eaten" (to trigger a remove)? Or is the menu purely managed by the editor?
- [ ] Sections fixed or configurable? (Start fixed, add section management later if needed)
- [ ] Should the menu show on the home screen as a preview card ("Today: leftovers, snacks available") or just a tile?

---

## Out of scope for V1

- Push notifications when menu is updated
- Photo of each dish
- Quantities / portion notes
- Integration with grocery list or recipes
- AI suggestions based on what's available
