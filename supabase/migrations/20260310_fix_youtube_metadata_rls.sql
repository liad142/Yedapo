-- Fix youtube_metadata INSERT/UPDATE policies to service-role only
-- (Application code uses admin client, so only service_role needs write access)

ALTER TABLE IF EXISTS youtube_metadata ENABLE ROW LEVEL SECURITY;

-- Drop existing overly-permissive policies if they exist
DROP POLICY IF EXISTS "Allow insert for authenticated users" ON youtube_metadata;
DROP POLICY IF EXISTS "Allow update for authenticated users" ON youtube_metadata;
DROP POLICY IF EXISTS "youtube_metadata_insert" ON youtube_metadata;
DROP POLICY IF EXISTS "youtube_metadata_update" ON youtube_metadata;

-- Read access for everyone (metadata is public)
CREATE POLICY "youtube_metadata_select_all" ON youtube_metadata
  FOR SELECT USING (true);

-- Write access only for service role (admin client)
CREATE POLICY "youtube_metadata_insert_service" ON youtube_metadata
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "youtube_metadata_update_service" ON youtube_metadata
  FOR UPDATE USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
