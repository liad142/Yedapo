'use client';

import { useState } from 'react';
import { User, LogOut, Settings, ChevronDown, Headphones, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { useUserPlan } from '@/hooks/useUserPlan';
import { PLAN_META } from '@/lib/plans';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { YouTubeLogoStatic } from '@/components/YouTubeLogo';

interface SidebarUserSectionProps {
  compact?: boolean;
}

export function SidebarUserSection({ compact = false }: SidebarUserSectionProps) {
  const { user, isLoading, signOut, setShowAuthModal } = useAuth();
  const { plan } = useUserPlan();
  const [showDropdown, setShowDropdown] = useState(false);

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
        <div className="flex items-center gap-2 px-1">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Headphones className="h-3 w-3" />
            <span className="text-[11px]">Podcasts</span>
          </div>
          <span className="text-muted-foreground/30 text-[11px]">+</span>
          <YouTubeLogoStatic size="xs" />
          <span className="text-muted-foreground/30 text-[11px]">AI summaries</span>
        </div>
      </div>
    );
  }

  const displayName = user.user_metadata?.display_name
    || user.user_metadata?.full_name
    || user.email?.split('@')[0]
    || 'User';
  const email = user.email || '';
  const avatarUrl = user.user_metadata?.avatar_url || user.user_metadata?.picture;
  const initials = displayName.charAt(0).toUpperCase();

  if (compact) {
    return (
      <Link
        href="/settings"
        className="flex items-center justify-center w-9 h-9 rounded-full bg-primary/10 hover:bg-primary/20 transition-colors"
        aria-label="Settings"
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt={displayName} className="w-9 h-9 rounded-full object-cover" />
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
            <img src={avatarUrl} alt={displayName} className="w-10 h-10 rounded-full object-cover" />
          ) : (
            <span className="text-base font-semibold text-primary">{initials}</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{displayName}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{email}</p>
          <p className={cn(
            'text-[10px] font-medium mt-0.5',
            plan === 'free' && 'text-slate-400 dark:text-slate-500',
            plan === 'pro' && 'text-blue-500 dark:text-blue-400',
            plan === 'power' && 'text-amber-500 dark:text-amber-400',
          )}>
            {PLAN_META[plan].label} Plan
          </p>
        </div>
        <ChevronDown className={cn(
          'h-4 w-4 text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-400 transition-transform',
          showDropdown && 'rotate-180'
        )} />
      </button>

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
