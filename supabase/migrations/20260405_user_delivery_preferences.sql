-- Phase 3: User-level delivery preferences
-- Adds frequency, digest time, timezone, and daily cap to user_profiles.
-- Controls HOW notifications are delivered, separate from WHICH subscriptions trigger them
-- (that's still per-subscription via notify_enabled + notify_channels).

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS notify_frequency TEXT NOT NULL DEFAULT 'immediate'
    CHECK (notify_frequency IN ('immediate', 'digest_daily', 'digest_weekly', 'off')),
  ADD COLUMN IF NOT EXISTS notify_digest_hour SMALLINT NOT NULL DEFAULT 8
    CHECK (notify_digest_hour BETWEEN 0 AND 23),
  ADD COLUMN IF NOT EXISTS notify_timezone TEXT NOT NULL DEFAULT 'UTC',
  ADD COLUMN IF NOT EXISTS notify_daily_cap INT NOT NULL DEFAULT 10
    CHECK (notify_daily_cap BETWEEN 1 AND 100);

COMMENT ON COLUMN user_profiles.notify_frequency IS 'How often to batch-deliver: immediate (default), digest_daily (one batch/day), digest_weekly (one batch/week), off (pause all)';
COMMENT ON COLUMN user_profiles.notify_digest_hour IS 'Hour of day (0-23) to send digest, interpreted in user timezone';
COMMENT ON COLUMN user_profiles.notify_timezone IS 'IANA timezone identifier (e.g., America/New_York, Asia/Jerusalem)';
COMMENT ON COLUMN user_profiles.notify_daily_cap IS 'Maximum notifications per day. Free plan default = 10, Pro plan default = 100';
