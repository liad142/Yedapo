'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';

const POLL_INTERVAL_MS = 30_000; // 30 seconds

export function useUnreadCount() {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [newEpisodeCount, setNewEpisodeCount] = useState(0);

  const userId = user?.id;

  // Fetch notification count via Supabase client
  const fetchCount = useCallback(async () => {
    if (!userId) {
      setUnreadCount(0);
      setNewEpisodeCount(0);
      return;
    }
    try {
      const supabase = createClient();

      // Notification count (for bell icon)
      const { count, error } = await supabase
        .from('in_app_notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('read', false);

      if (!error) {
        setUnreadCount(count ?? 0);
      }

      // New episode count across all subscriptions (for My List badge)
      const res = await fetch('/api/subscriptions?limit=200');
      if (res.ok) {
        const data = await res.json();
        const total = (data.podcasts || []).reduce(
          (sum: number, p: any) => sum + (p.new_episode_count || 0),
          0
        );
        setNewEpisodeCount(total);
      }
    } catch {
      // Silently fail
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setUnreadCount(0);
      setNewEpisodeCount(0);
      return;
    }

    fetchCount();
    const interval = setInterval(fetchCount, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [userId, fetchCount]);

  const markAllRead = useCallback(async () => {
    if (!userId) return;
    try {
      const { error } = await createClient()
        .from('in_app_notifications')
        .update({ read: true })
        .eq('user_id', userId)
        .eq('read', false);

      if (!error) {
        setUnreadCount(0);
      }
    } catch {
      // Silently fail
    }
  }, [userId]);

  return { unreadCount, newEpisodeCount, refetchCount: fetchCount, markAllRead };
}
