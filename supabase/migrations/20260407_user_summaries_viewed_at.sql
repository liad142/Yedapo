-- Add viewed_at column to track when user last read a summary.
-- NULL means unread; set to now() when user opens the insights page.

ALTER TABLE user_summaries
  ADD COLUMN IF NOT EXISTS viewed_at TIMESTAMPTZ;
