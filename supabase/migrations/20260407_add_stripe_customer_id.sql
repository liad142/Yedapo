-- Add stripe_customer_id to user_profiles for Stripe billing portal and
-- subscription lifecycle management (cancellation lookups).
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_profiles_stripe_customer_id
  ON user_profiles(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
