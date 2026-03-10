'use client';

import Link from 'next/link';
import { SafeImage } from '@/components/SafeImage';
import { SummarizeButton } from '@/components/SummarizeButton';
import { InlinePlayButton } from '@/components/PlayButton';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate, formatDuration } from '@/lib/formatters';
import { Calendar, Check, Clock, FileText, Loader2, Sparkles } from 'lucide-react';
import { useAudioPlayerSafe } from '@/contexts/AudioPlayerContext';
import { useListeningProgressBatch, type EpisodeProgress } from '@/hooks/useListeningProgress';
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
  /** ISO date string: episodes newer than this date show a "new" indicator */
  newEpisodesSince?: string;
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
  newEpisodesSince,
}: EpisodeListProps) {
  // Hooks must be called before any early returns
  const episodeProgressIds = episodes.map(ep => {
    const info = getEpisodeSummaryInfo(ep);
    return info?.episodeId || ep.id;
  }).filter((id): id is string => !!id);
  const progressMap = useListeningProgressBatch(episodeProgressIds);
  const playerState = useAudioPlayerSafe();

  // --- Loading skeletons ---
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex gap-4 p-4 rounded-2xl border border-border bg-card">
            <div className="flex-1 space-y-3">
              <Skeleton className="h-3.5 w-32" />
              <Skeleton className="h-5 w-4/5" />
              <Skeleton className="h-4 w-full" />
              <div className="flex gap-2 pt-1">
                <Skeleton className="h-9 w-20 rounded-full" />
                <Skeleton className="h-9 w-28 rounded-full" />
              </div>
            </div>
            <Skeleton className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl shrink-0" />
          </div>
        ))}
      </div>
    );
  }

  // --- Empty state ---
  if (episodes.length === 0) {
    return (
      <div className="text-center py-20 rounded-2xl border border-border bg-card">
        <div className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center mx-auto mb-4">
          <FileText className="h-8 w-8 text-muted-foreground" />
        </div>
        <p className="text-lg font-medium text-foreground mb-1">No episodes found</p>
        <p className="text-muted-foreground">Check back later for new content.</p>
      </div>
    );
  }

  // --- Episode list ---
  // Merge live progress for currently playing episode
  const mergedProgress = { ...progressMap };
  if (playerState?.currentTrack?.id && playerState.isPlaying) {
    const trackId = playerState.currentTrack.id;
    const wasCompleted = progressMap[trackId]?.completed ?? false;
    const nowCompleted = playerState.duration > 0 && playerState.currentTime / playerState.duration >= 0.95;
    mergedProgress[trackId] = {
      currentTime: playerState.currentTime,
      duration: playerState.duration,
      fraction: playerState.duration > 0 ? playerState.currentTime / playerState.duration : 0,
      completed: nowCompleted || wasCompleted,
    };
  }

  return (
    <div className="space-y-2">
      {episodes.map((episode) => {
        const summaryInfo = getEpisodeSummaryInfo(episode);
        const hasSummary = summaryInfo?.hasQuickSummary || summaryInfo?.hasDeepSummary;
        const canNavigate = summaryInfo?.episodeId;

        const isNew = newEpisodesSince && episode.publishedAt
          ? new Date(episode.publishedAt) > new Date(newEpisodesSince)
          : false;

        const episodeId = summaryInfo?.episodeId || episode.id;
        const progress = mergedProgress[episodeId] || null;

        return (
          <EpisodeItem
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
            variant={variant}
            isNew={isNew}
            progress={progress}
          />
        );
      })}

      {/* Load More */}
      {hasMore && (
        <div className="mt-8 text-center pb-4">
          <Button
            onClick={onLoadMore}
            disabled={isLoadingMore}
            variant="outline"
            className="rounded-full px-8 h-10"
          >
            {isLoadingMore ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Loading...
              </>
            ) : (
              `Load More (${episodes.length} of ${totalCount})`
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

// ---------- Unified episode item ----------

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
  variant: 'card' | 'list';
  isNew?: boolean;
  progress: EpisodeProgress | null;
}

function EpisodeItem({
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
  variant,
  isNew,
  progress,
}: EpisodeItemProps) {
  const handleSummarizeClick = (ep: PodcastDetailEpisode) => {
    if (onAuthGate && !user) {
      onAuthGate();
      return;
    }
    onSummarize(ep);
  };

  const artworkSrc = episode.artworkUrl || podcastArtworkUrl;

  return (
    <div className="group relative rounded-2xl hover:bg-secondary/50 transition-colors duration-200 cursor-pointer">
      <div className="flex gap-4 p-4 items-start">
        {/* Left: Text content */}
        <div className="flex-1 min-w-0 space-y-1.5">
          {/* Meta line */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {isNew && (
              <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400 font-medium">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                NEW
              </span>
            )}
            <span>{formatDate(episode.publishedAt)}</span>
            {episode.duration > 0 && (
              <>
                <span className="text-border">&#8226;</span>
                <span>{formatDuration(episode.duration)}</span>
              </>
            )}
            {hasSummary && (
              <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                Summary
              </span>
            )}
          </div>

          {/* Title */}
          {canNavigate ? (
            <Link href={`/episode/${summaryInfo!.episodeId}`}>
              <h3 className="text-[15px] font-semibold text-foreground leading-snug group-hover:text-primary transition-colors line-clamp-2">
                {episode.title}
              </h3>
            </Link>
          ) : (
            <h3 className="text-[15px] font-semibold text-foreground leading-snug line-clamp-2">
              {episode.title}
            </h3>
          )}

          {/* Description */}
          <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
            {episode.description}
          </p>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-1.5">
            {episode.audioUrl && (
              <InlinePlayButton
                track={{
                  id: summaryInfo?.episodeId || episode.id,
                  title: episode.title,
                  artist: podcastName,
                  artworkUrl: artworkSrc,
                  audioUrl: episode.audioUrl,
                  duration: episode.duration,
                }}
                className="shrink-0"
              />
            )}

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

              if (episode.isFromDb || summaryInfo?.episodeId) {
                return (
                  <SummarizeButton
                    episodeId={episode.isFromDb ? episode.id : summaryInfo!.episodeId!}
                    initialStatus={getInitialStatus()}
                  />
                );
              }

              return (
                <Button
                  className="gap-2 rounded-full px-5 bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-sm"
                  size="sm"
                  onClick={() => handleSummarizeClick(episode)}
                  disabled={importingEpisodeId === episode.id}
                >
                  {importingEpisodeId === episode.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                  {importingEpisodeId === episode.id ? 'Importing...' : 'Summarize'}
                </Button>
              );
            })()}
          </div>
        </div>

        {/* Right: Episode artwork */}
        <div className="shrink-0 self-center">
          <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden bg-secondary shadow-sm">
            {artworkSrc ? (
              <SafeImage
                src={artworkSrc.replace('100x100', '300x300')}
                alt={episode.title}
                fill
                className="object-cover"
                sizes="(min-width: 640px) 96px, 80px"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                <FileText className="h-6 w-6" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Subtle bottom separator */}
      <div className="mx-4 border-b border-border/60" />

      {/* Listening progress bar */}
      {progress && progress.currentTime > 0 && (
        <div className="mx-4 -mt-px pb-1">
          {progress.completed ? (
            <div className="flex items-center gap-1.5 py-1.5">
              <Check className="h-3.5 w-3.5 text-green-500" />
              <span className="text-xs font-medium text-green-500">Finished</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 py-1.5">
              <div className="flex-1 h-1 rounded-full bg-secondary overflow-hidden">
                <div
                  className="h-full rounded-full bg-green-500 transition-all duration-300"
                  style={{ width: `${Math.min(progress.fraction * 100, 100)}%` }}
                />
              </div>
              <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                {formatTimeLeft(progress.duration - progress.currentTime)}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function formatTimeLeft(seconds: number): string {
  if (seconds <= 0) return 'Finished';
  if (seconds < 60) return '<1min left';
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins}min left`;
  const hrs = Math.floor(mins / 60);
  const remainMins = mins % 60;
  return remainMins > 0 ? `${hrs}h ${remainMins}m left` : `${hrs}h left`;
}
