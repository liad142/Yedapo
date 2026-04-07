'use client';

import { useState, useEffect, useCallback } from 'react';
import { Bell, BellOff, Mail, Send, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useUsage } from '@/contexts/UsageContext';
import { DeliveryPreferences } from '@/components/settings/DeliveryPreferences';
import { UpgradeOverlay } from '@/components/settings/UpgradeOverlay';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { NOTIFICATION_ACCESS } from '@/lib/plans';
import type { UserPlan } from '@/lib/plans';

interface NotifConnection {
  email: { address: string; verified: boolean };
  telegram: { connected: boolean; username?: string };
}

interface NotifSubscription {
  podcastId: string;
  podcastTitle: string;
  podcastArtwork: string | null;
  notifyEnabled: boolean;
  notifyChannels: string[];
}

export default function NotificationsPage() {
  const { user } = useAuth();
  const { usage } = useUsage();
  const userPlan: UserPlan = usage?.plan ?? 'free';
  const access = NOTIFICATION_ACCESS[userPlan];

  const [connections, setConnections] = useState<NotifConnection | null>(null);
  const [subscriptions, setSubscriptions] = useState<NotifSubscription[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch('/api/settings/notifications');
      if (res.ok) {
        const data = await res.json();
        setConnections(data.connections);
        setSubscriptions(data.subscriptions || []);
      }
    } catch {
      // silent
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) fetchData();
  }, [user, fetchData]);

  const handleToggle = async (podcastId: string, currentEnabled: boolean) => {
    setTogglingId(podcastId);
    try {
      await fetch(`/api/subscriptions/${podcastId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notifyEnabled: !currentEnabled, updateLastViewed: false }),
      });
      await fetchData();
    } catch {
      // silent
    } finally {
      setTogglingId(null);
    }
  };

  if (!user) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Sign in to manage notifications.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const deliveryContent = (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-1">Delivery Preferences</h3>
        <p className="text-xs text-muted-foreground">Control how and when summaries reach you.</p>
      </div>
      <DeliveryPreferences />
    </div>
  );

  const channelsContent = (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-1">Delivery Channels</h3>
        <p className="text-xs text-muted-foreground">Where summaries are sent when ready.</p>
      </div>

      {/* Email */}
      <div className="flex items-center gap-4 p-4 rounded-xl bg-secondary/50">
        <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
          <Mail className="h-5 w-5 text-blue-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">Email</p>
          <p className="text-xs text-muted-foreground truncate">{user.email}</p>
        </div>
        <span className="text-xs font-medium text-green-600 dark:text-green-400 bg-green-500/10 px-2 py-1 rounded-full shrink-0">
          Verified
        </span>
      </div>

      {/* Telegram */}
      <div className="flex items-center gap-4 p-4 rounded-xl bg-secondary/50">
        <div className="w-10 h-10 rounded-lg bg-sky-500/10 flex items-center justify-center shrink-0">
          <Send className="h-5 w-5 text-sky-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">Telegram</p>
          <p className="text-xs text-muted-foreground">
            {connections?.telegram?.connected
              ? connections.telegram.username
                ? `@${connections.telegram.username}`
                : 'Connected'
              : 'Not connected'}
          </p>
        </div>
        {connections?.telegram?.connected ? (
          <span className="text-xs font-medium text-green-600 dark:text-green-400 bg-green-500/10 px-2 py-1 rounded-full shrink-0">
            Connected
          </span>
        ) : (
          <Button variant="outline" size="sm">Connect</Button>
        )}
      </div>

      {/* WhatsApp — coming soon */}
      <div className="flex items-center gap-4 p-4 rounded-xl bg-secondary/50 opacity-60">
        <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
          <svg className="h-5 w-5 text-green-500" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
            <path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.955 9.955 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2z"/>
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">WhatsApp</p>
          <p className="text-xs text-muted-foreground">Coming soon</p>
        </div>
        <span className="text-xs font-medium text-muted-foreground bg-secondary px-2 py-1 rounded-full shrink-0">
          Soon
        </span>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Delivery Preferences + Channels — gated for free users */}
      {access.email ? (
        <>
          {deliveryContent}
          {channelsContent}
        </>
      ) : (
        <>
          <UpgradeOverlay
            title="Upgrade to Explorer"
            description="Get summaries delivered to your inbox, Telegram, or WhatsApp — automatically."
          >
            {deliveryContent}
          </UpgradeOverlay>
          <UpgradeOverlay
            title="Delivery channels are a Pro feature"
            description="Connect your email, Telegram, or WhatsApp to receive summaries the moment they're ready."
          >
            {channelsContent}
          </UpgradeOverlay>
        </>
      )}

      {/* Subscription notification toggles — always available (in-app notifications are free) */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-foreground mb-1">Subscription Notifications</h3>
          <p className="text-xs text-muted-foreground">
            Toggle in-app notifications for your subscribed podcasts and channels.
          </p>
        </div>

        {subscriptions.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <BellOff className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No notification subscriptions yet.</p>
            <p className="text-xs text-muted-foreground">
              Enable notifications on any podcast or YouTube channel you follow.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {subscriptions.map((sub) => (
              <div
                key={sub.podcastId}
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-secondary/50 transition-colors"
              >
                {sub.podcastArtwork ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={sub.podcastArtwork}
                    alt={sub.podcastTitle}
                    className="w-10 h-10 rounded-lg object-cover shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                    <Bell className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{sub.podcastTitle}</p>
                  <p className="text-xs text-muted-foreground">
                    {sub.notifyChannels?.join(', ') || 'No channels'}
                  </p>
                </div>
                <button
                  onClick={() => handleToggle(sub.podcastId, sub.notifyEnabled)}
                  disabled={togglingId === sub.podcastId}
                  className={cn(
                    'relative w-11 h-6 rounded-full transition-colors shrink-0',
                    sub.notifyEnabled ? 'bg-primary' : 'bg-muted-foreground/20'
                  )}
                >
                  <span
                    className={cn(
                      'absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform',
                      sub.notifyEnabled && 'translate-x-5'
                    )}
                  />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
