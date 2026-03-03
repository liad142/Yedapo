'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { BookOpen, ArrowRight, Target, Clock } from 'lucide-react';

interface DailyMixCardProps {
  title: string;
  description: string;
  podcastName: string;
  podcastArtwork: string;
  publishedAt: Date;
  podcastId: string;
  podcastAppleId?: string | null;
  summaryPreview?: {
    tags?: string[];
    hookHeadline?: string;
    executiveBrief?: string;
    takeawayCount?: number;
    chapterCount?: number;
  };
  hasReadProgress?: boolean;
  onClick: () => void;
}

function isValidImageUrl(url: string): boolean {
  if (!url) return false;
  try {
    new URL(url);
    return true;
  } catch {
    return url.startsWith('/');
  }
}

function formatDate(date: Date): string {
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export const DailyMixCard = React.memo(function DailyMixCard({
  title,
  description,
  podcastName,
  podcastArtwork,
  publishedAt,
  podcastId,
  podcastAppleId,
  summaryPreview,
  hasReadProgress,
  onClick,
}: DailyMixCardProps) {
  const artwork = isValidImageUrl(podcastArtwork) ? podcastArtwork : '/placeholder-podcast.png';
  const podcastHref = podcastAppleId ? `/browse/podcast/${podcastAppleId}` : `/browse/podcast/${podcastId}`;

  // Value line: prefer hookHeadline, then executiveBrief, then raw description
  const valueLine = summaryPreview?.hookHeadline
    || summaryPreview?.executiveBrief
    || description;

  // Stats
  const statsItems: string[] = [];
  if (summaryPreview?.takeawayCount && summaryPreview.takeawayCount > 0) {
    statsItems.push(`${summaryPreview.takeawayCount} takeaways`);
  }
  if (summaryPreview?.chapterCount && summaryPreview.chapterCount > 0) {
    statsItems.push(`${summaryPreview.chapterCount} chapters`);
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
      className="relative w-[340px] h-[200px] rounded-2xl overflow-hidden flex-shrink-0 bg-card border border-border shadow-[var(--shadow-1)] cursor-pointer hover:shadow-[var(--shadow-2)] transition-all duration-150"
    >
      {/* Blurred Background */}
      <div className="absolute inset-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={artwork}
          alt=""
          className="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl opacity-30"
        />
        <div className="absolute inset-0 bg-card/80" />
      </div>

      {/* Content */}
      <div className="absolute inset-0 p-5 flex flex-col justify-between">
        {/* Top row: avatar, podcast name, date */}
        <div className="flex items-center gap-3">
          <Link
            href={podcastHref}
            onClick={(e) => e.stopPropagation()}
            className="relative w-12 h-12 rounded-full overflow-hidden border-2 border-border flex-shrink-0 hover:opacity-80 transition-opacity"
            aria-label={`Go to ${podcastName}`}
          >
            <Image
              src={artwork}
              alt={podcastName}
              fill
              className="object-cover"
              sizes="48px"
            />
          </Link>
          <div className="flex-1 min-w-0">
            <Link
              href={podcastHref}
              onClick={(e) => e.stopPropagation()}
              className="text-body-sm text-muted-foreground truncate block hover:text-foreground transition-colors"
            >
              {podcastName}
            </Link>
            <p className="text-caption text-muted-foreground">{formatDate(publishedAt)}</p>
          </div>
        </div>

        {/* Middle: episode title + value line + stats */}
        <div className="flex flex-col gap-1">
          <h3 className="text-h4 text-foreground line-clamp-2 leading-snug">
            {title}
          </h3>
          <p className="text-caption text-muted-foreground line-clamp-2 leading-relaxed">
            {valueLine}
          </p>
          {statsItems.length > 0 && (
            <div className="flex items-center gap-2.5 mt-0.5">
              {summaryPreview?.takeawayCount && summaryPreview.takeawayCount > 0 && (
                <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Target className="h-2.5 w-2.5" />
                  {summaryPreview.takeawayCount} takeaways
                </span>
              )}
              {summaryPreview?.chapterCount && summaryPreview.chapterCount > 0 && (
                <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <BookOpen className="h-2.5 w-2.5" />
                  {summaryPreview.chapterCount} chapters
                </span>
              )}
            </div>
          )}
        </div>

        {/* Bottom row: CTA */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-primary hover:bg-primary/90 transition-colors duration-200 rounded-full px-4 py-2 cursor-pointer">
            {hasReadProgress ? (
              <>
                <span className="text-xs font-semibold text-white tracking-wide">Continue</span>
                <ArrowRight className="h-3.5 w-3.5 text-white flex-shrink-0" />
              </>
            ) : (
              <>
                <BookOpen className="h-3.5 w-3.5 text-white flex-shrink-0" />
                <span className="text-xs font-semibold text-white tracking-wide">Read Summary</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});
