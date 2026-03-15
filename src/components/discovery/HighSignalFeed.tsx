'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { KnowledgeCard } from './KnowledgeCard';
import type { KnowledgeCardProps } from './KnowledgeCard';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Loader2,
  Compass,
  Sparkles,
  ArrowDown,
  LogIn,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import posthog from 'posthog-js';
import { createLogger } from '@/lib/logger';

const log = createLogger('high-signal-feed');

// --- Types ---

type FeedMode = 'for-you' | 'curiosity';
type FilterType = 'all' | 'youtube' | 'podcast';

interface FeedEpisode {
  id: string;
  title: string;
  description: string;
  publishedAt: Date;
  audioUrl?: string;
  duration?: number;
  podcastId: string;
  podcastName: string;
  podcastArtist?: string;
  podcastArtwork: string;
  podcastFeedUrl?: string;
  isSubscribed?: boolean;
}

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

export interface HighSignalFeedProps {
  curiosityEpisodes: FeedEpisode[];
  isCuriosityLoading: boolean;
  hasCuriosityMore: boolean;
  onCuriosityLoadMore: () => void;
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
    summaryStatus: (item.summaryStatus as 'none' | 'loading' | 'ready') || 'none',
    bookmarked: item.bookmarked,
    episodeId: episodeId,
    podcastFeedData: sourceType === 'podcast' ? {
      externalPodcastId: item.sourceAppleId || sourceId,
      podcastArtist: sourceName,
      podcastFeedUrl: item.podcastFeedUrl,
    } : undefined,
  };
}

function mapCuriosityToKnowledgeCard(ep: FeedEpisode): KnowledgeCardProps {
  return {
    id: ep.id,
    type: 'podcast',
    title: ep.title,
    description: ep.description || '',
    sourceName: ep.podcastName,
    sourceArtwork: ep.podcastArtwork,
    sourceId: ep.podcastId,
    publishedAt: ep.publishedAt,
    duration: ep.duration,
    audioUrl: ep.audioUrl,
    summaryStatus: 'none',
    podcastFeedData: {
      externalPodcastId: ep.podcastId,
      podcastArtist: ep.podcastArtist || ep.podcastName,
      podcastFeedUrl: ep.podcastFeedUrl,
    },
  };
}

// --- Format break sub-component ---

const BREAK_CONFIGS = [
  { label: 'Keep exploring', icon: Compass },
  { label: 'Worth your time', icon: Sparkles },
  { label: 'Up next', icon: ArrowDown },
];

function FeedBreak({ index }: { index: number }) {
  const config = BREAK_CONFIGS[index % BREAK_CONFIGS.length];
  const Icon = config.icon;
  return (
    <div className="flex items-center gap-3 py-3 my-2">
      <div className="flex-1 h-px bg-border/40" />
      <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary/50">
        <Icon className="h-3 w-3 text-muted-foreground/60" />
        <span className="text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider">
          {config.label}
        </span>
      </div>
      <div className="flex-1 h-px bg-border/40" />
    </div>
  );
}

// --- Sign-in prompt ---

function SignInPrompt({ onSignIn }: { onSignIn: () => void }) {
  return (
    <div className="bg-card border border-border rounded-2xl shadow-[var(--shadow-1)] p-8 text-center">
      <LogIn className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
      <h3 className="text-h4 text-foreground mb-1">Sign in for personalized picks</h3>
      <p className="text-body-sm text-muted-foreground mb-4">
        Follow channels and podcasts to get a feed tailored to your interests.
      </p>
      <Button onClick={onSignIn} className="rounded-full gap-2">
        <LogIn className="h-4 w-4" />
        Sign In
      </Button>
    </div>
  );
}

// --- localStorage helpers ---

const FEED_MODE_KEY = 'feed-mode';
const FEED_FILTER_KEY = 'feed-filter';

function readStored(): { mode?: FeedMode; filter?: FilterType } {
  try {
    const mode = localStorage.getItem(FEED_MODE_KEY) as FeedMode | null;
    const filter = localStorage.getItem(FEED_FILTER_KEY) as FilterType | null;
    return {
      mode: mode === 'for-you' || mode === 'curiosity' ? mode : undefined,
      filter: filter === 'all' || filter === 'podcast' || filter === 'youtube' ? filter : undefined,
    };
  } catch {
    return {};
  }
}

