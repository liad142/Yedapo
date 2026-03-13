-- Enable RLS on in_app_notifications so Supabase Realtime can filter rows
-- and the browser client can query directly (no more polling API route).

ALTER TABLE in_app_notifications ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read & update their own notifications
CREATE POLICY "Users can view own notifications"
  ON in_app_notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications"
  ON in_app_notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Add table to the realtime publication so postgres_changes events are broadcast
ALTER PUBLICATION supabase_realtime ADD TABLE in_app_notifications;
