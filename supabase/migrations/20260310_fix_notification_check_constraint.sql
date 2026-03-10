-- Add 'in_app' to the notification_requests channel CHECK constraint
-- First drop the existing constraint, then add the updated one

DO $$
BEGIN
  -- Try to drop the existing check constraint (name may vary)
  ALTER TABLE notification_requests DROP CONSTRAINT IF EXISTS notification_requests_channel_check;
  ALTER TABLE notification_requests DROP CONSTRAINT IF EXISTS valid_channel;

  -- Add updated constraint including 'in_app'
  ALTER TABLE notification_requests ADD CONSTRAINT notification_requests_channel_check
    CHECK (channel IN ('email', 'telegram', 'in_app'));
END $$;
