'use client';

import { useMemo } from 'react';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Chapter } from './ChapterScrubber';

// Compact chapter list for the expanded player view
export function PlayerChapters({
  chapters,
  currentTime,
  onSeek,
}: {
  chapters: Chapter[];
  currentTime: number;
  onSeek: (time: number) => void;
}) {
  // Find active chapter index
  const activeIndex = useMemo(() => {
    let active = -1;
    for (let i = 0; i < chapters.length; i++) {
      if (chapters[i].timestamp_seconds <= currentTime) active = i;
    }
    return active;
  }, [chapters, currentTime]);

  return (
    <div className="mt-4 pt-4 border-t border-border/30">
      <div className="flex items-center gap-1.5 mb-2">
        <Clock className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Chapters</span>
      </div>
      <div className="max-h-40 overflow-y-auto scrollbar-thin scrollbar-thumb-muted-foreground/20 space-y-0.5">
        {chapters.map((ch, i) => {
          const isActive = i === activeIndex;
          return (
            <button
              key={i}
              onClick={() => onSeek(ch.timestamp_seconds)}
              className={cn(
                'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition-colors',
                isActive
                  ? 'bg-primary/20 text-foreground'
                  : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
              )}
            >
              <span
                className={cn(
                  'text-[11px] font-mono tabular-nums px-1.5 py-0.5 rounded shrink-0',
                  isActive
                    ? 'bg-primary/30 text-primary-foreground'
                    : 'bg-secondary text-muted-foreground'
                )}
              >
                {ch.timestamp}
              </span>
              <span className="text-xs truncate">{ch.title}</span>
              {isActive && (
                <span className="text-[9px] font-bold text-primary uppercase tracking-wider shrink-0 ml-auto">
                  Now
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
