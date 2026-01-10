-- Chat suggestions table for quick reply functionality
CREATE TABLE IF NOT EXISTS chat_suggestions (
    id TEXT PRIMARY KEY,
    chat_id TEXT NOT NULL REFERENCES chat_profiles(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    order_index INTEGER NOT NULL DEFAULT 0,
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_chat_suggestions_chat ON chat_suggestions(chat_id);
CREATE INDEX IF NOT EXISTS idx_chat_suggestions_order ON chat_suggestions(chat_id, order_index);
