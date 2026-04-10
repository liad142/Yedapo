'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useUsage } from '@/contexts/UsageContext';
import { DeliveryPreferences } from '@/components/settings/DeliveryPreferences';
import { UpgradeOverlay } from '@/components/settings/UpgradeOverlay';
import { NotificationSubscriptionsSection } from '@/components/settings/sections/NotificationSubscriptionsSection';
import { YouTubeChannelsSection } from '@/components/settings/sections/YouTubeChannelsSection';
import { Toast } from '@/components/ui/toast';
import { NOTIFICATION_ACCESS } from '@/lib/plans';
import type { UserPlan } from '@/lib/plans';

export default function NotificationsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { usage } = useUsage();
  const userPlan: UserPlan = usage?.plan ?? 'free';
  const access = NOTIFICATION_ACCESS[userPlan];

  const [errorToast, setErrorToast] = useState<string | null>(null);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Sign in to manage notifications.
      </div>
    );
  }

  const deliveryContent = (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-1">Delivery Preferences</h3>
        <p className="text-xs text-muted-foreground">
          Control how and when summaries reach you.
        </p>
      </div>
      <DeliveryPreferences />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* ── Delivery preferences ── gated for free users ── */}
      {access.email ? (
        deliveryContent
      ) : (
        <UpgradeOverlay
          title="Upgrade to Explorer"
          description="Get summaries delivered to your inbox, Telegram, or WhatsApp — automatically."
        >
          {deliveryContent}
        </UpgradeOverlay>
      )}

      {/* Channel-setup pointer — delivery channels live in /settings/connections now */}
      <div className="rounded-2xl border border-dashed border-border bg-card/50 p-4">
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">Delivery channels</p>
            <p className="text-xs text-muted-foreground">
              Connect Email, Telegram, WhatsApp to receive summaries outside the app.
            </p>
          </div>
          <Link
            href="/settings/connections"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors whitespace-nowrap"
          >
            Manage
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>

      {/* Per-podcast/channel notification subscriptions — always available */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <NotificationSubscriptionsSection onError={setErrorToast} />
      </div>

      {/* Followed YouTube channels list */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <YouTubeChannelsSection onError={setErrorToast} />
      </div>

      {/* Error Toast */}
      <Toast open={!!errorToast} onOpenChange={() => setErrorToast(null)} position="top">
        <p className="text-sm text-destructive font-medium">{errorToast}</p>
      </Toast>
    </div>
  );
}
