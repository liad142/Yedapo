'use client';

import { cn } from '@/lib/utils';

interface ConnectedAppCardProps {
  icon: React.ReactNode;
  iconBgClass?: string;
  title: string;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  statusDot?: boolean;
  disabled?: boolean;
  /** Optional right-side status badge (e.g., "Verified", "Coming Soon") */
  badge?: React.ReactNode;
}

/**
 * Uniform card used for all external connections/delivery channels
 * (Email, Telegram, Notion, WhatsApp, YouTube).
 */
export function ConnectedAppCard({
  icon,
  iconBgClass,
  title,
  subtitle,
  action,
  statusDot,
  disabled,
  badge,
}: ConnectedAppCardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-border bg-card p-5',
        disabled && 'opacity-60'
      )}
    >
      <div className="flex items-center gap-4">
        <div
          className={cn(
            'w-12 h-12 rounded-xl flex items-center justify-center shrink-0',
            iconBgClass ?? 'bg-secondary'
          )}
        >
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-foreground">{title}</p>
            {statusDot && <span className="w-2 h-2 rounded-full bg-green-500" />}
          </div>
          {subtitle && (
            <div className="text-xs text-muted-foreground truncate">{subtitle}</div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {badge}
          {action}
        </div>
      </div>
    </div>
  );
}
