-- 初期スキーマ (Cloudflare D1)
CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    is_admin INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS chat_profiles (
    id TEXT PRIMARY KEY,
    target TEXT NOT NULL,
    target_type TEXT NOT NULL DEFAULT 'web' CHECK (target_type IN ('web', 'line', 'custom')),
    display_name TEXT NOT NULL,
    system_prompt TEXT NOT NULL DEFAULT '',
    owner_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (target, target_type)
);

CREATE TABLE IF NOT EXISTS chat_targets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id TEXT NOT NULL REFERENCES chat_profiles(id) ON DELETE CASCADE,
    target TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS knowledge_assets (
    id TEXT PRIMARY KEY,
    chat_id TEXT NOT NULL REFERENCES chat_profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('file', 'url', 'text')),
    title TEXT,
    source_url TEXT,
    original_filename TEXT,
    storage_path TEXT,
    status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'succeeded', 'failed')) DEFAULT 'pending',
    embedding_count INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_chat_profiles_created ON chat_profiles(created_at);
CREATE INDEX IF NOT EXISTS idx_chat_targets_chat ON chat_targets(chat_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_assets_chat ON knowledge_assets(chat_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_assets_status ON knowledge_assets(status);
