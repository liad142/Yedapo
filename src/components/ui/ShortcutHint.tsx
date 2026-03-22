'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface ShortcutHintProps {
  shortcut: string;
  className?: string;
}

export function ShortcutHint({ shortcut, className }: ShortcutHintProps) {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(hover: hover) and (pointer: fine)');
    setIsDesktop(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  if (!isDesktop) return null;

  return (
    <kbd
      className={cn(
        'inline-flex items-center justify-center min-w-[1.25rem] px-1 py-0.5',
        'text-[10px] font-mono font-medium leading-none',
        'rounded bg-foreground/10 text-muted-foreground border border-border/50',
        className
      )}
    >
      {shortcut}
    </kbd>
  );
}
