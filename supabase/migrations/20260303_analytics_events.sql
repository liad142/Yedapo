-- Lightweight analytics events for business model validation (pre-Stripe).
CREATE TABLE IF NOT EXISTS analytics_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  params JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analytics_events_event ON analytics_events(event);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created ON analytics_events(created_at);

-- Enable RLS; only service_role (admin client) can insert/select.
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
