import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';

const LAST_SEEN_KEY = 'yedapo:summaries:lastSeen';

/**
 * Track count of NEW ready summaries since user last visited /summaries.
 * Uses localStorage for "last seen" timestamp and polls /api/summaries periodically.
 */
export function useNewSummaryCount() {
  const { user } = useAuth();
  const [newCount, setNewCount] = useState(0);

  const getLastSeen = useCallback((): string | null => {
    try {
      return localStorage.getItem(LAST_SEEN_KEY);
    } catch {
      return null;
    }
  }, []);

  const markSeen = useCallback(() => {
    try {
      localStorage.setItem(LAST_SEEN_KEY, new Date().toISOString());
    } catch {}
    setNewCount(0);
  }, []);

  const fetchNewCount = useCallback(async () => {
    if (!user) return;

    try {
      const lastSeen = getLastSeen();
      const url = lastSeen
        ? `/api/stats/new-summaries?since=${encodeURIComponent(lastSeen)}`
        : `/api/stats/new-summaries`;

      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.json();
      setNewCount(data.count ?? 0);
    } catch {}
  }, [user, getLastSeen]);

  // Fetch on mount and periodically
  useEffect(() => {
    if (!user) {
      setNewCount(0);
      return;
    }

    fetchNewCount();
    const interval = setInterval(fetchNewCount, 60_000); // every 60s
    return () => clearInterval(interval);
  }, [user, fetchNewCount]);

  return { newCount, markSeen, fetchNewCount };
}
