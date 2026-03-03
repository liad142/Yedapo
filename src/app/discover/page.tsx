'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useCountry } from '@/contexts/CountryContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useAuth } from '@/contexts/AuthContext';
import { EpisodeLookupProvider } from '@/contexts/EpisodeLookupContext';
import { SemanticSearchBar } from '@/components/discovery/SemanticSearchBar';
import { DailyMixCarousel } from '@/components/discovery/DailyMixCarousel';
import { BrandShelf } from '@/components/discovery/BrandShelf';
import { CuriosityFeed } from '@/components/discovery/CuriosityFeed';
import { UnifiedFeed } from '@/components/discovery/UnifiedFeed';
import { ApplePodcast } from '@/components/ApplePodcastCard';
import { createLogger } from '@/lib/logger';

const log = createLogger('discover');

interface DailyMixEpisode {
  id: string;
  title: string;
  description: string;
  publishedAt: Date;
  podcastId: string;
  podcastAppleId?: string | null;
  podcastName: string;
  podcastArtwork: string;
  audioUrl: string;
  durationSeconds: number | null;
  summaries: { quick?: any; deep?: any };
}

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
  isSubscribed: boolean;
}

// Memoized artwork URL transformer to avoid repeated string operations
const artworkCache = new Map<string, string>();
function getHighResArtwork(url: string | undefined): string {
  if (!url) return '';
  const cached = artworkCache.get(url);
  if (cached) return cached;
  const highRes = url.replace('100x100', '600x600');
  artworkCache.set(url, highRes);
  return highRes;
}

function mapEpisodes(results: any[], podcasts: ApplePodcast[], subscribedAppleIds: Set<string>): FeedEpisode[] {
  return results
    .filter((result: any) => result.success && result.episodes?.length > 0)
    .flatMap((result: any) => {
      const podcast = podcasts.find((p: ApplePodcast) => p.id === result.podcastId);
      if (!podcast) return [];
      return result.episodes.map((episode: any) => ({
        id: episode.id,
        title: episode.title,
        description: episode.description || '',
        publishedAt: new Date(episode.publishedAt),
        audioUrl: episode.audioUrl,
        duration: episode.duration,
        podcastId: podcast.id,
        podcastName: podcast.name,
        podcastArtist: podcast.artistName,
        podcastArtwork: getHighResArtwork(podcast.artworkUrl),
        podcastFeedUrl: podcast.feedUrl,
        isSubscribed: subscribedAppleIds.has(podcast.id),
      }));
    })
    .sort((a: FeedEpisode, b: FeedEpisode) =>
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );
}

interface PersonalizedSection {
  genreId: string;
  genreName: string;
  label: string;
  podcasts: ApplePodcast[];
}

