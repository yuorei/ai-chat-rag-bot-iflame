-- Add index for owner_user_id to improve query performance
CREATE INDEX IF NOT EXISTS idx_chat_profiles_owner ON chat_profiles(owner_user_id);
