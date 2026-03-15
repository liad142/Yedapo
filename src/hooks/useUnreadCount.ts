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

      // Count podcasts with new episodes (for My List badge)
      // Direct Supabase query — no API auth issues, lightweight
      const { data: subs } = await supabase
        .from('podcast_subscriptions')
        .select('last_viewed_at, podcasts!inner(latest_episode_date)')
        .eq('user_id', userId);

      let newEps = 0;
      for (const sub of subs || []) {
        const podcast = (sub as any).podcasts;
        const latestDate = Array.isArray(podcast) ? podcast[0]?.latest_episode_date : podcast?.latest_episode_date;
        if (latestDate) {
          if (!sub.last_viewed_at || new Date(latestDate) > new Date(sub.last_viewed_at)) {
            newEps++;
          }
        }
      }
      setNewEpisodeCount(newEps);
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
