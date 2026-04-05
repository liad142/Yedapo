-- Phase 1: Notification system hardening
-- Adds idempotency (dedupe_key), audit source, retry tracking, and whatsapp channel support.
-- Does NOT change existing behavior — just adds guardrails.

-- 1. Extend channel enum to include whatsapp (for Phase 4)
ALTER TABLE notification_requests DROP CONSTRAINT IF EXISTS notification_requests_channel_check;
ALTER TABLE notification_requests ADD CONSTRAINT notification_requests_channel_check
  CHECK (channel IN ('email', 'telegram', 'whatsapp', 'in_app'));

-- 2. Audit: distinguish explicit share requests from subscription auto-fanout
ALTER TABLE notification_requests
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'explicit'
    CHECK (source IN ('explicit', 'subscription', 'digest'));

-- 3. Idempotency key: prevents double-sends when both explicit + subscription requests exist.
-- Format: user_id:episode_id:channel (source-independent, enforces ONE notification per user+episode+channel)
ALTER TABLE notification_requests
  ADD COLUMN IF NOT EXISTS dedupe_key TEXT;

-- Partial unique index — only enforces uniqueness on NEW rows (existing rows have NULL).
CREATE UNIQUE INDEX IF NOT EXISTS uq_notification_dedupe
  ON notification_requests(dedupe_key) WHERE dedupe_key IS NOT NULL;

-- 4. Retry tracking (for Phase 3 rate limits + retry logic)
ALTER TABLE notification_requests
  ADD COLUMN IF NOT EXISTS retry_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS provider_message_id TEXT;

-- 5. Hot path index for send workers
CREATE INDEX IF NOT EXISTS idx_nr_pending_next_retry
  ON notification_requests(status, next_retry_at)
  WHERE status = 'pending';

COMMENT ON COLUMN notification_requests.source IS 'Where the notification originated: explicit (user clicked share), subscription (notify_enabled auto-fanout), digest (batched)';
COMMENT ON COLUMN notification_requests.dedupe_key IS 'Format: user_id:episode_id:channel. Unique index prevents double-sends across explicit + subscription sources.';
COMMENT ON COLUMN notification_requests.retry_count IS 'Current retry attempt count for failed sends';
COMMENT ON COLUMN notification_requests.next_retry_at IS 'Scheduled retry time for failed sends (exponential backoff)';
COMMENT ON COLUMN notification_requests.provider_message_id IS 'Message ID returned by the delivery provider (Resend, Telegram, Kapso) for tracking';
