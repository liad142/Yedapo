'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useCountry } from '@/contexts/CountryContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useAuth } from '@/contexts/AuthContext';
import { useUsage } from '@/contexts/UsageContext';
import { EpisodeLookupProvider } from '@/contexts/EpisodeLookupContext';
import { SemanticSearchBar } from '@/components/discovery/SemanticSearchBar';
import { DailyMixCarousel } from '@/components/discovery/DailyMixCarousel';
import { TodaysInsights } from '@/components/discovery/TodaysInsights';
import { BrandShelf } from '@/components/discovery/BrandShelf';
import { HighSignalFeed } from '@/components/discovery/HighSignalFeed';
import { TrendingFeed } from '@/components/discovery/TrendingFeed';
import { ApplePodcast } from '@/components/ApplePodcastCard';
import { motion } from 'framer-motion';
import { AlertCircle, RefreshCw, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
  sourceType?: 'podcast' | 'youtube';
  channelId?: string | null;
  summaries: { quick?: any; deep?: any };
  summaryPreview?: { tags?: string[]; hookHeadline?: string; executiveBrief?: string; takeawayCount?: number; chapterCount?: number };
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
  chartRank?: number;
  primaryGenre?: string;
}

function getHighResArtwork(url: string | undefined): string {
  if (!url) return '';
  return url.replace('100x100', '600x600');
}

