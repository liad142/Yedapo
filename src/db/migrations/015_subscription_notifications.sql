-- 015: Subscription Notifications & Auto-Summary System
-- Adds notification preferences to subscriptions and in-app notifications table

-- 1a. Add notification columns to podcast_subscriptions
ALTER TABLE podcast_subscriptions
  ADD COLUMN IF NOT EXISTS notify_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS notify_channels TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS last_checked_at TIMESTAMPTZ DEFAULT now();

-- 1a. Add notification columns to youtube_channel_follows
ALTER TABLE youtube_channel_follows
  ADD COLUMN IF NOT EXISTS notify_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS notify_channels TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS last_checked_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS last_viewed_at TIMESTAMPTZ DEFAULT now();

-- 1b. In-app notifications table
CREATE TABLE IF NOT EXISTS in_app_notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  episode_id UUID REFERENCES episodes(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (source_type IN ('podcast', 'youtube')),
  source_id UUID NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- NOTE: RLS is not enabled on in_app_notifications because all access is via
-- the admin/service-role client (bypasses RLS). If this table is ever exposed
-- via the anon/authenticated Supabase client, add RLS policies:
--   ALTER TABLE in_app_notifications ENABLE ROW LEVEL SECURITY;
--   CREATE POLICY user_own_notifications ON in_app_notifications
--     FOR ALL TO authenticated USING (user_id = auth.uid());

-- 1b. Indexes for in-app notifications
CREATE INDEX IF NOT EXISTS idx_in_app_notif_unread
  ON in_app_notifications(user_id) WHERE read = false;
CREATE INDEX IF NOT EXISTS idx_in_app_notif_recent
  ON in_app_notifications(user_id, created_at DESC);

-- 1b-extra. Index on episode_id FK for CASCADE DELETE performance
CREATE INDEX IF NOT EXISTS idx_in_app_notif_episode
  ON in_app_notifications(episode_id) WHERE episode_id IS NOT NULL;

-- 1c. Indexes for cron performance
CREATE INDEX IF NOT EXISTS idx_podcast_subs_notify
  ON podcast_subscriptions(notify_enabled) WHERE notify_enabled = true;
CREATE INDEX IF NOT EXISTS idx_yt_follows_notify
  ON youtube_channel_follows(notify_enabled) WHERE notify_enabled = true;
