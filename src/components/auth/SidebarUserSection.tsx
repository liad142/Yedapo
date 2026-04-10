'use client';

import { useState, useEffect } from 'react';
import { User, LogOut, Settings, ChevronDown, Headphones, Play, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { useUserPlan } from '@/hooks/useUserPlan';
import { useUsage } from '@/contexts/UsageContext';
import { PLAN_META } from '@/lib/plans';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { YouTubeLogoStatic } from '@/components/YouTubeLogo';
import { UsageMeter } from '@/components/UsageMeter';
import { getTimeUntilReset } from '@/lib/time-utils';

interface SidebarUserSectionProps {
  compact?: boolean;
}

export function SidebarUserSection({ compact = false }: SidebarUserSectionProps) {
  const { user, isLoading, signOut, setShowAuthModal } = useAuth();
  const { plan } = useUserPlan();
  const { usage } = useUsage();
  const [showDropdown, setShowDropdown] = useState(false);
  const [resetTime, setResetTime] = useState(getTimeUntilReset);
  const [imgError, setImgError] = useState(false);

  // Keep reset timer ticking
  useEffect(() => {
    const interval = setInterval(() => setResetTime(getTimeUntilReset()), 60_000);
    return () => clearInterval(interval);
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-muted/50">
        <Skeleton className="w-8 h-8 rounded-full" />
        {!compact && (
          <div className="flex-1 min-w-0 space-y-1">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-32" />
          </div>
        )}
      </div>
    );
  }

  if (!user) {
    if (compact) {
      return (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setShowAuthModal(true)}
          aria-label="Sign up"
        >
          <User className="h-5 w-5" />
        </Button>
      );
    }

    return (
      <div className="space-y-2.5">
        <Button
          className="w-full justify-start gap-2"
          onClick={() => setShowAuthModal(true)}
        >
          <User className="h-4 w-4" />
          Sign Up
        </Button>
      </div>
    );
  }

  const displayName = user.user_metadata?.display_name
    || user.user_metadata?.full_name
    || user.email?.split('@')[0]
    || 'User';
  const email = user.email || '';
  const avatarUrl = !imgError
    ? (user.user_metadata?.avatar_url || user.user_metadata?.picture)
    : null;
  const initials = displayName.charAt(0).toUpperCase();

  if (compact) {
    return (
      <Link
        href="/settings"
        className="flex items-center justify-center w-9 h-9 rounded-full bg-primary/10 hover:bg-primary/20 transition-colors"
        aria-label="Settings"
      >
        {avatarUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={avatarUrl} alt={displayName} className="w-9 h-9 rounded-full object-cover" referrerPolicy="no-referrer" onError={() => setImgError(true)} />
        ) : (
          <span className="text-sm font-medium text-primary">{initials}</span>
        )}
      </Link>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className={cn(
          'flex items-center gap-3 p-2 rounded-xl hover:bg-secondary transition-colors w-full text-left group',
        )}
      >
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 shrink-0 ring-2 ring-background shadow-sm group-hover:shadow-md transition-all">
          {avatarUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={avatarUrl} alt={displayName} className="w-10 h-10 rounded-full object-cover" referrerPolicy="no-referrer" onError={() => setImgError(true)} />
          ) : (
            <span className="text-base font-semibold text-primary">{initials}</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{displayName}</p>
          <p className="text-xs text-muted-foreground truncate">{email}</p>
          <p className={cn(
            'text-[10px] font-medium mt-0.5',
            plan === 'free' && 'text-muted-foreground',
            plan === 'pro' && 'text-blue-500 dark:text-blue-400',
          )}>
            {(PLAN_META[plan] || PLAN_META.free).label} Plan
          </p>
        </div>
        <ChevronDown className={cn(
          'h-4 w-4 text-muted-foreground group-hover:text-foreground transition-transform',
          showDropdown && 'rotate-180'
        )} />
      </button>

      {/* Usage meters */}
      {usage && (
        <div className="mt-2 space-y-1.5 px-1">
          <UsageMeter label="Summaries" used={usage.summary.used} limit={usage.summary.limit} variant="sidebar" />
          {!usage.isUnlimited && (
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground/50 pt-0.5">
              <Clock className="h-2.5 w-2.5" />
              <span>Resets in {resetTime}</span>
            </div>
          )}
        </div>
      )}

      {showDropdown && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowDropdown(false)} />
          <div className="absolute left-0 right-0 bottom-full mb-2 rounded-lg border border-border bg-background shadow-lg z-50 py-1">
            <Link
              href="/settings"
              onClick={() => setShowDropdown(false)}
              className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent transition-colors"
            >
              <Settings className="h-4 w-4" />
              Settings
            </Link>
            <button
              onClick={() => { signOut(); setShowDropdown(false); }}
              className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent transition-colors w-full text-left text-red-600 dark:text-red-400"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          </div>
        </>
      )}
    </div>
  );
}
