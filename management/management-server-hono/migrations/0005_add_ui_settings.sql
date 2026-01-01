-- UI settings table for no-code customization
CREATE TABLE IF NOT EXISTS chat_ui_settings (
    id TEXT PRIMARY KEY,
    chat_id TEXT NOT NULL UNIQUE REFERENCES chat_profiles(id) ON DELETE CASCADE,
    theme_settings TEXT NOT NULL DEFAULT '{}',
    widget_settings TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_chat_ui_settings_chat ON chat_ui_settings(chat_id);