export default function DiscoverPage() {
  const { country } = useCountry();
  const { subscribedAppleIds } = useSubscription();
  const { user } = useAuth();

  // PROGRESSIVE loading states - each section loads independently
  const [topPodcasts, setTopPodcasts] = useState<ApplePodcast[]>([]);
  const [dailyMixEpisodes, setDailyMixEpisodes] = useState<DailyMixEpisode[]>([]);
  const [dailyMixCursor, setDailyMixCursor] = useState<string | null>(null);
  const [hasMoreDailyMix, setHasMoreDailyMix] = useState(true);
  const isLoadingMoreDailyMix = useRef(false);
  const [feedEpisodes, setFeedEpisodes] = useState<FeedEpisode[]>([]);
  const [isLoadingPodcasts, setIsLoadingPodcasts] = useState(true);
  const [isLoadingDailyMix, setIsLoadingDailyMix] = useState(true);
  const [isLoadingFeed, setIsLoadingFeed] = useState(true);
  const [feedPage, setFeedPage] = useState(0);
  const [hasMoreFeed, setHasMoreFeed] = useState(true);
  const isLoadingMoreFeed = useRef(false);
  const allPodcastsRef = useRef<ApplePodcast[]>([]);
  const [personalizedSections, setPersonalizedSections] = useState<PersonalizedSection[]>([]);
  const [isLoadingPersonalized, setIsLoadingPersonalized] = useState(false);

  // Fire all independent fetches in parallel: daily-mix, top podcasts, and personalized
  useEffect(() => {
    let cancelled = false;

    // Reset states
    setTopPodcasts([]);
    setFeedEpisodes([]);
    setIsLoadingDailyMix(true);
    setIsLoadingPodcasts(true);
    setIsLoadingFeed(true);
    setFeedPage(0);
    setHasMoreFeed(true);
    isLoadingMoreFeed.current = false;
    allPodcastsRef.current = [];
    if (user) setIsLoadingPersonalized(true);

    log.info('Loading...', { userId: user?.id?.slice(0, 8) ?? 'guest', country });

    // 1) Daily Mix (independent, pass country for language filtering)
    const dailyMixPromise = fetch(`/api/discover/daily-mix?country=${country.toLowerCase()}`)
      .then(res => res.json())
      .then(data => {
        if (cancelled) return;
        setDailyMixEpisodes(
          (data.episodes || []).map((ep: any) => ({
            ...ep,
            publishedAt: new Date(ep.publishedAt),
          }))
        );
        setDailyMixCursor(data.nextCursor || null);
        setHasMoreDailyMix(!!data.nextCursor);
      })
      .catch((err) => {
        log.error('Daily mix error', err);
        if (!cancelled) {
          setDailyMixEpisodes([]);
          setHasMoreDailyMix(false);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingDailyMix(false);
      });

    // 2) Top podcasts + batch episodes (sequential chain, but starts in parallel with others)
    const topPodcastsPromise = (async () => {
      try {
        const [primaryRes, usRes] = await Promise.allSettled([
          fetch(`/api/apple/top?country=${country.toLowerCase()}&limit=30`),
          country.toLowerCase() !== 'us'
            ? fetch(`/api/apple/top?country=us&limit=30`)
            : Promise.resolve(null),
        ]);

        if (cancelled) return;

        let allPodcasts: ApplePodcast[] = [];

        if (primaryRes.status === 'fulfilled' && primaryRes.value) {
          const data = await primaryRes.value.json();
          allPodcasts = data.podcasts || [];
        }

        if (usRes.status === 'fulfilled' && usRes.value) {
          const usData = await usRes.value.json();
          const usPodcasts = usData.podcasts || [];
          const existingIds = new Set(allPodcasts.map((p: ApplePodcast) => p.id));
          const uniqueUs = usPodcasts.filter((p: ApplePodcast) => !existingIds.has(p.id));
          allPodcasts = [...allPodcasts, ...uniqueUs];
        }

        log.success('Top podcasts loaded', { count: allPodcasts.length });
        setTopPodcasts(allPodcasts);
        setIsLoadingPodcasts(false);
        allPodcastsRef.current = allPodcasts;

        if (cancelled || allPodcasts.length === 0) {
          setIsLoadingFeed(false);
          return;
        }

        // Batch episodes depends on top podcasts, so stays sequential
        const feedPodcasts = allPodcasts.slice(0, 10);
        const feedRes = await fetch('/api/apple/podcasts/batch-episodes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            podcasts: feedPodcasts.map((p: ApplePodcast) => ({ podcastId: p.id, limit: 3 })),
            country: country.toLowerCase(),
          }),
        });

        if (cancelled) return;

        const feedData = await feedRes.json();
        setFeedEpisodes(mapEpisodes(feedData.results, feedPodcasts, subscribedAppleIds));
        setFeedPage(1);
        setIsLoadingFeed(false);
      } catch (error) {
        log.error('Error fetching discover data', error);
        if (!cancelled) {
          setIsLoadingPodcasts(false);
          setIsLoadingFeed(false);
        }
      }
    })();

    // 3) Personalized recommendations (independent, only for authenticated users)
    const personalizedPromise = user
      ? (async () => {
          try {
            const response = await fetch(`/api/discover/personalized?country=${country.toLowerCase()}`);
            const data = await response.json();
            if (!cancelled) {
              if (data.personalized && data.sections) {
                log.success('Personalized sections loaded', { count: data.sections.length });
                setPersonalizedSections(data.sections);
              } else {
                log.info('No personalized sections');
                setPersonalizedSections([]);
              }
            }
          } catch (error) {
            log.error('Error fetching personalized feed', error);
            if (!cancelled) setPersonalizedSections([]);
          } finally {
            if (!cancelled) setIsLoadingPersonalized(false);
          }
        })()
      : (() => { setPersonalizedSections([]); })();

    // All three fire concurrently via Promise.all
    Promise.all([dailyMixPromise, topPodcastsPromise, personalizedPromise]);

    return () => { cancelled = true; };
  }, [country, user]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadMoreDailyMix = useCallback(async () => {
    if (isLoadingMoreDailyMix.current || !dailyMixCursor) return;
    isLoadingMoreDailyMix.current = true;

    try {
      const res = await fetch(
        `/api/discover/daily-mix?country=${country.toLowerCase()}&cursor=${encodeURIComponent(dailyMixCursor)}`
      );
      const data = await res.json();
      const newEpisodes = (data.episodes || []).map((ep: any) => ({
        ...ep,
        publishedAt: new Date(ep.publishedAt),
      }));

      setDailyMixEpisodes(prev => {
        const existingIds = new Set(prev.map(ep => ep.id));
        const unique = newEpisodes.filter((ep: DailyMixEpisode) => !existingIds.has(ep.id));
        return [...prev, ...unique];
      });
      setDailyMixCursor(data.nextCursor || null);
      setHasMoreDailyMix(!!data.nextCursor);
    } catch (error) {
      log.error('Error loading more daily mix', error);
    } finally {
      isLoadingMoreDailyMix.current = false;
    }
  }, [country, dailyMixCursor]);

  const loadMoreFeed = useCallback(async (podcasts: ApplePodcast[], page: number) => {
    if (isLoadingMoreFeed.current) return;
    isLoadingMoreFeed.current = true;

    const startIdx = page * 5 + 5; // Skip first 5 used in hero
    const endIdx = startIdx + 5;
    const podcastBatch = podcasts.slice(startIdx, endIdx);

    if (podcastBatch.length === 0) {
      setHasMoreFeed(false);
      isLoadingMoreFeed.current = false;
      return;
    }

    try {
      const batchRes = await fetch('/api/apple/podcasts/batch-episodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          podcasts: podcastBatch.map((p: ApplePodcast) => ({ podcastId: p.id, limit: 3 })),
          country: country.toLowerCase(),
        }),
      });
      const batchData = await batchRes.json();
      const newEpisodes = mapEpisodes(batchData.results, podcastBatch, subscribedAppleIds);

      setFeedEpisodes(prev => {
        const existingKeys = new Set(prev.map(ep => `${ep.podcastId}-${ep.id}`));
        const unique = newEpisodes.filter(
          (ep: FeedEpisode) => !existingKeys.has(`${ep.podcastId}-${ep.id}`)
        );
        return [...prev, ...unique];
      });
      setFeedPage(page + 1);
    } catch (error) {
      log.error('Error loading more feed', error);
    } finally {
      isLoadingMoreFeed.current = false;
    }
  }, [country, subscribedAppleIds]);

  const handleLoadMore = useCallback(() => {
    if (hasMoreFeed && allPodcastsRef.current.length > 0) {
      loadMoreFeed(allPodcastsRef.current, feedPage);
    }
  }, [hasMoreFeed, feedPage, loadMoreFeed]);

  return (
    <EpisodeLookupProvider>
      <div className="min-h-screen bg-background text-foreground transition-colors duration-200">
        {/* Sticky Semantic Search */}
        <div className="sticky top-14 lg:top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border/50 transition-colors duration-200">
          <div className="max-w-6xl mx-auto px-4 lg:px-8 py-3">
            <SemanticSearchBar />
          </div>
        </div>

        {/* Main Content */}
        <main className="max-w-6xl mx-auto px-4 lg:px-8 py-8">
          {/* Daily Mix - summarized episodes from DB */}
          <div className="mb-12">
            <DailyMixCarousel
              episodes={dailyMixEpisodes}
              isLoading={isLoadingDailyMix}
              hasMore={hasMoreDailyMix}
              onLoadMore={loadMoreDailyMix}
            />
          </div>

          {/* Unified YouTube + Podcast Feed for authenticated users */}
          {user && (
            <div className="mb-12">
              <UnifiedFeed />
            </div>
          )}

          {/* Personalized Sections - for authenticated users with genre preferences */}
          {personalizedSections.length > 0 && personalizedSections.map((section) => (
            <div key={section.genreId} className="mb-12">
              <BrandShelf
                podcasts={section.podcasts}
                isLoading={false}
                title={section.label}
              />
            </div>
          ))}

          {/* Brand Shelf - shows as soon as top podcasts load (fastest) */}
          <div className="mb-12">
            <BrandShelf podcasts={topPodcasts.slice(0, 15)} isLoading={isLoadingPodcasts} />
          </div>

          {/* Curiosity Feed - shows when feed episodes are ready */}
          <div className="mb-12">
            <CuriosityFeed
              episodes={feedEpisodes}
              isLoading={isLoadingFeed}
              hasMore={hasMoreFeed}
              onLoadMore={handleLoadMore}
            />
          </div>
        </main>
      </div>
    </EpisodeLookupProvider>
  );
}
