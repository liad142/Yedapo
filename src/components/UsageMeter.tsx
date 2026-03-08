'use client';

import { cn } from '@/lib/utils';

interface UsageMeterProps {
  label: string;
  used: number;
  limit: number; // -1 = unlimited
  variant?: 'sidebar' | 'inline';
}

export function UsageMeter({ label, used, limit, variant = 'sidebar' }: UsageMeterProps) {
  // Unlimited: show subtle text for sidebar, nothing for inline
  if (limit === -1) {
    if (variant === 'sidebar') {
      return (
        <div className="flex items-center justify-between text-[11px] text-muted-foreground/60">
          <span>{label}</span>
          <span>Unlimited</span>
        </div>
      );
    }
    return null;
  }

  const remaining = Math.max(0, limit - used);
  const pct = limit > 0 ? (used / limit) * 100 : 0;

  if (variant === 'inline') {
    if (remaining <= 0) {
      return <span className="text-[11px] font-medium text-red-500 dark:text-red-400">Limit reached</span>;
    }
    return (
      <span className={cn(
        'text-[11px] text-muted-foreground',
        pct >= 80 && 'text-amber-600 dark:text-amber-400',
      )}>
        {remaining} left
      </span>
    );
  }

  // Sidebar variant
  const barColor = pct >= 80
    ? 'bg-red-500 dark:bg-red-400'
    : pct >= 50
      ? 'bg-amber-500 dark:bg-amber-400'
      : 'bg-green-500 dark:bg-green-400';

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-muted-foreground">{label}</span>
        <span className={cn(
          'font-medium tabular-nums',
          pct >= 80 ? 'text-red-500 dark:text-red-400' : 'text-muted-foreground',
        )}>
          {used}/{limit}
        </span>
      </div>
      <div className="h-1 rounded-full bg-muted overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-300', barColor)}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </div>
  );
}
