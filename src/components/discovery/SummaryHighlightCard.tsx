'use client';

import Link from 'next/link';
import { Lightbulb, BookOpen, Target, ArrowRight } from 'lucide-react';
import type { QuickSummaryContent, DeepSummaryContent } from '@/types/database';

interface SummaryHighlightCardProps {
  episodeId: string;
  quickSummary?: QuickSummaryContent | null;
  deepSummary?: DeepSummaryContent | null;
  className?: string;
}

export function SummaryHighlightCard({
  episodeId,
  quickSummary,
  deepSummary,
  className = '',
}: SummaryHighlightCardProps) {
  if (!quickSummary && !deepSummary) return null;

  const headline = quickSummary?.hook_headline;
  const takeaways = deepSummary?.actionable_takeaways?.slice(0, 3) ?? [];
  const rawChapters = deepSummary?.chronological_breakdown;
  const chapterCount = !rawChapters?.length ? 0
    : (rawChapters[0]?.timestamp_seconds ?? 0) > 0
      ? rawChapters.length + 1
      : rawChapters.length;
  const conceptCount = deepSummary?.core_concepts?.length ?? 0;
  const hasTakeaways = takeaways.length > 0;
  const totalTakeaways = deepSummary?.actionable_takeaways?.length ?? 0;

  return (
    <div className={`rounded-xl border border-border bg-card/50 p-4 space-y-3 ${className}`}>
      {/* Hook headline */}
      {headline && (
        <p className="text-sm font-semibold text-foreground leading-snug line-clamp-2">
          {headline}
        </p>
      )}

      {/* Takeaways preview with fade */}
      {hasTakeaways && (
        <div className="relative">
          <ul className="space-y-1.5">
            {takeaways.map((item, i) => {
              const text = typeof item === 'string' ? item : item.text;
              const isLast = i === takeaways.length - 1 && totalTakeaways > 3;
              return (
                <li
                  key={i}
                  className={`flex gap-2 text-xs text-muted-foreground leading-relaxed ${
                    isLast ? 'opacity-50' : ''
                  }`}
                >
                  <span className="text-primary flex-shrink-0 mt-0.5">&#8226;</span>
                  <span className="line-clamp-1">{text}</span>
                </li>
              );
            })}
          </ul>
          {totalTakeaways > 3 && (
            <div
              className="absolute bottom-0 left-0 right-0 h-6 pointer-events-none"
              style={{
                background: 'linear-gradient(to bottom, transparent, hsl(var(--card)))',
              }}
            />
          )}
        </div>
      )}

      {/* Stats row */}
      {(chapterCount > 0 || conceptCount > 0) && (
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          {chapterCount > 0 && (
            <span className="flex items-center gap-1">
              <BookOpen className="h-3 w-3" />
              {chapterCount} chapters
            </span>
          )}
          {conceptCount > 0 && (
            <span className="flex items-center gap-1">
              <Lightbulb className="h-3 w-3" />
              {conceptCount} concepts
            </span>
          )}
          {totalTakeaways > 0 && (
            <span className="flex items-center gap-1">
              <Target className="h-3 w-3" />
              {totalTakeaways} takeaways
            </span>
          )}
        </div>
      )}

      {/* CTA */}
      <Link
        href={`/episode/${episodeId}/insights`}
        className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors group cursor-pointer"
      >
        Explore Full Insights
        <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
      </Link>
    </div>
  );
}
