'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { KnowledgeCard } from './KnowledgeCard';
import type { KnowledgeCardProps } from './KnowledgeCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useCountry } from '@/contexts/CountryContext';
import { cn } from '@/lib/utils';
import posthog from 'posthog-js';
import { createLogger } from '@/lib/logger';

const log = createLogger('high-signal-feed');

// --- Types ---

type FilterType = 'all' | 'youtube' | 'podcast';

interface FeedItemRaw {
  id: string;
  source_type?: string;
  sourceType: 'youtube' | 'podcast';
  source_id?: string;
  sourceId: string;
  title: string;
  description?: string;
  thumbnail_url?: string;
  thumbnailUrl?: string;
  published_at?: string;
  publishedAt: string;
  duration?: number;
  url: string;
  video_id?: string;
  videoId?: string;
  episode_id?: string;
  episodeId?: string;
  bookmarked: boolean;
  sourceName?: string;
  sourceArtwork?: string;
  sourceAppleId?: string;
  podcastFeedUrl?: string;
  summaryPreview?: {
    hookHeadline?: string;
    executiveBrief?: string;
    tags?: string[];
    takeawayCount?: number;
    chapterCount?: number;
  };
  summaryStatus?: string;
}

// --- Helpers ---

function mapToKnowledgeCard(item: FeedItemRaw): KnowledgeCardProps {
  const sourceType = (item.source_type || item.sourceType) as 'youtube' | 'podcast';
  const sourceId = item.source_id || item.sourceId || '';
  const publishedAt = item.published_at || item.publishedAt;
  const videoId = item.video_id || item.videoId;
  const episodeId = item.episode_id || item.episodeId;
  const thumbnailUrl = item.thumbnail_url || item.thumbnailUrl || '';
  const sourceName = item.sourceName || '';
  // For podcasts, url is the audio URL
  const audioUrl = sourceType === 'podcast' ? item.url : undefined;
  const contentUrl = sourceType === 'youtube' ? item.url : undefined;

  return {
    id: videoId || item.id,
    type: sourceType,
    title: item.title,
    description: item.description || '',
    sourceName,
    sourceArtwork: item.sourceArtwork || thumbnailUrl,
    sourceId: sourceId,
    sourceAppleId: item.sourceAppleId,
    publishedAt,
    duration: item.duration,
    url: contentUrl,
    audioUrl,
    summaryPreview: item.summaryPreview,
    summaryStatus: (item.summaryStatus as 'none' | 'loading' | 'ready' | 'failed') || 'none',
    bookmarked: item.bookmarked,
    episodeId: episodeId,
    podcastFeedData: sourceType === 'podcast' ? {
      externalPodcastId: item.sourceAppleId || sourceId,
      podcastArtist: sourceName,
      podcastFeedUrl: item.podcastFeedUrl,
    } : undefined,
  };
}

// --- Ghost card for empty state ---

function KnowledgeCardGhost() {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 space-y-3 opacity-50">
      <div className="flex gap-4">
        <Skeleton className="w-14 h-14 rounded-full flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      <Skeleton className="h-px w-full" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-4/5" />
      <div className="flex gap-2 pt-1">
        <Skeleton className="h-8 w-20 rounded-full" />
        <Skeleton className="h-8 w-24 rounded-full" />
      </div>
    </div>
  );
}

// --- localStorage helpers ---

const FEED_FILTER_KEY = 'feed-filter';

function readStoredFilter(): FilterType {
  try {
    const filter = localStorage.getItem(FEED_FILTER_KEY) as FilterType | null;
    return filter === 'all' || filter === 'podcast' || filter === 'youtube' ? filter : 'all';
  } catch {
    return 'all';
  }
}

// --- Main component ---

const PAGE_SIZE = 20;

