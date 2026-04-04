/**
 * Server-side helper to resolve a user's plan from user_profiles.
 * Returns 'free' on error. Admins resolve to 'pro'.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { isAdminEmail } from '@/lib/admin';
import { createLogger } from '@/lib/logger';
import type { UserPlan } from '@/lib/plans';

const log = createLogger('user-plan');

export async function getUserPlan(userId: string, email?: string): Promise<UserPlan> {
  // Admin emails always resolve to pro
  if (email && isAdminEmail(email)) return 'pro';

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('user_profiles')
      .select('plan')
      .eq('id', userId)
      .single();

    if (error || !data?.plan) {
      log.warn('Could not fetch plan, defaulting to free', { userId: userId.slice(0, 8), error: error?.message });
      return 'free';
    }

    const validPlans: UserPlan[] = ['free', 'pro'];
    return validPlans.includes(data.plan) ? (data.plan as UserPlan) : 'free';
  } catch (err) {
    log.error('getUserPlan failed', { userId: userId.slice(0, 8), error: String(err) });
    return 'free';
  }
}
