'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

export function useUnreadCount() {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const userId = user?.id;

  // Fetch the initial count directly via the browser Supabase client (no API route)
  const fetchCount = useCallback(async () => {
    if (!userId) {
      setUnreadCount(0);
      return;
    }
    try {
      const { count, error } = await createClient()
        .from('in_app_notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('read', false);

      if (!error) {
        setUnreadCount(count ?? 0);
      }
    } catch {
      // Silently fail
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setUnreadCount(0);
      return;
    }

    // Fetch once on mount
    fetchCount();

    // Subscribe to realtime changes on this user's notifications
    const supabase = createClient();
    const channel = supabase
      .channel(`unread-count:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'in_app_notifications',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          // New notification — increment
          setUnreadCount((prev) => prev + 1);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'in_app_notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload: { old: Record<string, unknown>; new: Record<string, unknown> }) => {
          const oldRead = payload.old?.read;
          const newRead = payload.new?.read;
          // Only adjust if read status actually changed
          if (oldRead === false && newRead === true) {
            setUnreadCount((prev) => Math.max(0, prev - 1));
          } else if (oldRead === true && newRead === false) {
            setUnreadCount((prev) => prev + 1);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'in_app_notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload: { old: Record<string, unknown> }) => {
          // If deleted notification was unread, decrement
          if (payload.old?.read === false) {
            setUnreadCount((prev) => Math.max(0, prev - 1));
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
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

  return { unreadCount, refetchCount: fetchCount, markAllRead };
}