function mapEpisodes(results: any[], podcasts: ApplePodcast[], subscribedAppleIds: Set<string>, startRank: number = 0): FeedEpisode[] {
  return results
    .filter((result: any) => result.success && result.episodes?.length > 0)
    .flatMap((result: any) => {
      const podcastIndex = podcasts.findIndex((p: ApplePodcast) => p.id === result.podcastId);
      const podcast = podcastIndex >= 0 ? podcasts[podcastIndex] : undefined;
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
        chartRank: startRank > 0 ? startRank + podcastIndex : undefined,
        primaryGenre: podcast.genres?.[0],
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
  const { user, setShowAuthModal } = useAuth();

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

  // Per-section error states
  const [dailyMixError, setDailyMixError] = useState(false);
  const [topPodcastsError, setTopPodcastsError] = useState(false);
  const [feedError, setFeedError] = useState(false);
  const [personalizedError, setPersonalizedError] = useState(false);

  // Guard against state updates after unmount
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

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
    setDailyMixError(false);
    setTopPodcastsError(false);
    setFeedError(false);
    setPersonalizedError(false);
    if (user) setIsLoadingPersonalized(true);

    log.info('Loading...', { userId: user?.id?.slice(0, 8) ?? 'guest', country });

    // 1) Daily Mix (independent, pass country for language filtering)
    const dailyMixPromise = fetch(`/api/discover/daily-mix?country=${country.toLowerCase()}`)
      .then(res => {
        if (!res.ok) throw new Error('Fetch failed: ' + res.status);
        return res.json();
      })
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
          setDailyMixError(true);
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
          if (!primaryRes.value.ok) throw new Error('Fetch failed: ' + primaryRes.value.status);
          const data = await primaryRes.value.json();
          allPodcasts = data.podcasts || [];
        }

        if (usRes.status === 'fulfilled' && usRes.value) {
          if (!usRes.value.ok) throw new Error('Fetch failed: ' + usRes.value.status);
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
        if (!feedRes.ok) throw new Error('Fetch failed: ' + feedRes.status);

        const feedData = await feedRes.json();
        setFeedEpisodes(mapEpisodes(feedData.results, feedPodcasts, subscribedAppleIds, 1));
        setFeedPage(1);
        setIsLoadingFeed(false);
      } catch (error) {
        log.error('Error fetching discover data', error);
        if (!cancelled) {
          setTopPodcastsError(true);
          setFeedError(true);
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
            if (!response.ok) throw new Error('Fetch failed: ' + response.status);
            const data = await response.json();
            if (!cancelled) {
              if (data.personalized && data.sections) {
                // Filter out malformed sections (e.g. from stale cache)
                const validSections = (data.sections as PersonalizedSection[]).filter(
                  (s: PersonalizedSection) => s && s.label && s.genreId && Array.isArray(s.podcasts)
                );
                log.success('Personalized sections loaded', { count: validSections.length, raw: data.sections.length });
                setPersonalizedSections(validSections);
              } else {
                log.info('No personalized sections');
                setPersonalizedSections([]);
              }
            }
          } catch (error) {
            log.error('Error fetching personalized feed', error);
            if (!cancelled) {
              setPersonalizedSections([]);
              setPersonalizedError(true);
            }
          } finally {
            if (!cancelled) setIsLoadingPersonalized(false);
          }
        })()
      : (() => { setPersonalizedSections([]); })();

    // All three fire concurrently via Promise.all
    Promise.all([dailyMixPromise, topPodcastsPromise, personalizedPromise]);

    return () => { cancelled = true; };
  }, [country, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadMoreDailyMix = useCallback(async () => {
    if (isLoadingMoreDailyMix.current || !dailyMixCursor) return;
    isLoadingMoreDailyMix.current = true;

    try {
      const res = await fetch(
        `/api/discover/daily-mix?country=${country.toLowerCase()}&cursor=${encodeURIComponent(dailyMixCursor)}`
      );
      if (!res.ok) throw new Error('Fetch failed: ' + res.status);
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
      if (!batchRes.ok) throw new Error('Fetch failed: ' + batchRes.status);
      const batchData = await batchRes.json();
      const newEpisodes = mapEpisodes(batchData.results, podcastBatch, subscribedAppleIds, startIdx + 1);

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

  // Retry handlers for per-section error recovery
  const retryDailyMix = useCallback(() => {
    setDailyMixError(false);
    setIsLoadingDailyMix(true);
    fetch(`/api/discover/daily-mix?country=${country.toLowerCase()}`)
      .then(res => {
        if (!res.ok) throw new Error('Fetch failed: ' + res.status);
        return res.json();
      })
      .then(data => {
        if (!isMountedRef.current) return;
        setDailyMixEpisodes(
          (data.episodes || []).map((ep: any) => ({
            ...ep,
            publishedAt: new Date(ep.publishedAt),
          }))
        );
        setDailyMixCursor(data.nextCursor || null);
        setHasMoreDailyMix(!!data.nextCursor);
      })
      .catch(() => { if (isMountedRef.current) setDailyMixError(true); })
      .finally(() => { if (isMountedRef.current) setIsLoadingDailyMix(false); });
  }, [country]);

  const retryTopPodcasts = useCallback(async () => {
    setTopPodcastsError(false);
    setFeedError(false);
    setIsLoadingPodcasts(true);
    setIsLoadingFeed(true);
    try {
      const res = await fetch(`/api/apple/top?country=${country.toLowerCase()}&limit=30`);
      if (!res.ok) throw new Error('Fetch failed: ' + res.status);
      const data = await res.json();
      const allPods = data.podcasts || [];
      setTopPodcasts(allPods);
      allPodcastsRef.current = allPods;
      setIsLoadingPodcasts(false);

      if (allPods.length > 0) {
        const feedPodcasts = allPods.slice(0, 10);
        const feedRes = await fetch('/api/apple/podcasts/batch-episodes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            podcasts: feedPodcasts.map((p: ApplePodcast) => ({ podcastId: p.id, limit: 3 })),
            country: country.toLowerCase(),
          }),
        });
        if (!feedRes.ok) throw new Error('Fetch failed: ' + feedRes.status);
        const feedData = await feedRes.json();
        setFeedEpisodes(mapEpisodes(feedData.results, feedPodcasts, subscribedAppleIds, 1));
        setFeedPage(1);
      }
    } catch {
      setTopPodcastsError(true);
      setFeedError(true);
    } finally {
      setIsLoadingPodcasts(false);
      setIsLoadingFeed(false);
    }
  }, [country, subscribedAppleIds]);

  const retryPersonalized = useCallback(async () => {
    setPersonalizedError(false);
    setIsLoadingPersonalized(true);
    try {
      const response = await fetch(`/api/discover/personalized?country=${country.toLowerCase()}`);
      if (!response.ok) throw new Error('Fetch failed: ' + response.status);
      const data = await response.json();
      if (data.personalized && data.sections) {
        const validSections = (data.sections as PersonalizedSection[]).filter(
          (s: PersonalizedSection) => s && s.label && s.genreId && Array.isArray(s.podcasts)
        );
        setPersonalizedSections(validSections);
      } else {
        setPersonalizedSections([]);
      }
    } catch {
      setPersonalizedError(true);
    } finally {
      setIsLoadingPersonalized(false);
    }
  }, [country]);

  // Deduplicate trending feed: exclude podcasts already well-represented in Daily Mix
  const trendingEpisodes = (() => {
    if (dailyMixEpisodes.length === 0 || feedEpisodes.length === 0) return feedEpisodes;
    const dailyMixPodcasts = new Map<string, number>();
    dailyMixEpisodes.forEach(ep => {
      const name = ep.podcastName;
      if (name) dailyMixPodcasts.set(name, (dailyMixPodcasts.get(name) || 0) + 1);
    });
    const deduped = feedEpisodes.filter(ep => (dailyMixPodcasts.get(ep.podcastName) || 0) < 2);
    return deduped.length >= 5 ? deduped : feedEpisodes;
  })();

  // Quota visibility
  const { usage } = useUsage();

  return (
    <EpisodeLookupProvider>
      <div className="min-h-screen bg-background text-foreground transition-colors duration-200">
        {/* Sticky Semantic Search */}
        <div className="sticky top-14 lg:top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border/50 transition-colors duration-200">
          <div className="max-w-6xl mx-auto px-4 lg:px-8 py-3">
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <SemanticSearchBar />
              </div>
              {/* Quota visibility chip */}
              {user && usage && !usage.isUnlimited && (
                <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary border border-border text-xs font-medium text-muted-foreground shrink-0">
                  <Sparkles className="h-3.5 w-3.5" />
                  {usage.summary.used}/{usage.summary.limit} summaries
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Main Content — Order: TodaysInsights, Personalized, DailyMix, TopPodcasts, HighSignalFeed */}
        <main className="max-w-6xl mx-auto px-4 lg:px-8 py-8">
          {/* 1. Today's Insights */}
          <motion.div
            className="mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.4 }}
          >
            <TodaysInsights />
          </motion.div>

          {/* 2. Personalized Shelves */}
          {personalizedError ? (
            <SectionError
              title="Personalized Recommendations"
              onRetry={retryPersonalized}
            />
          ) : personalizedSections.length > 0 && personalizedSections.filter(s => s?.label).map((section) => (
            <motion.div
              key={section.genreId}
              className="mb-12"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.4 }}
            >
              <BrandShelf
                podcasts={section.podcasts}
                isLoading={false}
                title={section.label}
                genreId={section.genreId}
                showBestThisWeek
              />
            </motion.div>
          ))}

          {/* 3. Daily Mix */}
          {dailyMixError ? (
            <SectionError title="Daily Mix" onRetry={retryDailyMix} />
          ) : (
            <motion.div
              className="mb-12"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.4 }}
            >
              <DailyMixCarousel
                episodes={dailyMixEpisodes}
                isLoading={isLoadingDailyMix}
                hasMore={hasMoreDailyMix}
                onLoadMore={loadMoreDailyMix}
              />
            </motion.div>
          )}

          {/* 4. Top Podcasts */}
          {topPodcastsError ? (
            <SectionError title="Top Podcasts" onRetry={retryTopPodcasts} />
          ) : (
            <motion.div
              className="mb-12"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.4 }}
            >
              <BrandShelf podcasts={topPodcasts.slice(0, 15)} isLoading={isLoadingPodcasts} />
            </motion.div>
          )}

          {/* 5. For You Feed — personalized (auth-gated) */}
          <motion.div
            className="mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.4 }}
          >
            {user ? (
              <HighSignalFeed />
            ) : (
              <div className="rounded-2xl border border-border bg-card p-8 text-center">
                <h2 className="text-lg font-semibold mb-2">Your personalized feed</h2>
                <p className="text-sm text-muted-foreground mb-4">
                  Sign in to get AI-powered recommendations based on your interests
                </p>
                <Button onClick={() => setShowAuthModal(true, 'Sign in to get personalized podcast recommendations.')} size="sm">
                  Sign In
                </Button>
              </div>
            )}
          </motion.div>

          {/* 6. Trending Feed — editorial, always visible */}
          {feedError ? (
            <SectionError title="Trending Episodes" onRetry={retryTopPodcasts} />
          ) : (
            <motion.div
              id="trending-feed"
              className="mb-12"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.4 }}
            >
              <TrendingFeed
                episodes={trendingEpisodes}
                isLoading={isLoadingFeed}
                hasMore={hasMoreFeed}
                onLoadMore={handleLoadMore}
              />
            </motion.div>
          )}

          {/* Attribution */}
          <p className="text-xs text-muted-foreground text-center pt-4 pb-2">
            Podcast data provided by Apple Podcasts
          </p>
        </main>
      </div>
    </EpisodeLookupProvider>
  );
}

/* --- Per-section error state with retry button --- */
function SectionError({ title, onRetry }: { title: string; onRetry: () => void }) {
  return (
    <div className="mb-12 rounded-2xl border border-border bg-card p-6 text-center">
      <div className="flex flex-col items-center gap-3">
        <AlertCircle className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Failed to load {title}
        </p>
        <Button variant="outline" size="sm" onClick={onRetry} className="gap-2">
          <RefreshCw className="h-3.5 w-3.5" />
          Retry
        </Button>
      </div>
    </div>
  );
}
