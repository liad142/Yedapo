'use client';

import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { springBouncy } from '@/lib/motion';
import {
  Heart,
  BookOpen,
  Sparkles,
  ExternalLink,
  Target,
  Clock,
  AlertCircle,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import {
  SoundWaveAnimation,
  ParticleGemAnimation,
  GemCompleteAnimation,
  QueuePositionIndicator,
} from '@/components/animations';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { YouTubeLogo } from '@/components/YouTubeLogo';
import { extractYouTubeVideoId } from '@/lib/youtube/utils';
import { InlinePlayButton } from '@/components/PlayButton';
import { DiscoverySummarizeButton } from './DiscoverySummarizeButton';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useEpisodeLookup } from '@/contexts/EpisodeLookupContext';
import { useSummarizeQueueOptional } from '@/contexts/SummarizeQueueContext';
import { useUsage } from '@/contexts/UsageContext';
import { useRouter } from 'next/navigation';
import { cn, stripHtml } from '@/lib/utils';
import posthog from 'posthog-js';

export interface KnowledgeCardProps {
  // Identity
  id: string;
  type: 'podcast' | 'youtube';
  title: string;
  description: string;

  // Source
  sourceName: string;
  sourceArtwork: string;
  sourceId: string;
  sourceAppleId?: string | null;

  // Metadata
  publishedAt: Date | string;
  duration?: number;
  url?: string;

  // Summary preview
  summaryPreview?: {
    hookHeadline?: string;
    executiveBrief?: string;
    tags?: string[];
    takeawayCount?: number;
    chapterCount?: number;
    readTimeMinutes?: number;
  };
  summaryStatus?: 'none' | 'loading' | 'transcribing' | 'summarizing' | 'ready' | 'failed';

  // Personalization
  recommendReason?: string;

  // State
  bookmarked?: boolean;
  episodeId?: string;

  // Audio (podcast only)
  audioUrl?: string;

  // Curiosity mode podcast data (enables full DiscoverySummarizeButton)
  podcastFeedData?: {
    externalPodcastId: string;
    podcastArtist: string;
    podcastFeedUrl?: string;
  };

  // Callbacks
  onSave?: (id: string, saved: boolean) => void;
  onSummarize?: () => void;
}

