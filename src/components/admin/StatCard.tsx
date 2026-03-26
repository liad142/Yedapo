'use client';

import { type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { elevation } from '@/lib/elevation';

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  trend?: { value: number; label: string };
  className?: string;
}

export function StatCard({ icon: Icon, label, value, trend, className }: StatCardProps) {
  return (
    <div className={cn(elevation.card, 'rounded-xl p-3 sm:p-5', className)}>
      <div className="flex items-center justify-between mb-2 sm:mb-3">
        <span className="text-xs sm:text-sm text-muted-foreground truncate mr-1">{label}</span>
        <Icon className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground shrink-0" />
      </div>
      <div className="text-xl sm:text-2xl font-bold truncate">{value}</div>
      {trend && (
        <div className={cn(
          'mt-2 text-xs font-medium',
          trend.value >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
        )}>
          {trend.value >= 0 ? '+' : ''}{trend.value}% {trend.label}
        </div>
      )}
    </div>
  );
}
