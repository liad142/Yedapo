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
      // Query episodes directly — podcasts.latest_episode_date may not be populated
      const { data: subs } = await supabase
        .from('podcast_subscriptions')
        .select('podcast_id, last_viewed_at')
        .eq('user_id', userId);

      if (subs && subs.length > 0) {
        const podcastIds = subs.map((s: any) => s.podcast_id);
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

        const { data: recentEpisodes } = await supabase
          .from('episodes')
          .select('podcast_id, published_at')
          .in('podcast_id', podcastIds)
          .gte('published_at', thirtyDaysAgo);

        let newEps = 0;
        for (const sub of subs) {
          const hasNew = (recentEpisodes || []).some((ep: any) =>
            ep.podcast_id === sub.podcast_id &&
            (!sub.last_viewed_at || new Date(ep.published_at) > new Date(sub.last_viewed_at))
          );
          if (hasNew) newEps++;
        }
        setNewEpisodeCount(newEps);
      } else {
        setNewEpisodeCount(0);
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
