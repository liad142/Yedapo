-- Add apple_id column to podcasts for reliable back-navigation from episode pages
ALTER TABLE podcasts ADD COLUMN IF NOT EXISTS apple_id TEXT;

-- Backfill from existing apple: prefixed rss_feed_url
UPDATE podcasts
SET apple_id = REPLACE(rss_feed_url, 'apple:', '')
WHERE rss_feed_url LIKE 'apple:%' AND apple_id IS NULL;

-- Index for lookups
CREATE INDEX IF NOT EXISTS idx_podcasts_apple_id ON podcasts(apple_id) WHERE apple_id IS NOT NULL;
