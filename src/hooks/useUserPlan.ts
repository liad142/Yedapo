'use client';

import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUsageOptional } from '@/contexts/UsageContext';
import { PLAN_LIMITS, PLAN_CUTOFFS, GUEST_CUTOFFS, type UserPlan, type PlanLimits, type ContentCutoffs } from '@/lib/plans';

interface UseUserPlanResult {
  plan: UserPlan;
  limits: PlanLimits;
  cutoffs: ContentCutoffs;
  isFree: boolean;
  isPro: boolean;
  isGuest: boolean;
  isLoading: boolean;
}

/**
 * Derives plan info from UsageContext (already fetched) instead of making
 * a separate HTTP request per hook consumer. Falls back to 'free' if
 * UsageContext is not available.
 */
export function useUserPlan(): UseUserPlanResult {
  const { user, isLoading: authLoading } = useAuth();
  const usageCtx = useUsageOptional();

  const isGuest = !user;
  const plan: UserPlan = usageCtx?.usage?.plan ?? 'free';
  const isLoading = authLoading || (usageCtx?.isLoading ?? false);

  return useMemo(() => ({
    plan,
    limits: PLAN_LIMITS[plan],
    // Guests get restrictive cutoffs (blur + sign-up CTA);
    // registered users (even free) see all content.
    cutoffs: isGuest ? GUEST_CUTOFFS : PLAN_CUTOFFS[plan],
    isFree: plan === 'free',
    isPro: plan === 'pro',
    isGuest,
    isLoading,
  }), [plan, isGuest, isLoading]);
}
