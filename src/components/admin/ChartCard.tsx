'use client';

import { cn } from '@/lib/utils';
import { elevation } from '@/lib/elevation';

interface ChartCardProps {
  title: string;
  children: React.ReactNode;
  className?: string;
}

export function ChartCard({ title, children, className }: ChartCardProps) {
  return (
    <div className={cn(elevation.card, 'rounded-xl p-3 sm:p-5', className)}>
      <h3 className="text-sm font-medium text-muted-foreground mb-4">{title}</h3>
      {children}
    </div>
  );
}
