-- Simplify pricing: 3 tiers → 2 tiers (Free + Pro)
-- Migrate existing power users to pro before tightening the constraint.

UPDATE user_profiles SET plan = 'pro' WHERE plan = 'power';

ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_plan_check;
ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_plan_check CHECK (plan IN ('free', 'pro'));
