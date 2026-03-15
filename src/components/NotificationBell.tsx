'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Bell, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
interface InAppNotification {
  id: string;
  episode_id: string | null;
  source_type: 'podcast' | 'youtube';
  title: string;
  message: string | null;
  read: boolean;
  created_at: string;
}

interface NotificationBellProps {
  unreadCount: number;
  markAllRead: () => Promise<void>;
}

export function NotificationBell({ unreadCount, markAllRead }: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

  const fetchNotifications = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/notifications/in-app?limit=10');
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
      }
    } catch {
      // Silently fail
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpen = () => {
    if (!isOpen) {
      fetchNotifications();
    }
    setIsOpen(!isOpen);
  };

  const handleMarkAllRead = async () => {
    await markAllRead();
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="ghost"
        size="icon"
        onClick={handleOpen}
        className="relative rounded-full"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-primary text-primary-foreground text-[9px] font-bold px-1 py-0.5 rounded-full min-w-[16px] text-center leading-none">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </Button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-80 max-h-[400px] rounded-xl border border-border bg-card shadow-lg z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="text-sm font-semibold text-foreground">Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs text-primary hover:underline cursor-pointer"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Notifications list */}
          <div className="overflow-y-auto max-h-[340px]">
            {isLoading ? (
              <div className="p-4 text-center text-sm text-muted-foreground">Loading...</div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">No notifications yet</div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  className={cn(
                    'px-4 py-3 border-b border-border/50 hover:bg-secondary/50 transition-colors',
                    !notif.read && 'bg-primary/5'
                  )}
                >
                  {notif.episode_id ? (
                    <Link
                      href={`/episode/${notif.episode_id}/insights`}
                      onClick={() => setIsOpen(false)}
                      className="block"
                    >
                      <NotifContent notif={notif} formatTime={formatTime} />
                    </Link>
                  ) : (
                    <NotifContent notif={notif} formatTime={formatTime} />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function NotifContent({
  notif,
  formatTime,
}: {
  notif: InAppNotification;
  formatTime: (s: string) => string;
}) {
  return (
    <>
      <div className="flex items-start gap-2">
        {!notif.read && (
          <span className="mt-1.5 w-2 h-2 rounded-full bg-primary shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground line-clamp-2">{notif.title}</p>
          {notif.message && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{notif.message}</p>
          )}
          <p className="text-[10px] text-muted-foreground mt-1">{formatTime(notif.created_at)}</p>
        </div>
      </div>
    </>
  );
}
