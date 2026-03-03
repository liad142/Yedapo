'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { PLAN_LIMITS, PLAN_CUTOFFS, type UserPlan, type PlanLimits, type ContentCutoffs } from '@/lib/plans';

interface UseUserPlanResult {
  plan: UserPlan;
  limits: PlanLimits;
  cutoffs: ContentCutoffs;
  isFree: boolean;
  isPro: boolean;
  isPower: boolean;
  isLoading: boolean;
}

export function useUserPlan(): UseUserPlanResult {
  const { user, isLoading: authLoading } = useAuth();
  const [plan, setPlan] = useState<UserPlan>('free');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      // Guest / unauthenticated → free
      setPlan('free');
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchPlan() {
      try {
        const res = await fetch('/api/user/profile');
        if (!res.ok) throw new Error('Failed to fetch profile');
        const { profile } = await res.json();
        if (!cancelled) {
          setPlan((profile?.plan as UserPlan) || 'free');
        }
      } catch {
        if (!cancelled) setPlan('free');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    fetchPlan();
    return () => { cancelled = true; };
  }, [user, authLoading]);

  return useMemo(() => ({
    plan,
    limits: PLAN_LIMITS[plan],
    cutoffs: PLAN_CUTOFFS[plan],
    isFree: plan === 'free',
    isPro: plan === 'pro',
    isPower: plan === 'power',
    isLoading: authLoading || isLoading,
  }), [plan, authLoading, isLoading]);
}
