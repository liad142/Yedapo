'use client';

import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AiDisclosureProps {
  className?: string;
}

export function AiDisclosure({ className }: AiDisclosureProps) {
  return (
    <div className={cn(
      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
      "bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300",
      "border border-purple-200 dark:border-purple-800",
      className
    )}>
      <Sparkles className="h-3 w-3" />
      AI-Generated
    </div>
  );
}
