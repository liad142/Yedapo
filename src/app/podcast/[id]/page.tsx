"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { SafeImage } from "@/components/SafeImage";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import { useSummarizeQueue } from "@/contexts/SummarizeQueueContext";
import { SummarizeButton } from "@/components/SummarizeButton";
import { InlinePlayButton } from "@/components/PlayButton";
import type { Podcast } from "@/types/database";
import { ArrowLeft, Mic2, Calendar, Globe, Rss, Clock, FileText, Loader2 } from "lucide-react";
import { createLogger } from "@/lib/logger";

const log = createLogger('podcast');

interface Episode {
  id: string;
  podcastId: string;
  title: string;
  description: string;
  publishedAt: string;
  duration: number;
  audioUrl?: string;
  artworkUrl?: string;
  episodeNumber?: number;
  seasonNumber?: number;
  isFromDb?: boolean;
}

interface SummaryAvailability {
  audioUrl: string;
  episodeId: string | null;
  hasQuickSummary: boolean;
  hasDeepSummary: boolean;
  quickStatus: string | null;
  deepStatus: string | null;
}

export default function PodcastPage() {
  const params = useParams();
  const podcastId = params.id as string;

  const [podcast, setPodcast] = useState<Podcast | null>(null);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingEpisodes, setIsLoadingEpisodes] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [appleId, setAppleId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [summaryAvailability, setSummaryAvailability] = useState<Map<string, SummaryAvailability>>(new Map());
  const [importingEpisodeId, setImportingEpisodeId] = useState<string | null>(null);

  const { addToQueue } = useSummarizeQueue();

  // Load podcast AND episodes together to avoid timing issues
  useEffect(() => {
    async function loadAll() {
      if (!podcastId) return;

      try {
        setIsLoading(true);
        setIsLoadingEpisodes(true);
        setError(null);

        // 1. Fetch podcast from DB
        const { data: podcastData, error: podcastError } = await supabase
          .from("podcasts")
          .select("*")
          .eq("id", podcastId)
          .single();

        if (podcastError) throw podcastError;
        setPodcast(podcastData);
        setIsLoading(false);

        // 2. Determine Apple ID directly
        const isApplePodcast = podcastData.rss_feed_url?.startsWith('apple:');
        const resolvedAppleId = isApplePodcast
          ? podcastData.rss_feed_url.replace('apple:', '')
          : null;
        setAppleId(resolvedAppleId);

        log.info('Loading episodes', {
          podcastId,
          isApplePodcast,
          appleId: resolvedAppleId,
        });

        // 3. Fetch episodes
        if (resolvedAppleId) {
          // Fetch from Apple API
          try {
            const response = await fetch(`/api/apple/podcasts/${resolvedAppleId}/episodes?limit=50&offset=0`);
            if (!response.ok) {
              log.error('Apple API error', { status: response.status });
              throw new Error('Failed to fetch from Apple');
            }
            const data = await response.json();
            log.success('Apple episodes loaded', { count: data.episodes?.length });
            setEpisodes(data.episodes || []);
            setHasMore(data.hasMore ?? false);
            setTotalCount(data.totalCount ?? data.episodes?.length ?? 0);
          } catch (appleErr) {
            log.warn('Apple fetch failed, trying local DB', { error: String(appleErr) });
            // Fallback to local DB
            await fetchLocalEpisodes(podcastData);
          }
        } else {
          // Not an Apple podcast - fetch from local DB
          await fetchLocalEpisodes(podcastData);
        }

      } catch (err) {
        log.error('Error loading podcast', err);
        setError("Failed to load podcast");
        setIsLoading(false);
      } finally {
        setIsLoadingEpisodes(false);
      }
    }

    async function fetchLocalEpisodes(podcastData: Podcast) {
      const { data: dbEpisodes, error: dbError } = await supabase
        .from('episodes')
        .select('id, podcast_id, title, description, audio_url, transcript_url, duration_seconds, published_at, created_at')
        .eq('podcast_id', podcastId)
        .order('published_at', { ascending: false });

      if (dbError) {
        log.error('DB episodes error', dbError);
        setEpisodes([]);
        return;
      }

      log.success('Local episodes loaded', { count: dbEpisodes?.length });

      const mappedEpisodes: Episode[] = (dbEpisodes || []).map((ep: any) => ({
        id: ep.id,
        podcastId: ep.podcast_id,
        title: ep.title,
        description: ep.description || '',
        publishedAt: ep.published_at || ep.created_at,
        duration: ep.duration_seconds || 0,
        audioUrl: ep.audio_url,
        artworkUrl: typeof podcastData.image_url === 'string' ? podcastData.image_url : undefined,
        isFromDb: true,
      }));

      setEpisodes(mappedEpisodes);
    }

    loadAll();
  }, [podcastId]);

  const handleLoadMore = async () => {
    if (!appleId) return;
    setIsLoadingMore(true);
    try {
      const response = await fetch(
        `/api/apple/podcasts/${appleId}/episodes?limit=50&offset=${episodes.length}`
      );
      if (!response.ok) throw new Error('Failed to fetch more episodes');
      const data = await response.json();
      setEpisodes(prev => [...prev, ...(data.episodes || [])]);
      setHasMore(data.hasMore ?? false);
      setTotalCount(data.totalCount ?? totalCount);
    } catch (err) {
      log.error('Error loading more episodes', err);
    } finally {
      setIsLoadingMore(false);
    }
  };

  // Mark subscription as viewed (clears "NEW" badge) - only for authenticated users
  useEffect(() => {
    const updateLastViewed = async () => {
      if (!podcastId) return;

      try {
        await fetch(`/api/subscriptions/${podcastId}`, {
          method: 'PATCH',
        });
      } catch {
        // Silently fail - user might not be authenticated or subscribed
      }
    };

    updateLastViewed();
  }, [podcastId]);

  // Check for existing summaries
  useEffect(() => {
    async function checkSummaries() {
      const audioUrls = episodes
        .map(e => e.audioUrl)
        .filter((url): url is string => !!url);

      if (audioUrls.length === 0) return;

      try {
        const response = await fetch('/api/summaries/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ audioUrls }),
        });

        if (!response.ok) return;

        const data = await response.json();
        const availabilityMap = new Map<string, SummaryAvailability>();
        for (const item of data.availability) {
          availabilityMap.set(item.audioUrl, item);
        }
        setSummaryAvailability(availabilityMap);
      } catch (err) {
        log.error('Error checking summaries', err);
      }
    }

    if (episodes.length > 0) {
      checkSummaries();
    }
  }, [episodes]);

  const handleSummarize = async (episode: Episode) => {
    if (!podcast || !episode.audioUrl) return;

    // If episode is from local DB, it already has the correct ID
    if (episode.isFromDb) {
      addToQueue(episode.id);
      return;
    }

    const availability = summaryAvailability.get(episode.audioUrl);
    if (availability?.episodeId) {
      addToQueue(availability.episodeId);
      return;
    }

    setImportingEpisodeId(episode.id);

    try {
      // Extract Apple ID from rss_feed_url
      const appleId = podcast.rss_feed_url?.startsWith('apple:')
        ? podcast.rss_feed_url.replace('apple:', '')
        : podcastId;

      const response = await fetch('/api/episodes/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          episode: {
            externalId: episode.id,
            title: episode.title,
            description: episode.description,
            publishedAt: episode.publishedAt,
            duration: episode.duration,
            audioUrl: episode.audioUrl,
          },
          podcast: {
            externalId: appleId,
            name: podcast.title,
            artistName: podcast.author || '',
            artworkUrl: typeof podcast.image_url === 'string' ? podcast.image_url : '',
            feedUrl: podcast.rss_feed_url,
          },
        }),
      });

      if (!response.ok) throw new Error('Failed to import episode');

      const { episodeId } = await response.json();

      setSummaryAvailability(prev => {
        const updated = new Map(prev);
        updated.set(episode.audioUrl!, {
          audioUrl: episode.audioUrl!,
          episodeId,
          hasQuickSummary: false,
          hasDeepSummary: false,
          quickStatus: null,
          deepStatus: null,
        });
        return updated;
      });

      addToQueue(episodeId);
    } catch (err) {
      log.error('Error importing episode', err);
    } finally {
      setImportingEpisodeId(null);
    }
  };

  const getEpisodeSummaryInfo = (episode: Episode) => {
    // For local DB episodes, the episode.id IS the episodeId
    if (episode.isFromDb) {
      const info = episode.audioUrl ? summaryAvailability.get(episode.audioUrl) : null;
      return {
        audioUrl: episode.audioUrl || '',
        episodeId: episode.id,
        hasQuickSummary: info?.hasQuickSummary || false,
        hasDeepSummary: info?.hasDeepSummary || false,
        quickStatus: info?.quickStatus || null,
        deepStatus: info?.deepStatus || null,
      };
    }

    if (!episode.audioUrl) return null;
    return summaryAvailability.get(episode.audioUrl) || null;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatDuration = (seconds: number): string => {
    if (!seconds) return '';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes} min`;
  };

  if (error && !podcast) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="text-center py-12">
            <p className="text-destructive">{error}</p>
            <Link href="/my-podcasts">
              <Button variant="outline" className="mt-4">
                Return to My Podcasts
              </Button>
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8">
        {/* Back Button */}
        <div className="mb-6">
          <Link href="/my-podcasts">
            <Button variant="ghost" className="-ml-2">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to My Podcasts
            </Button>
          </Link>
        </div>

        {isLoading ? (
          <div className="space-y-8">
            <div className="flex flex-col md:flex-row gap-6">
              <Skeleton className="w-48 h-48 rounded-lg shrink-0" />
              <div className="flex-1 space-y-4">
                <Skeleton className="h-8 w-3/4" />
                <Skeleton className="h-5 w-1/2" />
                <div className="flex gap-2">
                  <Skeleton className="h-6 w-24" />
                  <Skeleton className="h-6 w-16" />
                </div>
                <Skeleton className="h-20 w-full" />
              </div>
            </div>
          </div>
        ) : podcast ? (
          <div className="space-y-8">
            {/* Immersive Header */}
            <div className="relative overflow-hidden rounded-3xl bg-slate-900 mb-8 border border-white/10 shadow-2xl">
              {/* Blurred Background Backdrop */}
              <div className="absolute inset-0 z-0">
                {podcast.image_url ? (
                  <SafeImage
                    src={Array.isArray(podcast.image_url) ? podcast.image_url[0] : podcast.image_url}
                    alt=""
                    fill
                    className="object-cover blur-3xl scale-110 opacity-60"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-blue-900 via-slate-900 to-black" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent" />
              </div>

              {/* Content Overlay */}
              <div className="relative z-10 p-8 md:p-12 flex flex-col md:flex-row gap-8 items-center md:items-start text-center md:text-left">
                <div className="w-48 h-48 md:w-56 md:h-56 shrink-0 rounded-2xl overflow-hidden shadow-2xl border-2 border-white/10 rotate-1 md:rotate-0 transition-transform hover:scale-105 duration-500">
                  {podcast.image_url ? (
                    <SafeImage
                      src={Array.isArray(podcast.image_url) ? podcast.image_url[0] : podcast.image_url}
                      alt={podcast.title}
                      width={224}
                      height={224}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-white/5">
                      <Mic2 className="h-16 w-16 text-white/40" />
                    </div>
                  )}
                </div>

                <div className="flex-1 space-y-4">
                  <div>
                    <h1 className="text-3xl md:text-5xl font-bold text-white mb-3 tracking-tight leading-tight drop-shadow-sm">
                      {podcast.title}
                    </h1>
                    {podcast.author && (
                      <p className="text-lg md:text-xl text-slate-300 font-medium tracking-wide">
                        {podcast.author}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap justify-center md:justify-start gap-2">
                    <span className="px-3 py-1 rounded-full bg-white/10 backdrop-blur-sm border border-white/10 text-xs font-semibold text-white/90">
                      {episodes.length} episodes
                    </span>
                    {podcast.language && (
                      <span className="px-3 py-1 rounded-full bg-white/10 backdrop-blur-sm border border-white/10 text-xs font-semibold text-white/90 uppercase flex items-center gap-1">
                        <Globe className="h-3 w-3" />
                        {podcast.language}
                      </span>
                    )}
                    <span className="px-3 py-1 rounded-full bg-white/10 backdrop-blur-sm border border-white/10 text-xs font-semibold text-white/90 flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatDate(podcast.created_at)}
                    </span>
                  </div>

                  {podcast.description && (
                    <p className="text-slate-300 leading-relaxed max-w-2xl line-clamp-3 text-sm md:text-base border-l-2 border-white/20 pl-4">
                      {podcast.description}
                    </p>
                  )}

                  {podcast.rss_feed_url && !podcast.rss_feed_url.startsWith('apple:') && (
                    <div className="pt-2">
                      <a
                        href={podcast.rss_feed_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-300 hover:text-blue-200 transition-colors"
                      >
                        <Rss className="h-3.5 w-3.5" />
                        RSS Feed
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Episodes Section */}
            <section className="bg-secondary/50 md:bg-transparent -mx-4 px-4 py-8 md:px-0 md:mx-0 md:py-0">
              <h2 className="text-2xl font-bold tracking-tight text-foreground mb-6">Episodes</h2>

              {isLoadingEpisodes ? (
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
              ) : episodes.length === 0 ? (
                <div className="text-center py-12 bg-card rounded-2xl shadow-[var(--shadow-1)] border border-border">
                  <p className="text-muted-foreground mb-2">
                    No episodes found.
                  </p>
                  <p className="text-sm text-muted-foreground/70">
                    This might be a temporary issue. Try refreshing the page.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {episodes.map((episode) => {
                    const summaryInfo = getEpisodeSummaryInfo(episode);
                    const hasSummary = summaryInfo?.hasQuickSummary || summaryInfo?.hasDeepSummary;
                    const canNavigate = summaryInfo?.episodeId;

                    return (
                      <div key={episode.id} className="group bg-card rounded-2xl p-6 shadow-[var(--shadow-1)] hover:shadow-[var(--shadow-2)] transition-all duration-300 border border-border">
                        <div className="flex gap-5 items-start">
                          {/* Thumbnail - Hidden if needed or small */}
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
                              <Link href={`/episode/${summaryInfo.episodeId}`}>
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
                                  onClick={() => handleSummarize(episode)}
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

                              {episode.audioUrl && podcast && (
                                <div className="scale-90 origin-left">
                                  <InlinePlayButton
                                    track={{
                                      id: episode.id,
                                      title: episode.title,
                                      artist: podcast.title || podcast.author || 'Unknown',
                                      artworkUrl: episode.artworkUrl || podcast.image_url || '',
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
                  })}

                  {/* Load More */}
                  {hasMore && (
                    <div className="mt-8 text-center">
                      <Button
                        onClick={handleLoadMore}
                        disabled={isLoadingMore}
                        variant="outline"
                        className="rounded-full px-8"
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
              )}
            </section>
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Podcast not found</p>
            <Link href="/my-podcasts">
              <Button variant="outline" className="mt-4">
                Return to My Podcasts
              </Button>
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
