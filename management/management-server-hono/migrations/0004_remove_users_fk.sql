-- owner_user_id の外部キー制約を削除し、users テーブルを不要にする
-- SQLite では ALTER TABLE で外部キーを削除できないため、テーブルを再作成

-- 1. 一時テーブルにデータを退避
CREATE TABLE chat_profiles_new (
    id TEXT PRIMARY KEY,
    target TEXT NOT NULL,
    target_type TEXT NOT NULL DEFAULT 'web' CHECK (target_type IN ('web', 'line', 'custom')),
    display_name TEXT NOT NULL,
    system_prompt TEXT NOT NULL DEFAULT '',
    owner_user_id TEXT,  -- 外部キー制約なし、Firebase UID を直接保存
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (target, target_type)
);

-- 2. データを移行
INSERT INTO chat_profiles_new SELECT * FROM chat_profiles;

-- 3. 古いテーブルを削除
DROP TABLE chat_profiles;

-- 4. 新しいテーブルをリネーム
ALTER TABLE chat_profiles_new RENAME TO chat_profiles;

-- 5. インデックスを再作成
CREATE INDEX IF NOT EXISTS idx_chat_profiles_created ON chat_profiles(created_at);
CREATE INDEX IF NOT EXISTS idx_chat_profiles_owner ON chat_profiles(owner_user_id);

-- 6. users テーブルを削除（不要になったため）
DROP TABLE IF EXISTS users;
