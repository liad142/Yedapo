-- Create episode_comments table for user discussions on episodes
-- Supports single-level threading (top-level comments + direct replies)

CREATE TABLE IF NOT EXISTS episode_comments (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  episode_id  UUID NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_id   UUID REFERENCES episode_comments(id) ON DELETE CASCADE,
  body        TEXT NOT NULL CHECK (char_length(body) >= 1 AND char_length(body) <= 2000),
  edited_at   TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE episode_comments IS 'User comments on episodes with single-level threading';
COMMENT ON COLUMN episode_comments.parent_id IS 'NULL for top-level comments, references parent for replies';
COMMENT ON COLUMN episode_comments.edited_at IS 'Set when user edits comment body, distinct from auto-updated updated_at';

-- Indexes
CREATE INDEX idx_episode_comments_episode ON episode_comments(episode_id, created_at);
CREATE INDEX idx_episode_comments_parent ON episode_comments(parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX idx_episode_comments_user ON episode_comments(user_id);

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_episode_comments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER episode_comments_updated_at
  BEFORE UPDATE ON episode_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_episode_comments_updated_at();

-- RLS Policies
ALTER TABLE episode_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Comments are publicly readable"
  ON episode_comments FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Users can create own comments"
  ON episode_comments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own comments"
  ON episode_comments FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own comments"
  ON episode_comments FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Service role full access on episode_comments"
  ON episode_comments FOR ALL
  USING (auth.role() = 'service_role');
