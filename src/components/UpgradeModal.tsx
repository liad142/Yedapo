'use client';

import { Sparkles, X, Clock, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PLAN_LIMITS, PLAN_META } from '@/lib/plans';

export type RateLimitFeature = 'summary' | 'askAi';

interface RateLimitInfo {
  limit: number;
  used: number;
}

interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
  rateLimitInfo: RateLimitInfo;
  /** Which feature triggered the limit — customizes the upgrade message */
  feature?: RateLimitFeature;
}

function getTimeUntilReset(): string {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setUTCDate(midnight.getUTCDate() + 1);
  midnight.setUTCHours(0, 0, 0, 0);

  const diffMs = midnight.getTime() - now.getTime();
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

const PRO_BENEFITS = PLAN_META.pro.features;

const FEATURE_COPY: Record<RateLimitFeature, { noun: string; heading: string }> = {
  summary: {
    noun: 'summary creations',
    heading: "You've used all your daily summary creations",
  },
  askAi: {
    noun: 'Ask AI questions',
    heading: "You've used all your daily Ask AI questions",
  },
};

export function UpgradeModal({ open, onClose, rateLimitInfo, feature = 'summary' }: UpgradeModalProps) {
  const [resetTime, setResetTime] = useState(getTimeUntilReset);

  useEffect(() => {
    if (!open) return;
    setResetTime(getTimeUntilReset());
    const interval = setInterval(() => setResetTime(getTimeUntilReset()), 60_000);
    return () => clearInterval(interval);
  }, [open]);

  if (!open) return null;

  const { limit, used } = rateLimitInfo;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm animate-in fade-in-0 duration-200"
        onClick={onClose}
      />

      {/* Modal */}
      <div className={cn(
        'fixed z-50 w-full max-w-sm px-4',
        'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
        'lg:left-[calc(50%+8rem)]',
        'animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-4 duration-200'
      )}>
        <div className="relative rounded-2xl bg-card border border-border shadow-2xl p-8 text-center overflow-hidden">
          {/* Close */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>

          {/* Icon with glow */}
          <div className="mx-auto w-16 h-16 rounded-2xl bg-primary flex items-center justify-center shadow-xl shadow-primary/30 mb-5">
            <Sparkles className="h-8 w-8 text-white fill-white/20" />
          </div>

          {/* Heading */}
          <h3 className="text-xl font-bold mb-1.5">Upgrade to Pro</h3>
          <p className="text-sm text-muted-foreground mb-1">
            {FEATURE_COPY[feature].heading}
          </p>
          <p className="text-xs text-muted-foreground/70 mb-1">
            Daily limit: {limit} {FEATURE_COPY[feature].noun} &middot; {used}/{limit} used today
          </p>
          <p className="text-xs font-medium text-primary mb-1">
            Pro gets {feature === 'summary' ? PLAN_LIMITS.pro.summariesPerDay : PLAN_LIMITS.pro.askAiPerDay} per day
          </p>

          {/* Reset timer */}
          <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground/70 mb-6">
            <Clock className="h-3 w-3" />
            <span>Resets in {resetTime}</span>
          </div>

          {/* Pro benefits */}
          <div className="mb-6 space-y-2.5 text-left px-2">
            {PRO_BENEFITS.map((benefit) => (
              <div key={benefit} className="flex items-center gap-2.5">
                <div className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center">
                  <Check className="h-3 w-3 text-primary" />
                </div>
                <span className="text-sm text-foreground/90">{benefit}</span>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="space-y-2.5">
            <Button
              size="lg"
              asChild
              className="w-full gap-2 rounded-full bg-primary border-0 shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:scale-[1.02] active:scale-[0.98] transition-all text-base"
            >
              <Link href="/pricing">
                <Sparkles className="h-5 w-5 fill-white/20" />
                Upgrade to Pro
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="lg"
              onClick={onClose}
              className="w-full rounded-full text-muted-foreground"
            >
              Maybe later
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
