-- Add plan column to user_profiles
-- Default 'free' means existing and new users start on the free tier.
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'free'
  CHECK (plan IN ('free', 'pro', 'power'));

CREATE INDEX IF NOT EXISTS idx_user_profiles_plan ON user_profiles(plan);
