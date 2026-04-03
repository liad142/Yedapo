'use client';

import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { PLAN_LIMITS, type UserPlan } from '@/lib/plans';

interface FeatureUsage {
  used: number;
  limit: number; // -1 = unlimited
}

interface UsageData {
  plan: UserPlan;
  summary: FeatureUsage;
  askAi: FeatureUsage;
  resetsAt: string | null;
  isUnlimited: boolean;
}

interface UsageContextValue {
  usage: UsageData | null;
  isLoading: boolean;
  incrementSummary: () => void;
  incrementAskAi: () => void;
  refresh: () => void;
}

const UsageContext = createContext<UsageContextValue | null>(null);

export function useUsage(): UsageContextValue {
  const ctx = useContext(UsageContext);
  if (!ctx) throw new Error('useUsage must be used within UsageProvider');
  return ctx;
}

/** Optional hook that returns null outside provider (for components that may render outside the tree) */
export function useUsageOptional(): UsageContextValue | null {
  return useContext(UsageContext);
}

const GUEST_USAGE: UsageData = {
  plan: 'free',
  summary: { used: 0, limit: PLAN_LIMITS.free.summariesPerDay },
  askAi: { used: 0, limit: PLAN_LIMITS.free.askAiPerDay },
  resetsAt: null,
  isUnlimited: false,
};

export function UsageProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoading: authLoading } = useAuth();
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const resetTimerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchUsage = useCallback(async () => {
    if (!user) {
      setUsage(GUEST_USAGE);
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/user/usage');
      if (!res.ok) throw new Error('Failed to fetch usage');
      const data = await res.json();
      setUsage({
        plan: data.plan as UserPlan,
        summary: data.summary,
        askAi: data.askAi,
        resetsAt: data.resetsAt,
        isUnlimited: data.summary.limit === -1,
      });
    } catch {
      // Fallback to free defaults
      setUsage(GUEST_USAGE);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Fetch on mount and auth change
  useEffect(() => {
    if (authLoading) return;
    fetchUsage();
  }, [authLoading, fetchUsage]);

  // Auto-refresh when resetsAt time passes (single timeout instead of polling)
  useEffect(() => {
    if (!usage?.resetsAt) return;

    const resetAt = new Date(usage.resetsAt).getTime();
    const delay = resetAt - Date.now();
    if (delay <= 0) {
      fetchUsage();
      return;
    }

    const timer = setTimeout(fetchUsage, delay);
    return () => clearTimeout(timer);
  }, [usage?.resetsAt, fetchUsage]);

  const incrementSummary = useCallback(() => {
    setUsage(prev => {
      if (!prev || prev.summary.limit === -1) return prev;
      return {
        ...prev,
        summary: { ...prev.summary, used: prev.summary.used + 1 },
      };
    });
  }, []);

  const incrementAskAi = useCallback(() => {
    setUsage(prev => {
      if (!prev || prev.askAi.limit === -1) return prev;
      return {
        ...prev,
        askAi: { ...prev.askAi, used: prev.askAi.used + 1 },
      };
    });
  }, []);

  const refresh = useCallback(() => {
    fetchUsage();
  }, [fetchUsage]);

  return (
    <UsageContext.Provider value={{ usage, isLoading, incrementSummary, incrementAskAi, refresh }}>
      {children}
    </UsageContext.Provider>
  );
}