function formatDate(date: Date | string): string {
  const d = date instanceof Date ? date : new Date(date);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDuration(seconds?: number): string | null {
  if (!seconds) return null;
  const mins = Math.floor(seconds / 60);
  if (mins >= 60) {
    const hrs = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    return `${hrs}h ${remainingMins}m`;
  }
  return `${mins}min`;
}

function estimateReadTime(
  duration?: number,
  readTimeMinutes?: number,
): number | null {
  if (readTimeMinutes) return readTimeMinutes;
  if (duration) return Math.ceil(duration / 60 / 4);
  return null;
}

function cleanYoutubeDescription(raw: string): string {
  if (!raw) return '';
  const lines = raw.split('\n').filter(l => l.trim().length > 0);
  const kept = lines
    .slice(0, 3)
    .filter(line => !line.match(/https?:\/\//))
    .join(' ')
    .trim();
  if (kept.length < 20) return '';
  return kept.length > 200 ? kept.slice(0, 197) + '...' : kept;
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

export const KnowledgeCard = React.memo(function KnowledgeCard({
  id,
  type,
  title,
  description,
  sourceName,
  sourceArtwork,
  sourceId,
  sourceAppleId,
  publishedAt,
  duration,
  url,
  summaryPreview,
  summaryStatus = 'none',
  recommendReason,
  episodeId,
  audioUrl,
  podcastFeedData,
  onSummarize,
}: KnowledgeCardProps) {
  const { user, setShowAuthModal } = useAuth();
  const { isSubscribed: checkSubscribed, subscribe, unsubscribe } = useSubscription();
  const { registerLookup, getLookupResult, isLoading: isLookupLoading } = useEpisodeLookup();
  const summarizeQueue = useSummarizeQueueOptional();
  const { incrementSummary } = useUsage();
  const router = useRouter();
  const [isToggling, setIsToggling] = useState(false);
  const [localSummaryStatus, setLocalSummaryStatus] = useState(summaryStatus);
  const [localEpisodeId, setLocalEpisodeId] = useState(episodeId);
  const [localError, setLocalError] = useState<string | null>(null);
  const [localSummaryPreview, setLocalSummaryPreview] = useState(summaryPreview);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);
  const fetchedPreviewRef = useRef(false);

  // Cleanup polling on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, []);

  // Sync YouTube queue state into local status so the card reflects queue progress
  const youtubeQueueItem = localEpisodeId && type === 'youtube' && summarizeQueue
    ? summarizeQueue.getQueueItem(localEpisodeId)
    : null;
  const youtubeQueuePosition = localEpisodeId && type === 'youtube' && summarizeQueue
    ? summarizeQueue.getQueuePosition(localEpisodeId)
    : -1;

  useEffect(() => {
    if (!youtubeQueueItem || type !== 'youtube') return;
    const qState = youtubeQueueItem.state;
    if (qState === 'ready') {
      setLocalSummaryStatus('ready');
    } else if (qState === 'failed') {
      setLocalSummaryStatus('failed');
      setLocalError(youtubeQueueItem.error || 'Oops! No transcript available for this video. It may not have subtitles enabled.');
    } else if (qState === 'summarizing') {
      setLocalSummaryStatus('summarizing');
    } else if (qState === 'transcribing') {
      setLocalSummaryStatus('transcribing');
    } else if (qState === 'queued') {
      setLocalSummaryStatus('transcribing');
    }
  }, [youtubeQueueItem?.state, type]);

  // Poll YouTube summary status until ready/failed, then redirect
  const pollYouTubeStatus = useCallback((epId: string) => {
    let attempts = 0;
    const maxAttempts = 120; // ~10 min max with 5s intervals

    const poll = async () => {
      if (!isMountedRef.current) return;
      attempts++;
      if (attempts > maxAttempts) {
        if (isMountedRef.current) setLocalSummaryStatus('failed');
        return;
      }
      try {
        const res = await fetch(`/api/episodes/${epId}/summaries`);
        if (!isMountedRef.current) return;
        if (!res.ok) {
          pollRef.current = setTimeout(poll, 5000);
          return;
        }
        const data = await res.json();
        if (!isMountedRef.current) return;
        const quick = data.summaries?.quick;
        const deep = data.summaries?.deep;

        // Only redirect when DEEP summary is ready — that's the full experience
        if (deep?.status === 'ready') {
          setLocalSummaryStatus('ready');
          // Brief delay so the user sees the completion animation
          setTimeout(() => {
            if (isMountedRef.current) router.push(`/episode/${epId}/insights`);
          }, 800);
          return;
        }
        // Both failed = failed
        if (deep?.status === 'failed' && (!quick || quick.status === 'failed' || quick.status === 'ready')) {
          setLocalSummaryStatus('failed');
          return;
        }
        // Show progress based on the current stage
        if (deep?.status === 'summarizing' || quick?.status === 'summarizing') {
          setLocalSummaryStatus('summarizing');
        } else if (deep?.status === 'transcribing' || quick?.status === 'transcribing' || data.transcript?.status === 'processing') {
          setLocalSummaryStatus('transcribing');
        } else if (deep?.status === 'queued' || quick?.status === 'queued') {
          setLocalSummaryStatus('transcribing');
        }
        pollRef.current = setTimeout(poll, 4000 + Math.random() * 2000);
      } catch {
        if (isMountedRef.current) pollRef.current = setTimeout(poll, 5000);
      }
    };
    poll();
  }, [router]);

  // Subscription uses the Apple ID when available
  const subscriptionId = sourceAppleId || sourceId;
  const isFollowed = type === 'podcast' && checkSubscribed(subscriptionId);

  // For episodes without a known summary status, check via batch lookup
  // YouTube: url is the watch URL stored as audio_url in DB
  // Podcast: audioUrl is the audio file URL
  const lookupUrl = type === 'youtube' ? url : audioUrl;

  useEffect(() => {
    if (lookupUrl && summaryStatus !== 'ready' && !episodeId) {
      registerLookup(lookupUrl);
    }
  }, [lookupUrl, summaryStatus, episodeId, registerLookup]);

  const lookupResult = lookupUrl ? getLookupResult(lookupUrl) : undefined;

  useEffect(() => {
    if (lookupResult) {
      if (lookupResult.episodeId && !localEpisodeId) {
        setLocalEpisodeId(lookupResult.episodeId);
      }
      if (lookupResult.summaryStatus === 'ready' && localSummaryStatus !== 'ready') {
        setLocalSummaryStatus('ready');
      }
      // Resume polling for in-progress YouTube summaries (survives navigation)
      const inProgressStatuses = ['transcribing', 'summarizing', 'queued'];
      if (
        lookupResult.episodeId &&
        inProgressStatuses.includes(lookupResult.summaryStatus) &&
        localSummaryStatus !== 'ready' &&
        localSummaryStatus !== 'failed' &&
        !pollRef.current // don't double-poll
      ) {
        setLocalSummaryStatus(
          lookupResult.summaryStatus === 'summarizing' ? 'summarizing' : 'transcribing'
        );
        pollYouTubeStatus(lookupResult.episodeId);
      }
    }
  }, [lookupResult, localEpisodeId, localSummaryStatus, pollYouTubeStatus]);

  // Fetch summary preview when status is ready but preview data is missing
  const epIdForPreview = localEpisodeId || episodeId;
  const previewIsEmpty = !localSummaryPreview?.hookHeadline && !localSummaryPreview?.executiveBrief;
  useEffect(() => {
    if (localSummaryStatus !== 'ready' || !previewIsEmpty || !epIdForPreview || fetchedPreviewRef.current) return;
    fetchedPreviewRef.current = true;
    fetch(`/api/episodes/${epIdForPreview}/insights`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data?.summaries?.quick?.content) return;
        const q = data.summaries.quick.content;
        setLocalSummaryPreview({
          hookHeadline: q.hook_headline,
          executiveBrief: q.executive_brief,
          tags: q.tags,
        });
      })
      .catch(() => {});
  }, [localSummaryStatus, previewIsEmpty, epIdForPreview]);

  const artwork = isValidImageUrl(sourceArtwork)
    ? sourceArtwork.replace('100x100', '200x200')
    : '/placeholder-podcast.png';

  const sourceHref = type === 'youtube'
    ? (localEpisodeId ? `/episode/${localEpisodeId}/insights` : `/browse/youtube/${sourceId}`)
    : sourceAppleId
      ? `/browse/podcast/${sourceAppleId}`
      : `/browse/podcast/${sourceId}`;

  const effectivePreview = localSummaryPreview;
  const hasSummary = localSummaryStatus === 'ready' && effectivePreview && (effectivePreview.hookHeadline || effectivePreview.executiveBrief);
  const readTime = estimateReadTime(duration, effectivePreview?.readTimeMinutes);
  const durationStr = formatDuration(duration);

  // Build track for audio playback (podcast only)
  const track = useMemo(() => {
    if (type !== 'podcast' || !audioUrl) return null;
    return {
      id: localEpisodeId || id,
      title,
      artist: sourceName,
      artworkUrl: artwork,
      audioUrl,
      duration,
      podcastId: sourceId,
    };
  }, [type, audioUrl, localEpisodeId, id, title, sourceName, artwork, duration, sourceId]);

  const handleFollow = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      setShowAuthModal(true, 'Sign up to follow your favourite podcasts and never miss an episode.');
      return;
    }
    if (isToggling) return;

    setIsToggling(true);
    try {
      if (isFollowed) {
        await unsubscribe(subscriptionId);
      } else {
        await subscribe(subscriptionId);
      }
      posthog.capture(isFollowed ? 'podcast_unfollowed' : 'podcast_followed', {
        podcast_id: subscriptionId,
        podcast_name: sourceName,
      });
    } finally {
      setIsToggling(false);
    }
  };

  const handleSummarize = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setLocalError(null);

    if (localEpisodeId && localSummaryStatus === 'ready') {
      router.push(`/episode/${localEpisodeId}/insights`);
      return;
    }

    if (!user) {
      setShowAuthModal(true, 'Sign in to summarize content.');
      return;
    }

    if (localSummaryStatus === 'loading' || localSummaryStatus === 'transcribing' || localSummaryStatus === 'summarizing') return;

    // Retry from failed state
    if (localSummaryStatus === 'failed') {
      // Fall through to re-attempt
    }

    if (onSummarize) {
      onSummarize();
      return;
    }

    if (type === 'youtube') {
      // Phase 1: Import the YouTube video to get an episodeId
      setLocalSummaryStatus('loading');
      try {
        const res = await fetch(`/api/youtube/${id}/import`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title,
            description,
            channelId: sourceId,
            channelTitle: sourceName,
            thumbnailUrl: sourceArtwork,
            publishedAt,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          setLocalEpisodeId(data.episodeId);

          // Phase 2: Route through the queue — same as podcasts
          if (summarizeQueue) {
            summarizeQueue.addToQueue(data.episodeId);
            incrementSummary();
          } else {
            // Fallback: poll directly if queue context not available
            setLocalSummaryStatus('transcribing');
            pollYouTubeStatus(data.episodeId);
          }
        } else {
          const errBody = await res.json().catch(() => ({}));
          setLocalSummaryStatus('failed');
          if (res.status === 429) {
            setLocalError(errBody.message || 'Daily limit reached. Try again tomorrow.');
          } else if (res.status === 403) {
            setLocalError('Sign in required to summarize content.');
          } else {
            setLocalError(errBody.message || 'Failed to summarize. Please try again.');
          }
        }
      } catch {
        setLocalSummaryStatus('failed');
        setLocalError('Network error. Please check your connection.');
      }
    }
  };

  const handleSecondaryAction = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (type === 'youtube' && url) {
      posthog.capture('knowledge_card_watch', { content_id: id, title });
      window.open(url, '_blank', 'noopener,noreferrer');
    }
    // For podcast, InlinePlayButton handles its own click
  };

  // Collect visible stats
  const stats: string[] = [];
  if (effectivePreview?.takeawayCount && effectivePreview.takeawayCount > 0) {
    stats.push(`${effectivePreview.takeawayCount} takeaways`);
  }
  if (effectivePreview?.chapterCount && effectivePreview.chapterCount > 0) {
    stats.push(`${effectivePreview.chapterCount} chapters`);
  }
  if (readTime) {
    stats.push(`${readTime} min read`);
  }

  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="bg-card border border-border rounded-2xl shadow-[var(--shadow-1)] p-5 hover:shadow-[var(--shadow-2)] hover:border-border/80 transition-all duration-150"
    >
      {/* Top row: Artwork + Title + Meta + Save */}
      <div className="flex gap-4">
        {/* Artwork */}
        <Link
          href={sourceHref}
          className="relative w-14 h-14 rounded-full overflow-hidden border border-border flex-shrink-0 hover:opacity-80 transition-opacity"
          aria-label={`Go to ${sourceName}`}
        >
          <Image
            src={artwork}
            alt={sourceName}
            fill
            className="object-cover"
            sizes="56px"
          />
        </Link>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Title row */}
          <div className="flex items-start justify-between gap-2">
            {localSummaryStatus === 'ready' && localEpisodeId ? (
              <Link href={`/episode/${localEpisodeId}/insights`} onClick={(e) => e.stopPropagation()}>
                <h3 className="text-h4 text-foreground line-clamp-2 leading-snug hover:text-primary transition-colors cursor-pointer">
                  {title}
                </h3>
              </Link>
            ) : (
              <h3 className="text-h4 text-foreground line-clamp-2 leading-snug">
                {title}
              </h3>
            )}
            {/* Follow podcast */}
            {type === 'podcast' && (
              <motion.button
                onClick={handleFollow}
                disabled={isToggling}
                className={cn(
                  'p-1.5 rounded-full transition-all flex-shrink-0 cursor-pointer',
                  'hover:bg-secondary'
                )}
                aria-label={isFollowed ? 'Unfollow podcast' : 'Follow podcast'}
                whileTap={{ scale: 1.3 }}
                transition={springBouncy}
              >
                <Heart
                  className={cn(
                    'h-4 w-4',
                    isFollowed ? 'fill-current text-red-500' : 'text-muted-foreground',
                    isToggling && 'animate-pulse'
                  )}
                />
              </motion.button>
            )}
          </div>

          {/* Metadata row */}
          <div className="flex items-center gap-1.5 mt-0.5 text-body-sm text-muted-foreground flex-wrap">
            <Link
              href={sourceHref}
              className="hover:text-foreground transition-colors truncate max-w-[200px]"
            >
              {sourceName}
            </Link>
            <span>&#183;</span>
            <span>{formatDate(publishedAt)}</span>
            {durationStr && (
              <>
                <span>&#183;</span>
                <span>{durationStr}</span>
              </>
            )}
            {type === 'youtube' ? (
              <YouTubeLogo videoId={extractYouTubeVideoId(url)} size="xs" />
            ) : (
              <Badge className="ml-1 text-[10px] px-1.5 py-0 h-4 font-medium bg-blue-600/10 text-blue-600 border-blue-600/20">
                Podcast
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-border/50 my-3" />

      {/* Value preview section */}
      {hasSummary ? (
        <div className="space-y-2">
          {/* Hook headline */}
          {effectivePreview?.hookHeadline && (
            <p className="text-body-sm font-semibold text-foreground leading-snug line-clamp-2">
              &ldquo;{effectivePreview.hookHeadline}&rdquo;
            </p>
          )}

          {/* Executive brief as expandable description */}
          {effectivePreview?.executiveBrief && (
            <ExpandableCardDescription text={effectivePreview.executiveBrief} />
          )}

          {/* Takeaway bullets */}
          {effectivePreview?.tags && effectivePreview.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {effectivePreview.tags.slice(0, 3).map((tag) => (
                <Badge key={tag} variant="secondary" className="text-[10px] px-2 py-0.5">
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          {/* Recommend reason */}
          {recommendReason && (
            <p className="text-caption text-primary/80 italic">
              {recommendReason}
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-1.5">
          {/* Fallback: use executive brief from summary, or cleaned description, or prompt */}
          <ExpandableCardDescription
            text={
              effectivePreview?.executiveBrief
                || effectivePreview?.hookHeadline
                || (type === 'youtube' && localSummaryStatus !== 'ready'
                  ? cleanYoutubeDescription(description)
                  : stripHtml(description))
                || ''
            }
          />

          {/* Recommend reason */}
          {recommendReason && (
            <p className="text-caption text-primary/80 italic">
              {recommendReason}
            </p>
          )}
        </div>
      )}

      {/* Stats row */}
      {stats.length > 0 && (
        <>
          <div className="border-t border-border/50 my-3" />
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            {effectivePreview?.takeawayCount && effectivePreview.takeawayCount > 0 && (
              <span className="flex items-center gap-1">
                <Target className="h-3 w-3" />
                {effectivePreview.takeawayCount} takeaways
              </span>
            )}
            {effectivePreview?.chapterCount && effectivePreview.chapterCount > 0 && (
              <span className="flex items-center gap-1">
                <BookOpen className="h-3 w-3" />
                {effectivePreview.chapterCount} chapters
              </span>
            )}
            {readTime && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {readTime} min read
              </span>
            )}
          </div>
        </>
      )}

      {/* CTA row */}
      <div className="flex items-center gap-2 mt-3">
        {/* Primary CTA: Podcast with feed data → DiscoverySummarizeButton */}
        {type === 'podcast' && podcastFeedData ? (
          <DiscoverySummarizeButton
            externalEpisodeId={id}
            episodeTitle={title}
            episodeDescription={description}
            episodePublishedAt={typeof publishedAt === 'string' ? publishedAt : publishedAt.toISOString()}
            episodeDuration={duration}
            audioUrl={audioUrl}
            externalPodcastId={podcastFeedData.externalPodcastId}
            podcastName={sourceName}
            podcastArtist={podcastFeedData.podcastArtist}
            podcastArtwork={sourceArtwork}
            podcastFeedUrl={podcastFeedData.podcastFeedUrl}
          />
        ) : localSummaryStatus === 'ready' ? (
          <Button
            size="sm"
            onClick={() => {
              if (localEpisodeId) router.push(`/episode/${localEpisodeId}/insights`);
            }}
            className="rounded-full px-5 transition-all hover:scale-105 active:scale-95 bg-primary border-0 shadow-lg shadow-primary/20 hover:shadow-primary/40"
          >
            <GemCompleteAnimation className="h-5 w-5 mr-2" />
            View Summary
          </Button>
        ) : localSummaryStatus === 'transcribing' ? (
          <Button size="sm" disabled variant="outline" className="rounded-full px-5 transition-all">
            {type === 'youtube' && youtubeQueuePosition > 1 ? (
              <QueuePositionIndicator position={youtubeQueuePosition} />
            ) : (
              <>
                <SoundWaveAnimation className="h-5 mr-2" />
                <span className="text-xs">Transcribing...</span>
              </>
            )}
          </Button>
        ) : localSummaryStatus === 'summarizing' || localSummaryStatus === 'loading' ? (
          <Button size="sm" disabled variant="outline" className="rounded-full px-5 transition-all">
            <ParticleGemAnimation className="h-5 w-8 mr-2" />
            <span className="text-xs">Summarizing...</span>
          </Button>
        ) : localSummaryStatus === 'failed' ? (
          <Button
            size="sm"
            variant="destructive"
            onClick={handleSummarize}
            className="rounded-full px-5 transition-all hover:scale-105 active:scale-95"
          >
            <AlertCircle className="mr-2 h-4 w-4" />
            Failed
            <RefreshCw className="ml-2 h-3 w-3" />
          </Button>
        ) : lookupUrl && isLookupLoading(lookupUrl) ? (
          <Button size="sm" disabled variant="outline" className="rounded-full px-5 transition-all">
            <Loader2 className="h-4 w-4 animate-spin" />
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={handleSummarize}
            className="rounded-full px-5 transition-all hover:scale-105 active:scale-95 bg-primary border-0 shadow-lg shadow-primary/20 hover:shadow-primary/40"
          >
            <Sparkles className="mr-2 h-4 w-4 text-white fill-white/20" />
            <span className="font-semibold text-white">Summarize</span>
          </Button>
        )}

        {/* Secondary CTA */}
        {type === 'youtube' ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={handleSecondaryAction}
            className="gap-1.5 rounded-full"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Watch
          </Button>
        ) : track ? (
          <InlinePlayButton track={track} />
        ) : null}
      </div>

      {/* Error message */}
      {localError && localSummaryStatus === 'failed' && (
        <div className="mt-3 mx-4 mb-3 p-2.5 rounded-lg bg-destructive/10 border border-destructive/20 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
          <p className="text-xs text-destructive leading-relaxed">{localError}</p>
        </div>
      )}
    </motion.article>
  );
});

function ExpandableCardDescription({ text }: { text: string }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isClamped, setIsClamped] = useState(false);
  const ref = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (el) {
      setIsClamped(el.scrollHeight > el.clientHeight + 1);
    }
  }, [text]);

  if (!text) return null;

  return (
    <div>
      <p
        ref={ref}
        className={cn(
          'text-body-sm text-muted-foreground leading-relaxed',
          !isExpanded && 'line-clamp-2'
        )}
      >
        {text}
      </p>
      {isClamped && (
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsExpanded(!isExpanded); }}
          className="text-xs text-primary/70 hover:text-primary transition-colors duration-150 mt-0.5"
          aria-expanded={isExpanded}
        >
          {isExpanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  );
}
