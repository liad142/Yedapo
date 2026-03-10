'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { redirect } from 'next/navigation';
import { SafeImage } from '@/components/SafeImage';
import Link from 'next/link';
import { ArrowLeft, Loader2, Heart } from 'lucide-react';
import { EpisodeList } from '@/components/EpisodeList';
import { useSummarizeQueue } from '@/contexts/SummarizeQueueContext';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { NotifyToggle } from '@/components/NotifyToggle';
import { useSummaryAvailability } from '@/hooks/useSummaryAvailability';
import { useEpisodeImport } from '@/hooks/useEpisodeImport';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useCountry } from '@/contexts/CountryContext';
import { cn } from '@/lib/utils';
import type { PodcastDetailEpisode } from '@/types/podcast';

interface BrowsePodcast {
  id: string;
  name: string;
  artistName: string;
  description: string;
  artworkUrl: string;
  feedUrl?: string;
  genres: string[];
  trackCount: number;
  contentAdvisoryRating?: string;
}

interface PageProps {
  params: Promise<{ id: string }>;
}

// UUID v4 pattern — if the ID is a Supabase UUID, redirect to the internal podcast page
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function PodcastPage({ params }: PageProps) {
  const { id: podcastId } = use(params);

  // Supabase UUIDs should be handled by /podcast/[id], not the Apple browse page
  if (UUID_RE.test(podcastId)) {
    redirect(`/podcast/${podcastId}`);
  }

  const { country } = useCountry();
  const { user, setShowAuthModal } = useAuth();
  const { subscribedAppleIds, subscribe, unsubscribe, getNotificationPrefs, updateNotificationPrefs, getLastViewedAt } = useSubscription();

  // Detect if this is a Podcastindex-only podcast (pi:{feedId} format)
  const isPiPodcast = podcastId.startsWith('pi:');
  const piFeedId = isPiPodcast ? podcastId.slice(3) : null;

  const isSubscribed = !isPiPodcast && subscribedAppleIds.has(podcastId);
  const [isTogglingSubscription, setIsTogglingSubscription] = useState(false);

  const handleToggleSubscription = async () => {
    if (!user) {
      setShowAuthModal(true, 'Sign up to follow your favourite podcasts and never miss an episode.');
      return;
    }
    setIsTogglingSubscription(true);
    try {
      if (isSubscribed) {
        await unsubscribe(podcastId);
      } else {
        await subscribe(podcastId);
      }
    } finally {
      setIsTogglingSubscription(false);
    }
  };

  const [podcast, setPodcast] = useState<BrowsePodcast | null>(null);
  const [episodes, setEpisodes] = useState<PodcastDetailEpisode[]>([]);
  const [isLoadingPodcast, setIsLoadingPodcast] = useState(true);
  const [isLoadingEpisodes, setIsLoadingEpisodes] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const { addToQueue, queue } = useSummarizeQueue();

  const { summaryAvailability, setSummaryAvailability, getEpisodeSummaryInfo } =
    useSummaryAvailability(episodes);

  const podcastInfo = podcast ? {
    externalId: podcast.id,
    name: podcast.name,
    artistName: podcast.artistName,
    artworkUrl: podcast.artworkUrl,
    feedUrl: podcast.feedUrl,
  } : null;

  const { importingEpisodeId, handleSummarize } = useEpisodeImport(
    podcastInfo,
    summaryAvailability,
    setSummaryAvailability,
    addToQueue
  );

  const fetchPodcast = useCallback(async () => {
    setIsLoadingPodcast(true);
    try {
      const url = isPiPodcast
        ? `/api/pi/podcasts/${piFeedId}`
        : `/api/apple/podcasts/${podcastId}?country=${country.toLowerCase()}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch podcast');
      const data = await response.json();
      setPodcast(data.podcast);
    } catch (err) {
      console.error('Error fetching podcast:', err);
      setError('Failed to load podcast details');
    } finally {
      setIsLoadingPodcast(false);
    }
  }, [podcastId, country, isPiPodcast, piFeedId]);

  const EPISODES_PER_PAGE = 50;

  const fetchEpisodes = useCallback(async () => {
    setIsLoadingEpisodes(true);
    try {
      const url = isPiPodcast
        ? `/api/pi/podcasts/${piFeedId}/episodes?limit=${EPISODES_PER_PAGE}&offset=0`
        : `/api/apple/podcasts/${podcastId}/episodes?limit=${EPISODES_PER_PAGE}&offset=0`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch episodes');
      const data = await response.json();
      setEpisodes(data.episodes || []);
      setHasMore(data.hasMore ?? false);
      setTotalCount(data.totalCount ?? data.episodes?.length ?? 0);
    } catch (err) {
      console.error('Error fetching episodes:', err);
    } finally {
      setIsLoadingEpisodes(false);
    }
  }, [podcastId, isPiPodcast, piFeedId]);

  const handleLoadMore = useCallback(async () => {
    setIsLoadingMore(true);
    try {
      const url = isPiPodcast
        ? `/api/pi/podcasts/${piFeedId}/episodes?limit=${EPISODES_PER_PAGE}&offset=${episodes.length}`
        : `/api/apple/podcasts/${podcastId}/episodes?limit=${EPISODES_PER_PAGE}&offset=${episodes.length}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch more episodes');
      const data = await response.json();
      setEpisodes(prev => [...prev, ...(data.episodes || [])]);
      setHasMore(data.hasMore ?? false);
      setTotalCount(data.totalCount ?? totalCount);
    } catch (err) {
      console.error('Error loading more episodes:', err);
    } finally {
      setIsLoadingMore(false);
    }
  }, [podcastId, episodes.length, totalCount, isPiPodcast, piFeedId]);

  useEffect(() => {
    fetchPodcast();
    fetchEpisodes();
  }, [fetchPodcast, fetchEpisodes]);

  // Update summaryAvailability when queue items complete
  useEffect(() => {
    const completedItems = queue.filter(item => item.state === 'ready');

    if (completedItems.length > 0) {
      setSummaryAvailability(prev => {
        const updated = new Map(prev);

        for (const item of completedItems) {
          // Find the episode with this episodeId
          const episode = episodes.find(ep => {
            const info = prev.get(ep.audioUrl || '');
            return info?.episodeId === item.episodeId;
          });

          if (episode?.audioUrl) {
            const existing = prev.get(episode.audioUrl);
            if (existing && !existing.hasDeepSummary) {
              // Update to mark as ready
              updated.set(episode.audioUrl, {
                ...existing,
                hasDeepSummary: true,
                deepStatus: 'ready',
              });
            }
          }
        }

        return updated;
      });
    }
  }, [queue, episodes, setSummaryAvailability]);

  const handleSummarizeWithAuth = (episode: PodcastDetailEpisode) => {
    if (!user) {
      setShowAuthModal(true, 'Sign up to generate AI summaries and insights for any episode.');
      return;
    }
    handleSummarize(episode);
  };

  // Helper for consistent image URL
  const imageUrl = podcast?.artworkUrl?.replace('100x100', '600x600') || '/placeholder-podcast.png';

  if (error && !podcast) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-destructive mb-4">{error}</p>
          <Link href="/discover">
            <Button>Back to Discover</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Back Button */}
        <Link href="/discover">
          <Button variant="ghost" className="mb-6 -ml-2 text-muted-foreground hover:text-foreground hover:bg-secondary">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Discover
          </Button>
        </Link>

        {isLoadingPodcast ? (
          <div className="space-y-8">
            <div className="relative overflow-hidden rounded-2xl bg-secondary h-80 animate-pulse" />
          </div>
        ) : podcast && (
          <div className="space-y-12">
            {/* Podcast Header */}
            <div className="flex flex-col md:flex-row gap-8 items-center md:items-start">
              {/* Podcast Artwork */}
              <div className="w-40 h-40 shrink-0 rounded-2xl overflow-hidden shadow-[var(--shadow-3)]">
                <SafeImage
                  src={imageUrl}
                  alt={podcast.name}
                  width={160}
                  height={160}
                  className="w-full h-full object-cover"
                  priority
                />
              </div>

              <div className="flex-1 space-y-4 text-center md:text-left max-w-3xl">
                {/* Title */}
                <h1 className="text-3xl md:text-4xl lg:text-5xl font-black text-foreground tracking-tight leading-tight">
                  {podcast.name}
                </h1>

                {/* Publisher */}
                <p className="text-base text-muted-foreground">
                  {podcast.artistName}
                </p>

                {/* Tags */}
                <div className="flex flex-wrap justify-center md:justify-start gap-2">
                  {podcast.contentAdvisoryRating === 'Explicit' && (
                    <Badge variant="destructive">Explicit</Badge>
                  )}
                  {podcast.genres?.slice(0, 3).map((genre) => (
                    <Badge key={genre} variant="secondary">
                      {genre}
                    </Badge>
                  ))}
                </div>

                {/* Stats */}
                <p className="text-sm text-muted-foreground">
                  {podcast.trackCount > 0 && `${podcast.trackCount} episodes`}
                </p>

                {/* Description */}
                <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3 md:line-clamp-4 max-w-2xl">
                  {podcast.description}
                </p>

                {/* Action Buttons */}
                <div className="flex items-center gap-1 pt-2 justify-center md:justify-start">
                  {!isPiPodcast && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleToggleSubscription}
                      disabled={isTogglingSubscription}
                      className={cn(
                        'rounded-full',
                        isSubscribed && 'text-red-500 hover:text-red-600'
                      )}
                      aria-label={isSubscribed ? 'Remove from library' : 'Save to library'}
                    >
                      {isTogglingSubscription ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <Heart className={cn('h-5 w-5', isSubscribed && 'fill-current')} />
                      )}
                    </Button>
                  )}

                  {/* Secondary actions — icon row, scales with future integrations (Notion, etc.) */}
                  {!isPiPodcast && isSubscribed && (() => {
                    const prefs = getNotificationPrefs(podcastId);
                    return (
                      <NotifyToggle
                        enabled={prefs.notifyEnabled}
                        channels={prefs.notifyChannels}
                        onUpdate={(enabled, channels) => updateNotificationPrefs(podcastId, enabled, channels)}
                      />
                    );
                  })()}
                </div>
              </div>
            </div>

            {/* Episodes Section */}
            <div>
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-3">
                  Latest Episodes
                  <Badge variant="secondary">
                    {totalCount}
                  </Badge>
                </h2>
              </div>

              <EpisodeList
                episodes={episodes}
                podcastName={podcast.name}
                podcastArtworkUrl={podcast.artworkUrl}
                getEpisodeSummaryInfo={getEpisodeSummaryInfo}
                onSummarize={handleSummarizeWithAuth}
                importingEpisodeId={importingEpisodeId}
                isLoading={isLoadingEpisodes}
                hasMore={hasMore}
                isLoadingMore={isLoadingMore}
                totalCount={totalCount}
                onLoadMore={handleLoadMore}
                variant="list"
                onAuthGate={() => setShowAuthModal(true, 'Sign up to generate AI summaries and insights for any episode.')}
                user={user}
                newEpisodesSince={isSubscribed ? getLastViewedAt(podcastId) ?? undefined : undefined}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
