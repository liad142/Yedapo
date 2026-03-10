-- 016: Listening Progress
-- Tracks per-user episode playback position and completion

CREATE TABLE IF NOT EXISTS listening_progress (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  episode_id UUID NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
  current_time_seconds REAL NOT NULL DEFAULT 0,
  duration_seconds REAL NOT NULL DEFAULT 0,
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  last_played_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, episode_id)
);

-- Fast lookup: user's progress for a set of episodes
CREATE INDEX IF NOT EXISTS idx_listening_progress_user
  ON listening_progress(user_id, episode_id);

-- Fast lookup: user's completed episodes
CREATE INDEX IF NOT EXISTS idx_listening_progress_completed
  ON listening_progress(user_id) WHERE completed = true;

-- FK index for cascade delete performance
CREATE INDEX IF NOT EXISTS idx_listening_progress_episode
  ON listening_progress(episode_id);

-- NOTE: RLS not enabled — all access via admin client (service role).
-- If exposed via anon/authenticated client, add:
--   ALTER TABLE listening_progress ENABLE ROW LEVEL SECURITY;
--   CREATE POLICY user_own_progress ON listening_progress
--     FOR ALL TO authenticated USING (user_id = auth.uid());
