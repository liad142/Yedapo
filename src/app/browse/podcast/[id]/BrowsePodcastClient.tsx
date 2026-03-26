'use client';

import { useState, useEffect, useCallback } from 'react';
import { SafeImage } from '@/components/SafeImage';
import Link from 'next/link';
import { ArrowLeft, Loader2, Heart, Globe, Calendar, Mic2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { springBouncy } from '@/lib/motion';
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
import { cn, stripHtml } from '@/lib/utils';
import { createLogger } from '@/lib/logger';
import type { PodcastDetailEpisode } from '@/types/podcast';

const log = createLogger('podcast');

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

interface BrowsePodcastClientProps {
  podcastId: string;
  isPodcastIndex: boolean;
  initialPodcast: BrowsePodcast | null;
  initialEpisodes: PodcastDetailEpisode[];
  initialHasMore: boolean;
  initialTotalCount: number;
  initialCountry: string;
}

const EPISODES_PER_PAGE = 50;

export default function BrowsePodcastClient({
  podcastId,
  isPodcastIndex,
  initialPodcast,
  initialEpisodes,
  initialHasMore,
  initialTotalCount,
  initialCountry,
}: BrowsePodcastClientProps) {
  const { country } = useCountry();
  const { user, setShowAuthModal } = useAuth();
  const {
    subscribedAppleIds,
    subscribe,
    unsubscribe,
    getNotificationPrefs,
    updateNotificationPrefs,
    getLastViewedAt,
  } = useSubscription();

  const piFeedId = isPodcastIndex ? podcastId.slice(3) : null;

  const isSubscribed = !isPodcastIndex && subscribedAppleIds.has(podcastId);
  const [isTogglingSubscription, setIsTogglingSubscription] = useState(false);

  const handleToggleSubscription = async () => {
    if (!user) {
      setShowAuthModal(
        true,
        'Sign up to follow your favourite podcasts and never miss an episode.'
      );
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

  const [podcast, setPodcast] = useState<BrowsePodcast | null>(initialPodcast);
  const [episodes, setEpisodes] = useState<PodcastDetailEpisode[]>(initialEpisodes);
  const [isLoadingPodcast, setIsLoadingPodcast] = useState(!initialPodcast);
  const [isLoadingEpisodes, setIsLoadingEpisodes] = useState(!initialEpisodes.length && !initialPodcast);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [totalCount, setTotalCount] = useState(initialTotalCount);
  const [error, setError] = useState<string | null>(null);

  const { addToQueue, queue } = useSummarizeQueue();

  const { summaryAvailability, setSummaryAvailability, getEpisodeSummaryInfo } =
    useSummaryAvailability(episodes, podcastId);

  const podcastInfo = podcast
    ? {
        externalId: podcast.id,
        name: podcast.name,
        artistName: podcast.artistName,
        artworkUrl: podcast.artworkUrl,
        feedUrl: podcast.feedUrl,
      }
    : null;

  const { importingEpisodeId, handleSummarize } = useEpisodeImport(
    podcastInfo,
    summaryAvailability,
    setSummaryAvailability,
    addToQueue
  );

  const fetchPodcast = useCallback(async () => {
    setIsLoadingPodcast(true);
    try {
      const url = isPodcastIndex
        ? `/api/pi/podcasts/${piFeedId}`
        : `/api/apple/podcasts/${podcastId}?country=${country.toLowerCase()}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch podcast');
      const data = await response.json();
      setPodcast(data.podcast);
    } catch (err) {
      log.error('Error fetching podcast', err);
      setError('Failed to load podcast details');
    } finally {
      setIsLoadingPodcast(false);
    }
  }, [podcastId, country, isPodcastIndex, piFeedId]);

  const fetchEpisodes = useCallback(async () => {
    setIsLoadingEpisodes(true);
    try {
      const url = isPodcastIndex
        ? `/api/pi/podcasts/${piFeedId}/episodes?limit=${EPISODES_PER_PAGE}&offset=0`
        : `/api/apple/podcasts/${podcastId}/episodes?limit=${EPISODES_PER_PAGE}&offset=0`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch episodes');
      const data = await response.json();
      setEpisodes(data.episodes || []);
      setHasMore(data.hasMore ?? false);
      setTotalCount(data.totalCount ?? data.episodes?.length ?? 0);
    } catch (err) {
      log.error('Error fetching episodes', err);
    } finally {
      setIsLoadingEpisodes(false);
    }
  }, [podcastId, isPodcastIndex, piFeedId]);

  const handleLoadMore = useCallback(async () => {
    setIsLoadingMore(true);
    try {
      const url = isPodcastIndex
        ? `/api/pi/podcasts/${piFeedId}/episodes?limit=${EPISODES_PER_PAGE}&offset=${episodes.length}`
        : `/api/apple/podcasts/${podcastId}/episodes?limit=${EPISODES_PER_PAGE}&offset=${episodes.length}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch more episodes');
      const data = await response.json();
      setEpisodes((prev) => [...prev, ...(data.episodes || [])]);
      setHasMore(data.hasMore ?? false);
      setTotalCount(data.totalCount ?? totalCount);
    } catch (err) {
      log.error('Error loading more episodes', err);
    } finally {
      setIsLoadingMore(false);
    }
  }, [podcastId, episodes.length, totalCount, isPodcastIndex, piFeedId]);

  // Re-fetch when user's country differs from server default (Apple only)
  useEffect(() => {
    if (
      !isPodcastIndex &&
      country.toLowerCase() !== initialCountry.toLowerCase()
    ) {
      fetchPodcast();
      fetchEpisodes();
    }
  }, [country, initialCountry, isPodcastIndex, fetchPodcast, fetchEpisodes]);

  // Fetch if no initial data was provided (e.g., server fetch failed)
  useEffect(() => {
    if (!initialPodcast) {
      fetchPodcast();
      fetchEpisodes();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Update summaryAvailability when queue items complete
  useEffect(() => {
    const completedItems = queue.filter((item) => item.state === 'ready');

    if (completedItems.length > 0) {
      setSummaryAvailability((prev) => {
        const updated = new Map(prev);

        for (const item of completedItems) {
          const episode = episodes.find((ep) => {
            const info = prev.get(ep.audioUrl || '');
            return info?.episodeId === item.episodeId;
          });

          if (episode?.audioUrl) {
            const existing = prev.get(episode.audioUrl);
            if (existing && !existing.hasDeepSummary) {
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
      setShowAuthModal(
        true,
        'Sign up to generate AI summaries and insights for any episode.'
      );
      return;
    }
    handleSummarize(episode);
  };

  const imageUrl =
    podcast?.artworkUrl?.replace('100x100', '600x600') ||
    '/placeholder-podcast.png';

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
        {isLoadingPodcast ? (
          <div className="space-y-8">
            <div className="relative overflow-hidden rounded-3xl bg-secondary h-80 animate-pulse" />
          </div>
        ) : (
          podcast && (
            <div className="space-y-8">
              {/* Immersive Header */}
              <div className="relative z-10 rounded-3xl bg-slate-900 border border-white/10 shadow-2xl">
                <div className="absolute inset-0 z-0 overflow-hidden rounded-3xl">
                  <SafeImage
                    src={imageUrl}
                    alt=""
                    fill
                    className="object-cover blur-3xl scale-110 opacity-60"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent" />
                </div>

                <div className="relative z-10 p-8 md:p-12 flex flex-col md:flex-row gap-8 items-center md:items-start text-center md:text-left">
                  <div className="w-48 h-48 md:w-56 md:h-56 shrink-0 rounded-2xl overflow-hidden shadow-2xl border-2 border-white/10">
                    <SafeImage
                      src={imageUrl}
                      alt={podcast.name}
                      width={224}
                      height={224}
                      className="w-full h-full object-cover"
                      priority
                    />
                  </div>

                  <div className="flex-1 space-y-4">
                    <div>
                      <h1 className="text-h1 md:text-display text-white mb-3 tracking-tight leading-tight drop-shadow-sm">
                        {podcast.name}
                      </h1>
                      {podcast.artistName && (
                        <p className="text-lg md:text-xl text-slate-300 font-medium tracking-wide">
                          {podcast.artistName}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap justify-center md:justify-start gap-2">
                      {totalCount > 0 && (
                        <span className="px-3 py-1 rounded-full bg-white/10 backdrop-blur-sm border border-white/10 text-xs font-semibold text-white/90">
                          {totalCount} episodes
                        </span>
                      )}
                      {podcast.contentAdvisoryRating === 'Explicit' && (
                        <span className="px-3 py-1 rounded-full bg-red-500/20 backdrop-blur-sm border border-red-500/20 text-xs font-semibold text-red-300">
                          Explicit
                        </span>
                      )}
                      {podcast.genres?.slice(0, 3).map((genre) => (
                        <span
                          key={genre}
                          className="px-3 py-1 rounded-full bg-white/10 backdrop-blur-sm border border-white/10 text-xs font-semibold text-white/90"
                        >
                          {genre}
                        </span>
                      ))}
                    </div>

                    {podcast.description && (
                      <p className="text-slate-300 leading-relaxed max-w-2xl line-clamp-3 text-sm md:text-base border-l-2 border-white/20 pl-4">
                        {stripHtml(podcast.description)}
                      </p>
                    )}

                    <div className="flex items-center gap-1 pt-2 justify-center md:justify-start">
                      {!isPodcastIndex && (
                        <motion.div
                          whileTap={{ scale: 1.3 }}
                          transition={
                            isSubscribed
                              ? { duration: 0.4, ease: 'easeInOut' }
                              : springBouncy
                          }
                          animate={
                            isSubscribed
                              ? { scale: [1, 1.25, 1] }
                              : undefined
                          }
                        >
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleToggleSubscription}
                            disabled={isTogglingSubscription}
                            className={cn(
                              'rounded-full text-white hover:bg-white/10',
                              isSubscribed &&
                                'text-red-500 hover:text-red-600'
                            )}
                            aria-label={
                              isSubscribed
                                ? 'Remove from library'
                                : 'Save to library'
                            }
                          >
                            {isTogglingSubscription ? (
                              <Loader2 className="h-5 w-5 animate-spin" />
                            ) : (
                              <Heart
                                className={cn(
                                  'h-5 w-5',
                                  isSubscribed && 'fill-current'
                                )}
                              />
                            )}
                          </Button>
                        </motion.div>
                      )}

                      {!isPodcastIndex &&
                        isSubscribed &&
                        (() => {
                          const prefs = getNotificationPrefs(podcastId);
                          return (
                            <NotifyToggle
                              enabled={prefs.notifyEnabled}
                              channels={prefs.notifyChannels}
                              onUpdate={(enabled, channels) =>
                                updateNotificationPrefs(
                                  podcastId,
                                  enabled,
                                  channels
                                )
                              }
                            />
                          );
                        })()}
                    </div>
                  </div>
                </div>
              </div>

              {/* Episodes Section */}
              <section className="bg-secondary/50 md:bg-transparent -mx-4 px-4 py-8 md:px-0 md:mx-0 md:py-0">
                <h2 className="text-h2 tracking-tight text-foreground mb-6 flex items-center gap-3">
                  Latest Episodes
                  {totalCount > 0 && (
                    <Badge variant="secondary">{totalCount}</Badge>
                  )}
                </h2>

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
                  variant="card"
                  onAuthGate={() =>
                    setShowAuthModal(
                      true,
                      'Sign up to generate AI summaries and insights for any episode.'
                    )
                  }
                  user={user}
                  newEpisodesSince={
                    isSubscribed
                      ? getLastViewedAt(podcastId) ?? undefined
                      : undefined
                  }
                />
              </section>
            </div>
          )
        )}
      </div>
    </div>
  );
}
