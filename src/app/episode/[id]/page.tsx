"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/Header";
import { SummaryPanel } from "@/components/SummaryPanel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/client";
import type { Episode, Podcast, SummaryStatus } from "@/types/database";
import posthog from "posthog-js";
import {
  ArrowLeft,
  Calendar,
  Clock,
  FileText,
  Brain,
  Share2,
} from "lucide-react";
import { YouTubeLogo } from "@/components/YouTubeLogo";
import { SummarizeButton } from "@/components/SummarizeButton";
import { InlinePlayButton } from "@/components/PlayButton";
import { useAuth } from "@/contexts/AuthContext";
import { YouTubeEmbed } from "@/components/YouTubeEmbed";
import type { YouTubeEmbedRef } from "@/components/YouTubeEmbed";
import { isYouTubeContent, extractYouTubeVideoId } from "@/lib/youtube/utils";
import { createLogger } from '@/lib/logger';
import { formatDate, formatDuration } from '@/lib/formatters';

const log = createLogger('episode');
const supabase = createClient();

interface EpisodeData extends Episode {
  podcast?: Podcast;
}

interface SummariesData {
  quick: { status: SummaryStatus } | null;
  deep: { status: SummaryStatus } | null;
}

export default function EpisodePage() {
  const params = useParams();
  const episodeId = params.id as string;
  const { user, setShowAuthModal } = useAuth();

  const [episode, setEpisode] = useState<EpisodeData | null>(null);
  const [summaries, setSummaries] = useState<SummariesData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const youtubePlayerRef = useRef<YouTubeEmbedRef>(null);
  const [videoCurrentTime, setVideoCurrentTime] = useState(0);

  const fetchEpisodeData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Fetch episode + podcast in one query, summaries in parallel
      const [episodeResult, summariesRes] = await Promise.all([
        supabase
          .from("episodes")
          .select("*, podcasts(*)")
          .eq("id", episodeId)
          .single(),
        fetch(`/api/episodes/${episodeId}/summaries`),
      ]);

      if (episodeResult.error) throw episodeResult.error;
      const episodeData = episodeResult.data;
      const podcastData = episodeData.podcasts;

      setEpisode({
        ...episodeData,
        podcast: podcastData || undefined,
      });
      posthog.capture('episode_viewed', { episode_id: episodeId, podcast_name: podcastData?.title, is_youtube: podcastData?.rss_feed_url?.startsWith('youtube:') || false });

      if (summariesRes.ok) {
        const summariesData = await summariesRes.json();
        setSummaries(summariesData.summaries);
      }
    } catch (err) {
      log.error("Error fetching episode", err);
      setError("Failed to load episode");
    } finally {
      setIsLoading(false);
    }
  }, [episodeId]);

  useEffect(() => {
    if (episodeId) {
      fetchEpisodeData();
    }
  }, [episodeId, fetchEpisodeData]);

  const hasSummaryReady = summaries?.quick?.status === 'ready' || summaries?.deep?.status === 'ready';

  const isYouTube = isYouTubeContent(episode?.podcast);
  const youtubeVideoId = isYouTube ? extractYouTubeVideoId(episode?.audio_url) : null;

  // Extract Apple podcast ID from rss_feed_url (format: "apple:123456" or actual RSS URL)
  const getBackLink = () => {
    const rssUrl = episode?.podcast?.rss_feed_url;
    if (rssUrl?.startsWith('youtube:channel:')) {
      return '/discover';
    }
    if (rssUrl?.startsWith('apple:')) {
      const appleId = rssUrl.replace('apple:', '');
      return `/browse/podcast/${appleId}`;
    }
    // Fallback to internal podcast page if not an Apple import
    return `/podcast/${episode?.podcast_id}`;
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="flex">
        {/* Main content */}
        <main className={`flex-1 container mx-auto px-4 py-8 ${isYouTube && youtubeVideoId ? 'max-w-6xl' : 'max-w-4xl'}`}>
          {isLoading ? (
            <div className="space-y-6">
              <Skeleton className="h-9 w-32" />
              <div className="space-y-4">
                <Skeleton className="h-8 w-3/4" />
                <Skeleton className="h-5 w-1/2" />
                <div className="flex gap-3">
                  <Skeleton className="h-6 w-24" />
                  <Skeleton className="h-6 w-20" />
                </div>
                <Skeleton className="h-24 w-full" />
              </div>
            </div>
          ) : error && !episode ? (
            <div className="text-center py-12">
              <p className="text-destructive">{error}</p>
              <Link href="/">
                <Button variant="outline" className="mt-4">
                  Return to Home
                </Button>
              </Link>
            </div>
          ) : episode ? (
            isYouTube && youtubeVideoId ? (
              /* ===== YouTube Layout ===== */
              <div className="space-y-6">
                {/* Back Button */}
                <Link href={getBackLink()}>
                  <Button variant="ghost" className="-ml-2">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to {episode.podcast?.title || "Channel"}
                  </Button>
                </Link>

                {/* Desktop: two-column grid, Mobile: stacked */}
                <div className="grid grid-cols-1 lg:grid-cols-[1fr,380px] gap-6">
                  {/* Left column: Video + metadata */}
                  <div className="space-y-4">
                    {/* Sticky video on desktop */}
                    <div className="lg:sticky lg:top-20 lg:self-start">
                      <YouTubeEmbed
                        ref={youtubePlayerRef}
                        videoId={youtubeVideoId}
                        title={episode.title}
                        onTimeUpdate={setVideoCurrentTime}
                      />
                    </div>

                    {/* Title + metadata */}
                    <div className="space-y-3">
                      <h1 className="text-2xl md:text-3xl font-bold text-foreground">
                        {episode.title}
                      </h1>
                      {episode.podcast && (
                        <Link href={getBackLink()} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                          {episode.podcast.title}
                        </Link>
                      )}
                      <div className="flex flex-wrap gap-2">
                        {/* YouTube logo */}
                        <YouTubeLogo videoId={youtubeVideoId} size="sm" />
                        {episode.published_at && (
                          <Badge variant="secondary" className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDate(episode.published_at)}
                          </Badge>
                        )}
                        {episode.duration_seconds && (
                          <Badge variant="secondary" className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDuration(episode.duration_seconds)}
                          </Badge>
                        )}
                        {hasSummaryReady && (
                          <Badge variant="default" className="flex items-center gap-1">
                            <FileText className="h-3 w-3" />
                            Summary Available
                          </Badge>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="flex flex-wrap gap-3 pt-1">
                        {user ? (
                          <Link href={`/episode/${episodeId}/insights`}>
                            <Button size="sm">
                              <Brain className="mr-2 h-4 w-4" />
                              View Insights
                            </Button>
                          </Link>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => setShowAuthModal(true, 'Sign up to explore AI-powered insights, chapters, and transcripts.')}
                          >
                            <Brain className="mr-2 h-4 w-4" />
                            View Insights
                          </Button>
                        )}
                        <SummarizeButton episodeId={episodeId} />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-2 text-muted-foreground"
                          onClick={() => {
                            const canShare = 'share' in navigator;
                            posthog.capture('episode_shared', { episode_id: episodeId, title: episode.title, method: canShare ? 'native' : 'clipboard', is_youtube: true });
                            if (canShare) {
                              navigator.share({ title: episode.title, url: window.location.href });
                            } else {
                              navigator.clipboard.writeText(window.location.href);
                            }
                          }}
                        >
                          <Share2 className="h-4 w-4" />
                          Share
                        </Button>
                      </div>

                      {/* Description */}
                      {episode.description && (
                        <p className="text-muted-foreground leading-relaxed text-sm">
                          {episode.description}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Right column: Summary panel */}
                  <div className="lg:sticky lg:top-20 lg:self-start lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
                    <Card>
                      <SummaryPanel
                        episodeId={episodeId}
                        episodeTitle={episode.title}
                        onChapterClick={(seconds: number) => youtubePlayerRef.current?.seekTo(seconds)}
                        currentVideoTime={videoCurrentTime}
                      />
                    </Card>
                  </div>
                </div>
              </div>
            ) : (
              /* ===== Podcast Layout (original) ===== */
              <div className="space-y-8">
                {/* Back Button */}
                <Link href={getBackLink()}>
                  <Button variant="ghost" className="-ml-2">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to {episode.podcast?.title || "Podcast"}
                  </Button>
                </Link>

                {/* Episode Info Card */}
                <Card>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        {episode.podcast && (
                          <p className="text-sm text-muted-foreground mb-2">
                            {episode.podcast.title}
                          </p>
                        )}
                        <CardTitle className="text-2xl md:text-3xl">
                          {episode.title}
                        </CardTitle>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex flex-wrap gap-3">
                      {episode.published_at && (
                        <Badge variant="secondary" className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDate(episode.published_at)}
                        </Badge>
                      )}
                      {episode.duration_seconds && (
                        <Badge variant="secondary" className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDuration(episode.duration_seconds)}
                        </Badge>
                      )}
                      {hasSummaryReady && (
                        <Badge variant="default" className="flex items-center gap-1">
                          <FileText className="h-3 w-3" />
                          Summary Available
                        </Badge>
                      )}
                    </div>

                    {episode.description && (
                      <p className="text-muted-foreground leading-relaxed">
                        {episode.description}
                      </p>
                    )}

                    <div className="flex flex-wrap gap-3 pt-2">
                      {episode.audio_url && episode.podcast && (
                        <InlinePlayButton
                          track={{
                            id: episode.id,
                            title: episode.title,
                            artist: episode.podcast.title || episode.podcast.author || 'Unknown',
                            artworkUrl: episode.podcast.image_url || '',
                            audioUrl: episode.audio_url,
                            duration: episode.duration_seconds || undefined,
                          }}
                        />
                      )}
                      {user ? (
                        <Link href={`/episode/${episodeId}/insights`}>
                          <Button size="sm">
                            <Brain className="mr-2 h-4 w-4" />
                            View Insights
                          </Button>
                        </Link>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => setShowAuthModal(true, 'Sign up to explore AI-powered insights, chapters, and transcripts.')}
                        >
                          <Brain className="mr-2 h-4 w-4" />
                          View Insights
                        </Button>
                      )}
                      <SummarizeButton
                        episodeId={episodeId}
                      />
                    </div>
                  </CardContent>
                </Card>

              </div>
            )
          ) : (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Episode not found</p>
              <Link href="/">
                <Button variant="outline" className="mt-4">
                  Return to Home
                </Button>
              </Link>
            </div>
          )}
        </main>

      </div>
    </div>
  );
}
