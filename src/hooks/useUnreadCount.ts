'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';

const POLL_INTERVAL = 60_000; // 60 seconds

export function useUnreadCount() {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  const userId = user?.id;

  const fetchCount = useCallback(async () => {
    if (!userId) {
      setUnreadCount(0);
      return;
    }
    try {
      const res = await fetch('/api/notifications/in-app/count');
      if (res.ok) {
        const data = await res.json();
        setUnreadCount(data.unreadCount ?? 0);
      }
    } catch {
      // Silently fail
    }
  }, [userId]);

  useEffect(() => {
    fetchCount();

    if (!userId) return;

    const interval = setInterval(fetchCount, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [userId, fetchCount]);

  const markAllRead = useCallback(async () => {
    try {
      await fetch('/api/notifications/in-app', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAllRead: true }),
      });
      setUnreadCount(0);
    } catch {
      // Silently fail
    }
  }, []);

  return { unreadCount, refetchCount: fetchCount, markAllRead };
}