export function HighSignalFeed() {
  const { user, setShowAuthModal } = useAuth();
  const { country } = useCountry();

  const [filter, setFilter] = useState<FilterType>('all');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setFilter(readStoredFilter());
    setHydrated(true);
  }, []);

  // For You feed state
  const [forYouItems, setForYouItems] = useState<FeedItemRaw[]>([]);
  const [isForYouLoading, setIsForYouLoading] = useState(false);
  const [hasForYouMore, setHasForYouMore] = useState(true);
  const forYouOffsetRef = useRef(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // --- Data fetching (always sourceType=all, filters client-side) ---
  const fetchForYou = useCallback(async (offset: number, append: boolean) => {
    if (!user || !hydrated) return;

    const params = new URLSearchParams({
      sourceType: 'all',
      country: country.toLowerCase(),
      limit: String(PAGE_SIZE),
      offset: String(offset),
    });

    log.info('Fetching For You', { offset, append });

    try {
      const res = await fetch(`/api/feed?${params}`);
      if (!res.ok) {
        log.error('API error', { status: res.status });
        return;
      }

      const data = await res.json();
      const newItems: FeedItemRaw[] = data.items || [];

      log.success('For You items', { count: newItems.length, hasMore: data.hasMore });

      setForYouItems(prev => append ? [...prev, ...newItems] : newItems);
      setHasForYouMore(newItems.length === PAGE_SIZE);
      forYouOffsetRef.current = offset + newItems.length;
    } catch (err) {
      log.error('Error fetching For You', err);
    }
  }, [user, hydrated, country]);

  // Track whether source refreshes have been triggered this session
  const sourceRefreshDone = useRef(false);

  // Fetch data on mount
  useEffect(() => {
    if (!hydrated || !user) return;
    setIsForYouLoading(true);
    forYouOffsetRef.current = 0;
    fetchForYou(0, false).then(() => {
      // Trigger podcast + YouTube refreshes in parallel (once per session).
      // Both endpoints use per-source 24h Redis caches, so repeated calls
      // are cheap — they only hit external APIs when sources are stale.
      if (!sourceRefreshDone.current) {
        sourceRefreshDone.current = true;
        Promise.all([
          fetch('/api/podcasts/refresh', { method: 'POST' })
            .then(res => res.ok ? res.json() : null)
            .catch(() => null),
          fetch('/api/youtube/refresh', { method: 'POST' })
            .then(res => res.ok ? res.json() : null)
            .catch(() => null),
        ]).then(([podcastResult, youtubeResult]) => {
          const newPodcastEpisodes = podcastResult?.episodesAdded ?? 0;
          const newYoutubeVideos = youtubeResult?.videosAdded ?? 0;
          // Re-fetch only if something actually changed
          if (newPodcastEpisodes > 0 || newYoutubeVideos > 0) {
            fetchForYou(0, false);
          }
        });
      }
    }).finally(() => setIsForYouLoading(false));
  }, [hydrated, user, fetchForYou]);

  // --- Persist filter ---
  const handleFilterChange = useCallback((newFilter: FilterType) => {
    setFilter(newFilter);
    localStorage.setItem(FEED_FILTER_KEY, newFilter);
    posthog.capture('feed_filter_changed', { filter: newFilter });
  }, []);

  // --- Build card list ---
  const cards = useMemo(() => {
    const mapped = forYouItems.map(mapToKnowledgeCard);
    if (filter === 'all') return mapped;
    return mapped.filter(c => c.type === filter);
  }, [filter, forYouItems]);

  // --- Filter counts ---
  const filterCounts = useMemo(() => {
    const all = forYouItems.length;
    const podcast = forYouItems.filter(i => (i.source_type || i.sourceType) === 'podcast').length;
    const youtube = forYouItems.filter(i => (i.source_type || i.sourceType) === 'youtube').length;
    return { all, podcast, youtube } as Record<FilterType, number>;
  }, [forYouItems]);

  // --- Loading ---
  const isLoading = isForYouLoading;
  const hasMore = hasForYouMore;

  // --- Load more ---
  const handleLoadMore = useCallback(() => {
    if (isLoadingMore || !hasForYouMore || !user) return;
    setIsLoadingMore(true);
    posthog.capture('feed_load_more', { filter, offset: forYouOffsetRef.current });
    fetchForYou(forYouOffsetRef.current, true).finally(() => {
      setIsLoadingMore(false);
    });
  }, [isLoadingMore, hasForYouMore, user, filter, fetchForYou]);

  // --- Not signed in: don't render this section ---
  if (!user) return null;

  // --- Filter chip config with counts ---
  const filters: { label: string; value: FilterType; count: number }[] = [
    { label: 'All', value: 'all', count: filterCounts.all },
    { label: 'Podcasts', value: 'podcast', count: filterCounts.podcast },
    { label: 'YouTube', value: 'youtube', count: filterCounts.youtube },
  ];

  return (
    <section>
      {/* Header */}
      <div className="mb-4">
        <h2 className="text-h3 text-foreground">Trending</h2>
        <p className="text-body-sm text-muted-foreground">Personalized picks worth your time</p>
      </div>

      {/* Filter chips — own row, only shown when feed has items */}
      {!isLoading && forYouItems.length > 0 && (
        <div className="flex items-center gap-1 mb-5">
          {filters.map((f) => {
            const isDisabled = f.value !== 'all' && f.count === 0;
            return (
              <button
                key={f.value}
                onClick={() => !isDisabled && handleFilterChange(f.value)}
                disabled={isDisabled}
                className={cn(
                  'px-3 py-1 text-xs font-medium rounded-full transition-colors',
                  isDisabled
                    ? 'opacity-40 cursor-not-allowed text-muted-foreground'
                    : 'cursor-pointer',
                  !isDisabled && filter === f.value
                    ? 'bg-foreground/10 text-foreground'
                    : !isDisabled && 'text-muted-foreground hover:text-foreground hover:bg-foreground/5'
                )}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <div className="flex flex-col gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-[180px] rounded-2xl" />
          ))}
        </div>
      ) : cards.length === 0 && forYouItems.length === 0 ? (
        // Ghost empty state — user has no feed items at all
        <div className="relative">
          <div className="flex flex-col gap-4 select-none pointer-events-none">
            <KnowledgeCardGhost />
            <KnowledgeCardGhost />
            <KnowledgeCardGhost />
          </div>
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/60 backdrop-blur-[2px] rounded-2xl">
            <p className="text-h4 text-foreground mb-1">See insights from what you follow</p>
            <p className="text-body-sm text-muted-foreground mb-4 text-center px-6">
              Follow your first podcast or YouTube channel to start your feed.
            </p>
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() => document.getElementById('trending-feed')?.scrollIntoView({ behavior: 'smooth' })}
            >
              Browse Trending
            </Button>
          </div>
        </div>
      ) : cards.length === 0 ? (
        // Filter applied but no results for this filter type
        <div className="text-center py-8 text-muted-foreground">
          <p>No items found for this filter.</p>
          <p className="text-sm mt-1">
            {filter === 'podcast'
              ? 'Subscribe to some podcasts to see them here.'
              : filter === 'youtube'
                ? 'Follow some YouTube channels to see them here.'
                : ''}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {cards.map((props, index) => (
            <KnowledgeCard key={`${props.type}-${props.id}-${index}`} {...props} />
          ))}
        </div>
      )}

      {/* Load More */}
      <div className="h-20 flex items-center justify-center">
        {hasMore && cards.length > 0 && (
          <Button
            variant="outline"
            onClick={handleLoadMore}
            disabled={isLoadingMore}
            className="gap-2"
          >
            {isLoadingMore ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Loading...</>
            ) : (
              'Load More'
            )}
          </Button>
        )}
        {!hasMore && cards.length > 0 && (
          <p className="text-sm text-muted-foreground">You&apos;ve reached the end</p>
        )}
      </div>
    </section>
  );
}
