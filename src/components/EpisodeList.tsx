'use client';

import Link from 'next/link';
import { SafeImage } from '@/components/SafeImage';
import { SummarizeButton } from '@/components/SummarizeButton';
import { InlinePlayButton } from '@/components/PlayButton';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate, formatDuration } from '@/lib/formatters';
import { Calendar, Clock, FileText, Loader2, Sparkles } from 'lucide-react';
import type { PodcastDetailEpisode, SummaryAvailability } from '@/types/podcast';

interface EpisodeListProps {
  episodes: PodcastDetailEpisode[];
  podcastName: string;
  podcastArtworkUrl: string;
  getEpisodeSummaryInfo: (ep: PodcastDetailEpisode) => SummaryAvailability | null;
  onSummarize: (ep: PodcastDetailEpisode) => void;
  importingEpisodeId: string | null;
  isLoading: boolean;
  hasMore: boolean;
  isLoadingMore: boolean;
  totalCount: number;
  onLoadMore: () => void;
  variant?: 'card' | 'list';
  /** For browse page: auth gating on summarize button */
  onAuthGate?: () => void;
  user?: any;
}

export function EpisodeList({
  episodes,
  podcastName,
  podcastArtworkUrl,
  getEpisodeSummaryInfo,
  onSummarize,
  importingEpisodeId,
  isLoading,
  hasMore,
  isLoadingMore,
  totalCount,
  onLoadMore,
  variant = 'card',
  onAuthGate,
  user,
}: EpisodeListProps) {
  // --- Loading skeletons ---
  if (isLoading) {
    if (variant === 'card') {
      return (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-card rounded-2xl p-6 shadow-[var(--shadow-1)] border border-border">
              <div className="flex gap-4">
                <Skeleton className="w-12 h-12 rounded-lg shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-1/4" />
                  <Skeleton className="h-12 w-full" />
                </div>
              </div>
            </div>
          ))}
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="rounded-xl p-4 border border-border">
            <div className="flex gap-5">
              <Skeleton className="w-14 h-14 rounded-xl shrink-0" />
              <div className="flex-1 space-y-3">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-4 w-full" />
                <div className="flex gap-2">
                  <Skeleton className="h-8 w-24 rounded-full" />
                  <Skeleton className="h-8 w-24 rounded-full" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // --- Empty state ---
  if (episodes.length === 0) {
    if (variant === 'card') {
      return (
        <div className="text-center py-12 bg-card rounded-2xl shadow-[var(--shadow-1)] border border-border">
          <p className="text-muted-foreground mb-2">
            No episodes found.
          </p>
          <p className="text-sm text-muted-foreground/70">
            This might be a temporary issue. Try refreshing the page.
          </p>
        </div>
      );
    }

    return (
      <div className="text-center py-20 rounded-2xl border border-border">
        <div className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center mx-auto mb-4">
          <FileText className="h-8 w-8 text-muted-foreground" />
        </div>
        <p className="text-lg font-medium text-foreground mb-1">No episodes found</p>
        <p className="text-muted-foreground">Check back later for new content.</p>
      </div>
    );
  }

  // --- Episode list ---
  return (
    <div className={variant === 'card' ? 'space-y-4' : 'space-y-1'}>
      {episodes.map((episode) => {
        const summaryInfo = getEpisodeSummaryInfo(episode);
        const hasSummary = summaryInfo?.hasQuickSummary || summaryInfo?.hasDeepSummary;
        const canNavigate = summaryInfo?.episodeId;

        if (variant === 'card') {
          return (
            <CardEpisodeItem
              key={episode.id}
              episode={episode}
              summaryInfo={summaryInfo}
              hasSummary={hasSummary}
              canNavigate={canNavigate}
              podcastName={podcastName}
              podcastArtworkUrl={podcastArtworkUrl}
              onSummarize={onSummarize}
              importingEpisodeId={importingEpisodeId}
            />
          );
        }

        return (
          <ListEpisodeItem
            key={episode.id}
            episode={episode}
            summaryInfo={summaryInfo}
            hasSummary={hasSummary}
            canNavigate={canNavigate}
            podcastName={podcastName}
            podcastArtworkUrl={podcastArtworkUrl}
            onSummarize={onSummarize}
            importingEpisodeId={importingEpisodeId}
            onAuthGate={onAuthGate}
            user={user}
          />
        );
      })}

      {/* Load More */}
      {hasMore && (
        <div className={variant === 'card' ? 'mt-8 text-center' : 'mt-12 text-center pb-12'}>
          <Button
            onClick={onLoadMore}
            disabled={isLoadingMore}
            variant="outline"
            className={variant === 'card' ? 'rounded-full px-8' : 'rounded-full px-8 h-10'}
          >
            {isLoadingMore ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {variant === 'card' ? 'Loading...' : 'Loading episodes...'}
              </>
            ) : (
              variant === 'card'
                ? `Load More (${episodes.length} of ${totalCount})`
                : 'Load More Episodes'
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

// ---------- Card variant (subscribed /podcast/[id]) ----------

interface EpisodeItemProps {
  episode: PodcastDetailEpisode;
  summaryInfo: SummaryAvailability | null;
  hasSummary: boolean | undefined;
  canNavigate: string | null | undefined;
  podcastName: string;
  podcastArtworkUrl: string;
  onSummarize: (ep: PodcastDetailEpisode) => void;
  importingEpisodeId: string | null;
  onAuthGate?: () => void;
  user?: any;
}

function CardEpisodeItem({
  episode,
  summaryInfo,
  hasSummary,
  canNavigate,
  podcastName,
  podcastArtworkUrl,
  onSummarize,
  importingEpisodeId,
}: EpisodeItemProps) {
  return (
    <div className="group bg-card rounded-2xl p-6 shadow-[var(--shadow-1)] hover:shadow-[var(--shadow-2)] transition-all duration-300 border border-border">
      <div className="flex gap-5 items-start">
        {/* Thumbnail */}
        {episode.artworkUrl && (
          <div className="relative w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 bg-secondary shadow-inner hidden sm:block">
            <SafeImage
              src={episode.artworkUrl.replace('100x100', '200x200')}
              alt={episode.title}
              fill
              className="object-cover"
            />
          </div>
        )}

        <div className="flex-1 min-w-0 space-y-2">
          {/* Meta Top Line */}
          <div className="flex items-center gap-3 text-xs font-medium text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {formatDate(episode.publishedAt)}
            </span>
            {episode.duration > 0 && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatDuration(episode.duration)}
              </span>
            )}
          </div>

          {/* Title */}
          {canNavigate ? (
            <Link href={`/episode/${summaryInfo!.episodeId}`}>
              <h3 className="text-lg font-bold text-foreground leading-tight group-hover:text-primary transition-colors cursor-pointer">
                {episode.title}
              </h3>
            </Link>
          ) : (
            <h3 className="text-lg font-bold text-foreground leading-tight">
              {episode.title}
            </h3>
          )}

          {/* Description */}
          <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
            {episode.description}
          </p>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            {episode.isFromDb || summaryInfo?.episodeId ? (
              <SummarizeButton
                episodeId={episode.isFromDb ? episode.id : summaryInfo!.episodeId!}
                initialStatus={
                  hasSummary ? 'ready' :
                    (() => {
                      const status = summaryInfo?.deepStatus || summaryInfo?.quickStatus;
                      if (status === 'transcribing') return 'transcribing' as const;
                      if (status === 'summarizing') return 'summarizing' as const;
                      if (status === 'queued') return 'queued' as const;
                      if (status === 'failed') return 'failed' as const;
                      return 'not_ready' as const;
                    })()
                }
              />
            ) : (
              <Button
                className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 border-0 rounded-full h-9 px-5"
                size="sm"
                onClick={() => onSummarize(episode)}
                disabled={importingEpisodeId === episode.id}
              >
                {importingEpisodeId === episode.id ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                    Importing
                  </>
                ) : (
                  <>
                    <FileText className="h-3.5 w-3.5 mr-2" />
                    Summarize
                  </>
                )}
              </Button>
            )}

            {episode.audioUrl && (
              <div className="scale-90 origin-left">
                <InlinePlayButton
                  track={{
                    id: summaryInfo?.episodeId || episode.id,
                    title: episode.title,
                    artist: podcastName,
                    artworkUrl: episode.artworkUrl || podcastArtworkUrl,
                    audioUrl: episode.audioUrl,
                    duration: episode.duration,
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- List variant (browse /browse/podcast/[id]) ----------

function ListEpisodeItem({
  episode,
  summaryInfo,
  hasSummary,
  canNavigate,
  podcastName,
  podcastArtworkUrl,
  onSummarize,
  importingEpisodeId,
  onAuthGate,
  user,
}: EpisodeItemProps) {
  const handleSummarizeClick = (ep: PodcastDetailEpisode) => {
    if (onAuthGate && !user) {
      onAuthGate();
      return;
    }
    onSummarize(ep);
  };

  return (
    <div
      className="group py-4 border-b border-border hover:bg-secondary rounded-xl px-4 -mx-4 transition-colors cursor-pointer"
    >
      <div className="flex gap-4 items-start">
        {/* Episode Thumbnail */}
        <div className="shrink-0 hidden sm:block">
          <div className="w-14 h-14 rounded-lg bg-secondary border border-border overflow-hidden relative">
            {episode.artworkUrl ? (
              <SafeImage
                src={episode.artworkUrl.replace('100x100', '200x200')}
                alt={episode.title}
                fill
                className="object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                <FileText className="h-5 w-5" />
              </div>
            )}
            {/* Summary-ready indicator */}
            {hasSummary && (
              <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-green-500" />
            )}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          {/* Meta Row */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground mb-1.5">
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {formatDate(episode.publishedAt)}
            </span>
            {episode.duration > 0 && (
              <>
                <span className="w-px h-3 bg-border" />
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatDuration(episode.duration)}
                </span>
              </>
            )}
            {/* Summary dot on mobile (no thumbnail) */}
            {hasSummary && (
              <span className="sm:hidden w-2 h-2 rounded-full bg-green-500 shrink-0" />
            )}
          </div>

          {/* Title */}
          {canNavigate ? (
            <Link href={`/episode/${summaryInfo!.episodeId}`}>
              <h3 className="text-base font-semibold text-foreground leading-tight mb-1.5 group-hover:text-primary transition-colors line-clamp-2">
                {episode.title}
              </h3>
            </Link>
          ) : (
            <h3 className="text-base font-semibold text-foreground leading-tight mb-1.5 line-clamp-2">
              {episode.title}
            </h3>
          )}

          {/* Description */}
          <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2 mb-3">
            {episode.description}
          </p>

          {/* Action Bar */}
          <div className="flex items-center gap-2">
            {/* Play */}
            {episode.audioUrl && (
              <InlinePlayButton
                track={{
                  id: summaryInfo?.episodeId || episode.id,
                  title: episode.title,
                  artist: podcastName,
                  artworkUrl: episode.artworkUrl || podcastArtworkUrl,
                  audioUrl: episode.audioUrl,
                  duration: episode.duration,
                }}
                className="shrink-0 px-5 text-sm"
              />
            )}

            {/* Summarize */}
            {(() => {
              const getInitialStatus = (): any => {
                if (hasSummary) return 'ready';
                const status = summaryInfo?.deepStatus || summaryInfo?.quickStatus;
                if (status === 'transcribing') return 'transcribing';
                if (status === 'summarizing') return 'summarizing';
                if (status === 'queued') return 'queued';
                if (status === 'failed') return 'failed';
                return 'not_ready';
              };

              if (summaryInfo?.episodeId) {
                return (
                  <SummarizeButton
                    episodeId={summaryInfo.episodeId}
                    initialStatus={getInitialStatus()}
                  />
                );
              }

              return (
                <Button
                  className="gap-2 rounded-full px-5 bg-primary text-primary-foreground hover:bg-primary/90 transition-all"
                  size="sm"
                  onClick={() => handleSummarizeClick(episode)}
                  disabled={importingEpisodeId === episode.id}
                >
                  {importingEpisodeId === episode.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  {importingEpisodeId === episode.id ? 'Importing...' : 'Summarize'}
                </Button>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}
