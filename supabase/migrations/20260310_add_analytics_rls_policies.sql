-- Add explicit service-role-only policies to analytics_events table

ALTER TABLE IF EXISTS analytics_events ENABLE ROW LEVEL SECURITY;

-- Drop any existing overly-permissive policies
DROP POLICY IF EXISTS "Allow insert for all" ON analytics_events;
DROP POLICY IF EXISTS "analytics_events_insert" ON analytics_events;

-- Only service role can insert (API route uses admin client)
CREATE POLICY "analytics_events_insert_service" ON analytics_events
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- Only service role can read (for admin dashboard)
CREATE POLICY "analytics_events_select_service" ON analytics_events
  FOR SELECT USING (auth.role() = 'service_role');
