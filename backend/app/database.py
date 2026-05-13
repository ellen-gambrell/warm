import os
import sqlite3

# Stored two levels up from backend/app/ → project root warm.db
DB_PATH = os.path.join(os.path.dirname(__file__), '..', '..', 'warm.db')


def get_db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


def init_db() -> None:
    conn = get_db()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id         TEXT PRIMARY KEY,
            name       TEXT NOT NULL,
            email      TEXT UNIQUE,
            created_at TEXT DEFAULT (datetime('now'))
        );

        -- Legacy WebAuthn credentials table (kept for safe migration)
        CREATE TABLE IF NOT EXISTS credentials (
            id         TEXT PRIMARY KEY,
            user_id    TEXT NOT NULL REFERENCES users(id),
            public_key BLOB NOT NULL,
            sign_count INTEGER NOT NULL DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now'))
        );

        -- Optional bcrypt passwords per user
        CREATE TABLE IF NOT EXISTS user_passwords (
            user_id       TEXT PRIMARY KEY REFERENCES users(id),
            password_hash TEXT NOT NULL,
            created_at    INTEGER NOT NULL
        );

        -- One-time tokens used to set/change a password from Settings
        CREATE TABLE IF NOT EXISTS password_set_tokens (
            id         TEXT PRIMARY KEY,
            user_id    TEXT NOT NULL REFERENCES users(id),
            token      TEXT UNIQUE NOT NULL,
            expires_at INTEGER NOT NULL,
            used_at    INTEGER,
            created_at INTEGER NOT NULL
        );

        -- Rolling log of failed password-login attempts (rate limiting)
        CREATE TABLE IF NOT EXISTS login_attempts (
            id           TEXT PRIMARY KEY,
            email        TEXT NOT NULL,
            attempt_time INTEGER NOT NULL
        );

        -- Third-party service connections (Google OAuth, Venmo username, etc.)
        CREATE TABLE IF NOT EXISTS connections (
            id            TEXT PRIMARY KEY,
            user_id       TEXT NOT NULL REFERENCES users(id),
            provider      TEXT NOT NULL,
            access_token  TEXT,
            refresh_token TEXT,
            scopes        TEXT,
            expires_at    INTEGER,
            data          TEXT,
            created_at    TEXT DEFAULT (datetime('now')),
            updated_at    TEXT DEFAULT (datetime('now')),
            UNIQUE(user_id, provider)
        );

        -- Check Run: monthly bill template (rows Margaret tracks each month)
        CREATE TABLE IF NOT EXISTS checkrun_bills (
            id              TEXT PRIMARY KEY,
            sort_order      INTEGER DEFAULT 0,
            section         TEXT NOT NULL DEFAULT 'bills',  -- 'bills' | 'income'
            name            TEXT NOT NULL,
            description     TEXT,
            payment_method  TEXT,
            expected_amount REAL,
            due_day         INTEGER,    -- day of month; NULL = no fixed day
            comment         TEXT,
            merchant_pattern TEXT,      -- case-insensitive substring match against MM merchant
            active          INTEGER NOT NULL DEFAULT 1,
            created_at      TEXT DEFAULT (datetime('now')),
            user_id         TEXT
        );

        -- Check Run: Monarch Money transaction cache (pushed by local sync)
        CREATE TABLE IF NOT EXISTS checkrun_transactions (
            id          TEXT PRIMARY KEY,
            date        TEXT NOT NULL,
            amount      REAL NOT NULL,
            merchant    TEXT,
            account     TEXT,
            category    TEXT,
            is_pending  INTEGER NOT NULL DEFAULT 0,
            synced_at   TEXT DEFAULT (datetime('now')),
            user_id     TEXT
        );

        -- Check Run: manual cleared/uncleared overrides per bill per month
        -- user_id scopes overrides per user; bill_ids are UUIDs so (bill_id,year,month) is already unique per user
        CREATE TABLE IF NOT EXISTS checkrun_overrides (
            bill_id  TEXT NOT NULL,
            year     INTEGER NOT NULL,
            month    INTEGER NOT NULL,
            cleared  INTEGER NOT NULL,
            user_id  TEXT,
            PRIMARY KEY (bill_id, year, month)
        );

        -- Short-lived CSRF state tokens for OAuth flows
        CREATE TABLE IF NOT EXISTS oauth_states (
            id         TEXT PRIMARY KEY,
            user_id    TEXT NOT NULL,
            state      TEXT UNIQUE NOT NULL,
            provider   TEXT NOT NULL,
            scopes     TEXT NOT NULL,
            expires_at INTEGER NOT NULL
        );

        -- ── Supporter portal ──────────────────────────────────────────────

        CREATE TABLE IF NOT EXISTS supporter_accounts (
            id             TEXT PRIMARY KEY,
            name           TEXT NOT NULL,
            email          TEXT NOT NULL UNIQUE,
            role           TEXT NOT NULL,
            invited_by     TEXT,              -- supporter_account id or 'margaret'
            expires_at     INTEGER,           -- null = permanent; unix ts for respite
            created_at     INTEGER NOT NULL,
            last_active_at INTEGER,
            revoked_at     INTEGER,
            revoked_by     TEXT               -- who revoked it
        );

        CREATE TABLE IF NOT EXISTS supporter_invites (
            id          TEXT PRIMARY KEY,
            email       TEXT NOT NULL,
            role        TEXT NOT NULL,
            invited_by  TEXT NOT NULL,        -- supporter_account id or 'margaret'
            token       TEXT NOT NULL UNIQUE,
            expires_at  INTEGER NOT NULL,     -- invite link expires in 7 days
            accepted_at INTEGER
        );

        CREATE TABLE IF NOT EXISTS supporter_access_log (
            id           TEXT PRIMARY KEY,
            supporter_id TEXT NOT NULL,
            action       TEXT NOT NULL,       -- 'login' | 'view:menu' | 'edit:menu' | etc.
            timestamp    INTEGER NOT NULL
        );

        -- ── Daily menu ────────────────────────────────────────────────────

        CREATE TABLE IF NOT EXISTS menu_items (
            id         TEXT PRIMARY KEY,
            section    TEXT NOT NULL,         -- 'breakfast'|'leftovers'|'snacks'|'sweets'|'drinks'
            name       TEXT NOT NULL,
            sort_order INTEGER DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now')),
            user_id    TEXT
        );

        CREATE TABLE IF NOT EXISTS menu_meta (
            id              TEXT PRIMARY KEY DEFAULT 'singleton',
            last_published  TEXT,
            user_id         TEXT
        );

        -- ── Usage metrics ─────────────────────────────────────────────────────

        CREATE TABLE IF NOT EXISTS daily_message_counts (
            date  TEXT PRIMARY KEY,   -- 'YYYY-MM-DD'
            count INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS user_visit_counts (
            id              TEXT PRIMARY KEY,
            user_id         TEXT NOT NULL REFERENCES users(id),
            feature         TEXT NOT NULL,
            visit_count     INTEGER NOT NULL DEFAULT 0,
            last_visited_at TEXT,
            UNIQUE(user_id, feature)
        );

        -- ── Reminders ─────────────────────────────────────────────────────────

        CREATE TABLE IF NOT EXISTS reminders (
            id               TEXT PRIMARY KEY,
            user_id          TEXT NOT NULL REFERENCES users(id),
            label            TEXT NOT NULL,
            interval_minutes INTEGER NOT NULL DEFAULT 120,
            enabled          INTEGER NOT NULL DEFAULT 1,
            created_at       INTEGER NOT NULL
        );

        -- ── Primary auth OAuth state (replaces in-memory _oauth_states dict) ──
        -- Shared across uvicorn workers via DB — no in-process state.

        CREATE TABLE IF NOT EXISTS auth_states (
            state      TEXT PRIMARY KEY,
            portal     TEXT NOT NULL DEFAULT 'primary',
            invite     TEXT,
            expires_at INTEGER NOT NULL
        );

        -- ── Custom AI Cards ───────────────────────────────────────────────────

        CREATE TABLE IF NOT EXISTS subscriptions (
            id         TEXT PRIMARY KEY,
            user_id    TEXT NOT NULL REFERENCES users(id) UNIQUE,
            status     TEXT NOT NULL DEFAULT 'active',  -- 'active' | 'inactive' | 'trial'
            created_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS custom_cards (
            id              TEXT PRIMARY KEY,
            user_id         TEXT NOT NULL REFERENCES users(id),
            prompt          TEXT NOT NULL,
            tile_name       TEXT NOT NULL,        -- derived by Gemini from prompt
            schedule        TEXT NOT NULL,        -- 'daily' | 'weekly' | 'monthly' | 'annually'
            visibility      TEXT NOT NULL DEFAULT 'private',  -- 'private' | 'supporter_view'
            last_result     TEXT,
            last_run_at     INTEGER,
            next_run_at     INTEGER,
            created_at      INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_custom_cards_user      ON custom_cards(user_id);
        CREATE INDEX IF NOT EXISTS idx_custom_cards_next_run  ON custom_cards(next_run_at);
        -- ── Access requests ───────────────────────────────────────────────────

        CREATE TABLE IF NOT EXISTS user_requests (
            id           TEXT PRIMARY KEY,
            name         TEXT NOT NULL,
            email        TEXT NOT NULL UNIQUE,
            requested_at INTEGER NOT NULL,
            status       TEXT NOT NULL DEFAULT 'pending',
            reviewed_at  INTEGER,
            reviewed_by  TEXT
        );

        -- ── Event log ─────────────────────────────────────────────────────────

        CREATE TABLE IF NOT EXISTS user_events (
            id         TEXT PRIMARY KEY,
            user_id    TEXT NOT NULL,
            actor_type TEXT NOT NULL DEFAULT 'user',
            event      TEXT NOT NULL,
            meta       TEXT,
            ts         INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_user_events_user  ON user_events(user_id, ts);
        CREATE INDEX IF NOT EXISTS idx_user_events_event ON user_events(event, ts);
    """)
    conn.commit()

    # Migration: drop dead magic-link tables (replaced by Google OAuth)
    for dead_table in ("magic_link_tokens", "supporter_magic_tokens"):
        try:
            conn.execute(f"DROP TABLE IF EXISTS {dead_table}")
            conn.commit()
        except Exception:
            pass

    # Migrate: add email column to pre-existing users tables
    try:
        conn.execute("ALTER TABLE users ADD COLUMN email TEXT")
        conn.commit()
    except Exception:
        pass  # Column already exists

    # Migrate: add role column to users
    try:
        conn.execute("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'")
        conn.commit()
    except Exception:
        pass  # Column already exists

    # Migrate: add input_profile column to users
    try:
        conn.execute("ALTER TABLE users ADD COLUMN input_profile TEXT NOT NULL DEFAULT 'stylus'")
        conn.commit()
    except Exception:
        pass  # Column already exists

    # Migrate: add user_id to shared tables (multi-user isolation)
    for tbl in ("checkrun_bills", "checkrun_transactions", "checkrun_overrides",
                "menu_items", "menu_meta"):
        try:
            conn.execute(f"ALTER TABLE {tbl} ADD COLUMN user_id TEXT")
            conn.commit()
        except Exception:
            pass  # Column already exists

    # Back-fill: assign existing rows to the first (primary) user
    first_user = conn.execute("SELECT id FROM users ORDER BY rowid LIMIT 1").fetchone()
    if first_user:
        uid = first_user["id"]
        for tbl in ("checkrun_bills", "checkrun_transactions", "checkrun_overrides",
                    "menu_items", "menu_meta"):
            conn.execute(
                f"UPDATE {tbl} SET user_id = ? WHERE user_id IS NULL", (uid,)
            )
        conn.commit()

    # Seed: ensure all existing users have a subscription row (active)
    existing_users = conn.execute("SELECT id FROM users").fetchall()
    now_ts = int(__import__('time').time())
    for u in existing_users:
        conn.execute(
            "INSERT OR IGNORE INTO subscriptions (id, user_id, status, created_at) "
            "VALUES (lower(hex(randomblob(16))), ?, 'active', ?)",
            (u["id"], now_ts),
        )
    conn.commit()

    # Migrate: add bills table
    conn.execute("""
        CREATE TABLE IF NOT EXISTS bills (
            id                TEXT PRIMARY KEY,
            user_id           TEXT NOT NULL REFERENCES users(id),
            category          TEXT NOT NULL DEFAULT 'other',
            company_name      TEXT NOT NULL,
            phone_number      TEXT,
            customer_number   TEXT,
            sender_email      TEXT,
            last_bill_seen_at TEXT,
            created_at        TEXT DEFAULT (datetime('now')),
            updated_at        TEXT DEFAULT (datetime('now'))
        )
    """)
    conn.execute("CREATE INDEX IF NOT EXISTS idx_bills_user ON bills(user_id)")
    conn.commit()

    # Seed: ensure ellengambrell@gmail.com exists as admin (idempotent)
    # INSERT OR IGNORE creates the row if absent; UPDATE promotes if somehow demoted.
    # The UPDATE-only approach was a bug — it silently no-ops if the row doesn't exist yet.
    conn.execute("""
        INSERT OR IGNORE INTO users (id, name, email, role)
        VALUES (lower(hex(randomblob(16))), 'Ellen', 'ellengambrell@gmail.com', 'admin')
    """)
    conn.execute("""
        UPDATE users SET role = 'admin'
        WHERE email = 'ellengambrell@gmail.com'
    """)
    conn.commit()

    conn.close()
