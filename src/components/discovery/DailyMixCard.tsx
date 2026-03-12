'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { BookOpen, ArrowRight, Target, Layers } from 'lucide-react';
import { stripHtml } from '@/lib/utils';

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
  if (diffDays < 7) return `${diffDays}d ago`;
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

  const valueLine = summaryPreview?.hookHeadline
    || summaryPreview?.executiveBrief
    || stripHtml(description);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
      className="group relative w-[320px] h-[220px] rounded-2xl overflow-hidden flex-shrink-0 bg-card border border-border shadow-[var(--shadow-1)] cursor-pointer hover:shadow-[var(--shadow-floating)] hover:border-primary/30 transition-all duration-200"
    >
      {/* Artwork ambient glow — top portion only */}
      <div className="absolute inset-x-0 top-0 h-28 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={artwork}
          alt=""
          className="absolute inset-0 w-full h-full object-cover scale-125 blur-2xl opacity-40 dark:opacity-50"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-card/60 via-card/80 to-card" />
      </div>

      {/* Content */}
      <div className="relative p-4 h-full flex flex-col">
        {/* Top row: podcast info + date */}
        <div className="flex items-center gap-2.5">
          <Link
            href={podcastHref}
            onClick={(e) => e.stopPropagation()}
            className="relative w-10 h-10 rounded-xl overflow-hidden border border-border/60 flex-shrink-0 hover:opacity-80 transition-opacity shadow-sm"
            aria-label={`Go to ${podcastName}`}
          >
            <Image
              src={artwork}
              alt={podcastName}
              fill
              className="object-cover"
              sizes="40px"
            />
          </Link>
          <div className="flex-1 min-w-0">
            <Link
              href={podcastHref}
              onClick={(e) => e.stopPropagation()}
              className="text-body-sm font-medium text-foreground truncate block hover:text-primary transition-colors leading-tight"
            >
              {podcastName}
            </Link>
            <p className="text-xs text-muted-foreground mt-0.5">{formatDate(publishedAt)}</p>
          </div>
        </div>

        {/* Middle: title + description — fills available space */}
        <div className="flex-1 flex flex-col gap-1 mt-3 min-h-0">
          <h3 className="text-[15px] font-semibold text-foreground line-clamp-2 leading-snug tracking-tight">
            {title}
          </h3>
          <p className="text-body-sm text-muted-foreground line-clamp-2 leading-relaxed">
            {valueLine}
          </p>
        </div>

        {/* Bottom row: stats + CTA — always pinned to bottom */}
        <div className="flex items-center justify-between pt-2 mt-auto border-t border-border/50">
          {/* Stats */}
          <div className="flex items-center gap-3">
            {summaryPreview?.takeawayCount && summaryPreview.takeawayCount > 0 && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Target className="h-3 w-3 text-primary/60" />
                {summaryPreview.takeawayCount}
              </span>
            )}
            {summaryPreview?.chapterCount && summaryPreview.chapterCount > 0 && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Layers className="h-3 w-3 text-primary/60" />
                {summaryPreview.chapterCount}
              </span>
            )}
          </div>

          {/* CTA */}
          <div className="flex items-center gap-1.5 text-primary group-hover:gap-2 transition-all duration-200">
            {hasReadProgress ? (
              <>
                <span className="text-xs font-semibold">Continue</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </>
            ) : (
              <>
                <BookOpen className="h-3.5 w-3.5" />
                <span className="text-xs font-semibold">Read Summary</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});
