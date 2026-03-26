"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import posthog from "posthog-js";
import { EpisodeSmartFeed } from "@/components/insights/EpisodeSmartFeed";
import { ShareMenu } from "@/components/insights/ShareMenu";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/client";
import { summaryToMarkdown } from "@/lib/summary-to-markdown";
import type { Episode, Podcast, QuickSummaryContent, DeepSummaryContent } from "@/types/database";
import { Clock, Calendar, ChevronRight } from "lucide-react";
import { YouTubeLogo } from "@/components/YouTubeLogo";
import { InlinePlayButton } from "@/components/PlayButton";
import type { YouTubeEmbedRef } from "@/components/YouTubeEmbed";
import { FloatingYouTubePlayer } from "@/components/FloatingYouTubePlayer";
import { isYouTubeContent, extractYouTubeVideoId, getYouTubeThumbnail } from "@/lib/youtube/utils";
import { createLogger } from '@/lib/logger';
import { formatDate, formatDuration } from '@/lib/formatters';

const log = createLogger('insights');
const supabase = createClient();

interface EpisodeData extends Episode {
  podcast?: Podcast;
}

export default function EpisodeInsightsPage() {
  const params = useParams();
  const router = useRouter();
  const episodeId = params.id as string;

  const [episode, setEpisode] = useState<EpisodeData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Summary data from EpisodeSmartFeed (for ShareMenu markdown)
  const [summaryData, setSummaryData] = useState<{
    quick?: QuickSummaryContent | null;
    deep?: DeepSummaryContent | null;
    summaryReady: boolean;
  }>({ summaryReady: false });

  const markdownContent = useMemo(() => {
    if (!episode || !summaryData.summaryReady) return undefined;
    return summaryToMarkdown({
      episodeTitle: episode.title,
      podcastName: episode.podcast?.title || 'Unknown Podcast',
      publishedAt: episode.published_at,
      durationSeconds: episode.duration_seconds,
      quickSummary: summaryData.quick,
      deepSummary: summaryData.deep,
      url: typeof window !== 'undefined' ? window.location.href : undefined,
    });
  }, [episode, summaryData]);

  const youtubePlayerRef = useRef<YouTubeEmbedRef>(null);
  const [videoCurrentTime, setVideoCurrentTime] = useState(0);
  const lastSecondRef = useRef(0);
  const handleTimeUpdate = useCallback((seconds: number) => {
    const rounded = Math.floor(seconds);
    if (rounded !== lastSecondRef.current) {
      lastSecondRef.current = rounded;
      setVideoCurrentTime(rounded);
    }
  }, []);

  const fetchEpisode = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Fetch episode + podcast in one query via join
      const { data: episodeData, error: episodeError } = await supabase
        .from("episodes")
        .select("*, podcasts(*)")
        .eq("id", episodeId)
        .single();

      if (episodeError) throw episodeError;

      const podcastData = episodeData.podcasts;

      setEpisode({
        ...episodeData,
        podcast: podcastData || undefined,
      });
      posthog.capture('insights_viewed', { episode_id: episodeId, podcast_name: podcastData?.title });
    } catch (err) {
      log.error("Error fetching episode", err);
      setError("Failed to load episode");
    } finally {
      setIsLoading(false);
    }
  }, [episodeId]);

  useEffect(() => {
    if (episodeId) {
      fetchEpisode();
    }
  }, [episodeId, fetchEpisode]);

  // Update last_viewed_at for the podcast subscription (clears green dot in My List)
  useEffect(() => {
    if (!episode?.podcast_id) return;
    fetch(`/api/subscriptions/${episode.podcast_id}`, { method: 'PATCH' }).catch(() => {});
  }, [episode?.podcast_id]);

  const isYouTube = isYouTubeContent(episode?.podcast);

  // Navigate to the podcast's browse page
  const navigateToPodcast = useCallback(async () => {
    const podcast = episode?.podcast;
    if (!podcast) { router.back(); return; }

    // 1. Use apple_id column if available
    if (podcast.apple_id) {
      router.push(`/browse/podcast/${podcast.apple_id}`);
      return;
    }
    // 2. Extract from apple: prefixed rss_feed_url
    if (podcast.rss_feed_url?.startsWith('apple:')) {
      router.push(`/browse/podcast/${podcast.rss_feed_url.replace('apple:', '')}`);
      return;
    }
    // 3. YouTube channel
    if (podcast.rss_feed_url?.startsWith('youtube:channel:')) {
      router.push(`/browse/youtube/${podcast.rss_feed_url.replace('youtube:channel:', '')}`);
      return;
    }
    // 4. Resolve Apple ID via API (for podcasts imported before apple_id column)
    try {
      const res = await fetch(`/api/podcasts/${podcast.id}/resolve-apple-id`);
      if (res.ok) {
        const { apple_id } = await res.json();
        if (apple_id) {
          router.push(`/browse/podcast/${apple_id}`);
          return;
        }
      }
    } catch {
      // Resolve failed — fall through
    }
    // Last resort: go back
    router.back();
  }, [episode, router]);

  if (error && !episode) {
    return (
      <div className="min-h-screen bg-background">
        <div className="flex items-center justify-center h-[60vh]">
          <div className="text-center">
            <p className="text-destructive mb-4">{error}</p>
            <Button variant="outline" onClick={() => router.back()}>
              Go Back
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // For YouTube videos, derive thumbnail from video URL; otherwise use podcast artwork
  const youtubeVideoId = isYouTube ? extractYouTubeVideoId(episode?.audio_url) : null;

  const artworkUrl = isYouTube && youtubeVideoId
    ? getYouTubeThumbnail(youtubeVideoId)
    : episode?.podcast?.image_url &&
      typeof episode.podcast.image_url === "string" &&
      episode.podcast.image_url.startsWith("http")
        ? episode.podcast.image_url
        : null;

  return (
    <div className="min-h-screen bg-background flex flex-col overflow-x-hidden">
      {/* ── Hero Header ── */}
      <div className="border-b border-border mb-8">
        <div className="container mx-auto px-4 pt-5 pb-8 max-w-3xl">
          {isLoading ? (
            <div className="space-y-5">
              <Skeleton className="h-4 w-28" />
              <div className="flex gap-5 items-start">
                <Skeleton className="w-20 h-20 rounded-xl shrink-0" />
                <div className="space-y-3 flex-1 pt-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-8 w-5/6" />
                  <div className="flex gap-3 pt-1">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Skeleton className="h-10 w-24 rounded-lg" />
                    <Skeleton className="h-10 w-20 rounded-lg" />
                  </div>
                </div>
              </div>
            </div>
          ) : episode ? (
            <div className="space-y-5">
              {/* Breadcrumb */}
              <nav className="flex items-center gap-1.5 text-caption text-muted-foreground min-w-0">
                <button
                  onClick={() => router.push('/discover')}
                  className="hidden sm:inline hover:text-foreground transition-colors shrink-0"
                >
                  Discover
                </button>
                <ChevronRight className="hidden sm:block h-3.5 w-3.5 shrink-0" />
                <button
                  onClick={navigateToPodcast}
                  className="hover:text-foreground transition-colors truncate max-w-[40vw] sm:max-w-[200px]"
                >
                  {episode.podcast?.title || "Podcast"}
                </button>
                <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                <span className="text-foreground shrink-0">Insights</span>
              </nav>

              {/* YouTube Embed with floating mini-player on scroll */}
              {isYouTube && youtubeVideoId ? (
                <FloatingYouTubePlayer
                  playerRef={youtubePlayerRef}
                  videoId={youtubeVideoId}
                  title={episode.title}
                  onTimeUpdate={handleTimeUpdate}
                  className="mb-4"
                />
              ) : null}

              {/* Art + Info */}
              <div className="flex gap-5 items-start">
                {!isYouTube && artworkUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={artworkUrl}
                    alt={episode.podcast?.title || "Podcast artwork"}
                    className="w-20 h-20 rounded-xl object-cover shrink-0 shadow-[var(--shadow-2)]"
                  />
                )}

                <div className="flex-1 min-w-0 space-y-2">
                  {/* Podcast name */}
                  <button
                    onClick={navigateToPodcast}
                    className="text-body-sm text-muted-foreground font-medium hover:text-foreground transition-colors truncate block max-w-full"
                  >
                    {episode.podcast?.title || "Unknown Podcast"}
                  </button>

                  {/* Episode title */}
                  <h1 className="text-h1 text-foreground line-clamp-3">
                    {episode.title}
                  </h1>

                  {/* Metadata: date + duration */}
                  <div className="flex items-center gap-4 text-muted-foreground">
                    {episode.published_at && (
                      <span className="inline-flex items-center gap-1.5 text-body-sm">
                        <Calendar className="h-3.5 w-3.5" />
                        {formatDate(episode.published_at)}
                      </span>
                    )}
                    {episode.duration_seconds && (
                      <span className="inline-flex items-center gap-1.5 text-body-sm">
                        <Clock className="h-3.5 w-3.5" />
                        {formatDuration(episode.duration_seconds)}
                      </span>
                    )}
                    {isYouTube && (
                      <YouTubeLogo videoId={youtubeVideoId} size="sm" />
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-2 pt-1">
                    {!isYouTube && episode.audio_url && episode.podcast ? (
                      <InlinePlayButton
                        track={{
                          id: episode.id,
                          title: episode.title,
                          artist: episode.podcast.title || episode.podcast.author || "Unknown",
                          artworkUrl: episode.podcast.image_url || "",
                          audioUrl: episode.audio_url,
                          duration: episode.duration_seconds || undefined,
                        }}
                        className="h-10 px-5 text-sm bg-primary hover:bg-primary/90"
                      />
                    ) : null}
                    <ShareMenu
                      episodeId={episodeId}
                      episodeTitle={episode.title}
                      podcastName={episode.podcast?.title || "Unknown Podcast"}
                      summaryReady={summaryData.summaryReady}
                      markdownContent={markdownContent}
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Smart Feed */}
      <div className="flex-1">
        {episode && (
          <EpisodeSmartFeed
            episode={episode}
            youtubePlayerRef={isYouTube ? youtubePlayerRef : undefined}
            videoCurrentTime={isYouTube ? videoCurrentTime : undefined}
            onSummaryData={setSummaryData}
          />
        )}
      </div>

    </div>
  );
}
