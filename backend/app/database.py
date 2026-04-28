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
            created_at      TEXT DEFAULT (datetime('now'))
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
            synced_at   TEXT DEFAULT (datetime('now'))
        );

        -- Check Run: manual cleared/uncleared overrides per bill per month
        CREATE TABLE IF NOT EXISTS checkrun_overrides (
            bill_id  TEXT NOT NULL,
            year     INTEGER NOT NULL,
            month    INTEGER NOT NULL,
            cleared  INTEGER NOT NULL,
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
            updated_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS menu_meta (
            id              TEXT PRIMARY KEY DEFAULT 'singleton',
            last_published  TEXT
        );
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

    conn.close()