// --- Main component ---

const PAGE_SIZE = 20;

export function HighSignalFeed({
  curiosityEpisodes,
  isCuriosityLoading,
  hasCuriosityMore,
  onCuriosityLoadMore,
}: HighSignalFeedProps) {
  const { user, setShowAuthModal } = useAuth();

  // Consistent SSR/client initial value; sync localStorage after mount
  const [mode, setMode] = useState<FeedMode>(user ? 'for-you' : 'curiosity');
  const [filter, setFilter] = useState<FilterType>('all');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = readStored();
    if (stored.mode) setMode(stored.mode);
    if (stored.filter) {
      // Validate filter is valid for the resolved mode
      const resolvedMode = stored.mode ?? (user ? 'for-you' : 'curiosity');
      if (resolvedMode === 'curiosity' && stored.filter === 'youtube') {
        setFilter('all');
      } else {
        setFilter(stored.filter);
      }
    }
    setHydrated(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // For You feed state
  const [forYouItems, setForYouItems] = useState<FeedItemRaw[]>([]);
  const [isForYouLoading, setIsForYouLoading] = useState(false);
  const [hasForYouMore, setHasForYouMore] = useState(true);
  const forYouOffsetRef = useRef(0);

  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // --- For You data fetching (always fetches sourceType=all, filters client-side) ---
  const fetchForYou = useCallback(async (offset: number, append: boolean) => {
    if (!user || !hydrated) return;

    const params = new URLSearchParams({
      sourceType: 'all',
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
  }, [user, hydrated]);

  // Track whether podcast refresh has been triggered this session
  const podcastRefreshDone = useRef(false);

  // Fetch For You data only when in For You mode
  useEffect(() => {
    if (!hydrated || mode !== 'for-you' || !user) return;
    setIsForYouLoading(true);
    forYouOffsetRef.current = 0;
    fetchForYou(0, false).then(() => {
      // Trigger podcast feed refresh in background (once per session)
      if (!podcastRefreshDone.current) {
        podcastRefreshDone.current = true;
        fetch('/api/podcasts/refresh', { method: 'POST' })
          .then(res => res.ok ? res.json() : null)
          .then(data => {
            if (data?.episodesAdded > 0) {
              // Re-fetch to include newly added podcast episodes
              fetchForYou(0, false);
            }
          })
          .catch(() => {}); // Silently ignore refresh errors
      }
    }).finally(() => setIsForYouLoading(false));
  }, [hydrated, mode, user, fetchForYou]);

  // --- Persist & switch mode ---
  const handleModeSwitch = useCallback((newMode: FeedMode) => {
    if (newMode === mode) return;

    if (newMode === 'for-you' && !user) {
      posthog.capture('feed_sign_in_prompt_shown');
      setShowAuthModal(true, 'Sign in to see your personalized feed.');
      return;
    }

    setMode(newMode);
    const defaultFilter: FilterType = 'all';
    setFilter(defaultFilter);
    localStorage.setItem(FEED_MODE_KEY, newMode);
    localStorage.setItem(FEED_FILTER_KEY, defaultFilter);
    posthog.capture('feed_mode_switched', {
      mode: newMode,
      is_authenticated: !!user,
    });
  }, [mode, user, setShowAuthModal]);

  // --- Persist & switch filter ---
  const handleFilterChange = useCallback((newFilter: FilterType) => {
    setFilter(newFilter);
    localStorage.setItem(FEED_FILTER_KEY, newFilter);
    posthog.capture('feed_filter_changed', { filter: newFilter, mode });
  }, [mode]);

  // --- Build card list: mode = source, filter = narrow within ---
  const cards = useMemo(() => {
    if (mode === 'for-you') {
      const mapped = forYouItems.map(mapToKnowledgeCard);
      if (filter === 'all') return mapped;
      return mapped.filter(c => c.type === filter);
    }
    // Curiosity — all items are podcasts, filter only narrows (youtube filter hidden)
    return curiosityEpisodes.map(mapCuriosityToKnowledgeCard);
  }, [mode, filter, forYouItems, curiosityEpisodes]);

  // --- Loading & empty ---
  const isLoading = mode === 'for-you'
    ? isForYouLoading
    : (isCuriosityLoading && curiosityEpisodes.length === 0);
  const hasMore = mode === 'for-you' ? hasForYouMore : hasCuriosityMore;
  const showSignInPrompt = mode === 'for-you' && !user;

  // --- Filter chip config per mode ---
  const forYouFilters: { label: string; value: FilterType }[] = [
    { label: 'All', value: 'all' },
    { label: 'Podcasts', value: 'podcast' },
    { label: 'YouTube', value: 'youtube' },
  ];
  // Curiosity is podcast-only → no filter chips needed
  const showFilters = mode === 'for-you' && !showSignInPrompt;

  // --- Infinite scroll ---
  const handleLoadMore = useCallback(() => {
    if (isLoadingMore) return;

    if (mode === 'for-you' && hasForYouMore && user) {
      setIsLoadingMore(true);
      posthog.capture('feed_load_more', { mode, filter, offset: forYouOffsetRef.current });
      fetchForYou(forYouOffsetRef.current, true).finally(() => {
        setIsLoadingMore(false);
      });
    } else if (mode === 'curiosity' && hasCuriosityMore && !isCuriosityLoading) {
      setIsLoadingMore(true);
      posthog.capture('feed_load_more', { mode, offset: curiosityEpisodes.length });
      onCuriosityLoadMore();
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, mode, hasForYouMore, hasCuriosityMore, isCuriosityLoading, user, filter, fetchForYou, onCuriosityLoadMore, curiosityEpisodes.length]);

  // --- Empty state messaging per mode ---
  const emptyMessage = mode === 'for-you'
    ? filter === 'podcast'
      ? 'No podcasts in your feed yet. Subscribe to some podcasts to see them here.'
      : filter === 'youtube'
        ? 'No YouTube videos in your feed yet. Follow some channels to see them here.'
        : 'Your feed is empty. Follow channels and podcasts to get started!'
    : 'No discovery episodes available. Check back soon!';

  return (
    <section>
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-h3 text-foreground">
            {mode === 'for-you' ? 'For You' : 'Curiosity Feed'}
          </h2>
          <p className="text-body-sm text-muted-foreground">
            {mode === 'for-you'
              ? 'Personalized picks worth your time'
              : 'Episodes worth your time'}
          </p>
        </div>
      </div>

      {/* Mode toggle + Filter chips */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
        {/* Mode toggle */}
        <div className="flex items-center gap-1 p-1 bg-secondary/50 rounded-full w-fit">
          <button
            onClick={() => handleModeSwitch('for-you')}
            className={cn(
              'px-4 py-1.5 text-sm font-medium rounded-full transition-colors cursor-pointer',
              mode === 'for-you'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            For You
          </button>
          <button
            onClick={() => handleModeSwitch('curiosity')}
            className={cn(
              'px-4 py-1.5 text-sm font-medium rounded-full transition-colors cursor-pointer',
              mode === 'curiosity'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Curiosity
          </button>
        </div>

        {/* Filter chips — only in For You mode */}
        {showFilters && (
          <div className="flex items-center gap-1">
            {forYouFilters.map((f) => (
              <button
                key={f.value}
                onClick={() => handleFilterChange(f.value)}
                className={cn(
                  'px-3 py-1 text-xs font-medium rounded-full transition-colors cursor-pointer',
                  filter === f.value
                    ? 'bg-foreground/10 text-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-foreground/5'
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      {showSignInPrompt ? (
        <SignInPrompt onSignIn={() => setShowAuthModal(true, 'Sign in to see your personalized feed.')} />
      ) : isLoading ? (
        <div className="flex flex-col gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-[180px] rounded-2xl" />
          ))}
        </div>
      ) : cards.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <p>No items found.</p>
          <p className="text-sm mt-1">{emptyMessage}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {cards.map((props, index) => (
            <div key={`${props.type}-${props.id}-${index}`}>
              <KnowledgeCard {...props} />
              {(index + 1) % 5 === 0 && index < cards.length - 1 && (
                <FeedBreak index={Math.floor(index / 5)} />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Load More button */}
      <div className="h-20 flex items-center justify-center">
        {hasMore && cards.length > 0 && !showSignInPrompt && (
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
