'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { KnowledgeCard } from './KnowledgeCard';
import type { KnowledgeCardProps } from './KnowledgeCard';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2 } from 'lucide-react';
import posthog from 'posthog-js';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { createLogger } from '@/lib/logger';

const log = createLogger('feed');

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
  // Enriched by API
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

function mapToKnowledgeCard(item: FeedItemRaw): KnowledgeCardProps {
  const sourceType = (item.source_type || item.sourceType) as 'youtube' | 'podcast';
  const sourceId = item.source_id || item.sourceId || '';
  const publishedAt = item.published_at || item.publishedAt;
  const videoId = item.video_id || item.videoId;
  const episodeId = item.episode_id || item.episodeId;
  const thumbnailUrl = item.sourceArtwork || item.thumbnail_url || item.thumbnailUrl || '';
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
    sourceArtwork: thumbnailUrl,
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

export function UnifiedFeed() {
  const { user } = useAuth();
  const [filter, setFilter] = useState<FilterType>('all');
  const [items, setItems] = useState<FeedItemRaw[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const offsetRef = useRef(0);
  const PAGE_SIZE = 20;

  const fetchFeed = useCallback(async (sourceType: FilterType, offset: number, append: boolean) => {
    if (!user) return;

    const params = new URLSearchParams({
      sourceType,
      limit: String(PAGE_SIZE),
      offset: String(offset),
    });

    log.info('Fetching', { sourceType, offset, append });

    try {
      const res = await fetch(`/api/feed?${params}`);
      if (!res.ok) {
        log.error('API error', { status: res.status, statusText: res.statusText });
        return;
      }

      const data = await res.json();
      const newItems: FeedItemRaw[] = data.items || [];

      log.success('Received items', { count: newItems.length, hasMore: data.hasMore });

      setItems(prev => append ? [...prev, ...newItems] : newItems);
      setHasMore(newItems.length === PAGE_SIZE);
      offsetRef.current = offset + newItems.length;
    } catch (err) {
      log.error('Error fetching feed', err);
    }
  }, [user]);

  // Load initial feed
  useEffect(() => {
    if (!user) return;

    setIsLoading(true);
    offsetRef.current = 0;
    fetchFeed(filter, 0, false).finally(() => setIsLoading(false));
  }, [user, filter, fetchFeed]);

  const handleLoadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    posthog.capture('feed_load_more', { filter, offset: offsetRef.current });
    await fetchFeed(filter, offsetRef.current, true);
    setIsLoadingMore(false);
  }, [filter, isLoadingMore, hasMore, fetchFeed]);

  if (!user) return null;

  const filters: { label: string; value: FilterType }[] = [
    { label: 'All', value: 'all' },
    { label: 'Podcasts', value: 'podcast' },
    { label: 'YouTube', value: 'youtube' },
  ];

  // Filter items by type when a specific filter is selected
  const filteredItems = filter === 'all'
    ? items
    : items.filter(item => (item.source_type || item.sourceType) === filter);

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-h3 text-foreground">For You</h2>
          <p className="text-body-sm text-muted-foreground">Content from your subscriptions</p>
        </div>
        <div className="flex items-center gap-1 p-1">
          {filters.map((f) => (
            <button
              key={f.value}
              onClick={() => { setFilter(f.value); posthog.capture('feed_filter_changed', { filter: f.value }); }}
              className={cn(
                'px-4 py-1.5 text-sm font-medium rounded-full transition-colors cursor-pointer',
                filter === f.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-muted-foreground hover:text-foreground'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-[180px] rounded-2xl" />
          ))}
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <p>No items in your feed yet.</p>
          <p className="text-sm mt-1">Follow some YouTube channels or podcasts to get started!</p>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-4">
            {filteredItems.map((item) => {
              const props = mapToKnowledgeCard(item);
              return (
                <KnowledgeCard
                  key={item.id}
                  {...props}
                />
              );
            })}
          </div>

          {hasMore && (
            <div className="flex justify-center mt-6">
              <Button
                variant="outline"
                onClick={handleLoadMore}
                disabled={isLoadingMore}
                className="gap-2 rounded-full"
              >
                {isLoadingMore && <Loader2 className="h-4 w-4 animate-spin" />}
                Load More
              </Button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
