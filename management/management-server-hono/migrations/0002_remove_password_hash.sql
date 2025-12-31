-- password_hashカラムを削除（Firebase認証では不要）
-- SQLiteはALTER TABLE DROP COLUMNをサポートしないため、テーブルを再作成

-- 一時テーブルを作成
CREATE TABLE users_new (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    is_admin INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- データを移行
INSERT INTO users_new (id, email, is_admin, created_at, updated_at)
SELECT id, email, is_admin, created_at, updated_at FROM users;

-- 古いテーブルを削除
DROP TABLE users;

-- 新しいテーブルをリネーム
ALTER TABLE users_new RENAME TO users;
