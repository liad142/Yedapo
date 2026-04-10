-- Notion integration: store per-user OAuth tokens + target database
-- Pro users connect Notion once; a "Yedapo Summaries" database is auto-created
-- on first connect when they've shared a page with the integration.

CREATE TABLE IF NOT EXISTS notion_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  workspace_name TEXT,
  workspace_icon TEXT,
  bot_id TEXT,
  database_id TEXT,
  database_url TEXT,
  connected_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE notion_connections IS 'Per-user Notion OAuth tokens and target "Yedapo Summaries" database';
COMMENT ON COLUMN notion_connections.access_token IS 'Notion internal integration token issued via OAuth';
COMMENT ON COLUMN notion_connections.workspace_id IS 'Notion workspace UUID';
COMMENT ON COLUMN notion_connections.database_id IS 'Yedapo Summaries database created in the user workspace; null until created';

CREATE INDEX IF NOT EXISTS idx_notion_connections_user ON notion_connections(user_id);

ALTER TABLE notion_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own notion"
  ON notion_connections FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own notion"
  ON notion_connections FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Service role full access"
  ON notion_connections FOR ALL
  USING (auth.role() = 'service_role');
