-- usersテーブルを再作成（Firebase認証と連携）
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,              -- Firebase UID
    email TEXT NOT NULL,
    email_verified INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
