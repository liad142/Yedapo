'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { SummaryPanel } from '@/components/SummaryPanel';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Episode, DbPodcast, SummaryStatus } from '@/types/database';
import posthog from 'posthog-js';
import {
  ArrowLeft,
  Calendar,
  Clock,
  FileText,
  Brain,
  Share2,
} from 'lucide-react';
import { YouTubeLogo } from '@/components/YouTubeLogo';
import { SummarizeButton } from '@/components/SummarizeButton';
import { InlinePlayButton } from '@/components/PlayButton';
import { useAuth } from '@/contexts/AuthContext';
import { YouTubeEmbed } from '@/components/YouTubeEmbed';
import type { YouTubeEmbedRef } from '@/components/YouTubeEmbed';
import { isYouTubeContent, extractYouTubeVideoId } from '@/lib/youtube/utils';
import { formatDate, formatDuration } from '@/lib/formatters';

interface EpisodePageClientProps {
  episode: Episode;
  podcast: DbPodcast | null;
  summaries: {
    quick: { status: SummaryStatus } | null;
    deep: { status: SummaryStatus } | null;
  };
}

export default function EpisodePageClient({
  episode,
  podcast,
  summaries,
}: EpisodePageClientProps) {
  const episodeId = episode.id;
  const { user, setShowAuthModal } = useAuth();

  const youtubePlayerRef = useRef<YouTubeEmbedRef>(null);
  const [videoCurrentTime, setVideoCurrentTime] = useState(0);

  const hasSummaryReady =
    summaries?.quick?.status === 'ready' || summaries?.deep?.status === 'ready';

  const isYouTube = isYouTubeContent(podcast);
  const youtubeVideoId = isYouTube
    ? extractYouTubeVideoId(episode?.audio_url)
    : null;

  // Track episode view (once per episode)
  useEffect(() => {
    posthog.capture('episode_viewed', {
      episode_id: episodeId,
      podcast_name: podcast?.title,
      is_youtube: podcast?.rss_feed_url?.startsWith('youtube:') || false,
    });
  }, [episodeId, podcast?.title, podcast?.rss_feed_url]);

  const getBackLink = () => {
    const rssUrl = podcast?.rss_feed_url;
    if (rssUrl?.startsWith('youtube:channel:')) {
      return '/discover';
    }
    if (rssUrl?.startsWith('apple:')) {
      const appleId = rssUrl.replace('apple:', '');
      return `/browse/podcast/${appleId}`;
    }
    return `/podcast/${episode?.podcast_id}`;
  };

  return (
    <div className="container mx-auto px-4 py-6">
      <div
        className={isYouTube && youtubeVideoId ? 'max-w-6xl mx-auto' : 'max-w-4xl mx-auto'}
      >
          {isYouTube && youtubeVideoId ? (
            /* ===== YouTube Layout ===== */
            <div className="space-y-6">
              <Link href={getBackLink()}>
                <Button variant="ghost" className="-ml-2 max-w-[80vw] sm:max-w-none">
                  <ArrowLeft className="mr-2 h-4 w-4 shrink-0" />
                  <span className="truncate">Back to {podcast?.title || 'Channel'}</span>
                </Button>
              </Link>

              <div className="grid grid-cols-1 lg:grid-cols-[1fr,380px] gap-6">
                {/* Left column: Video + metadata */}
                <div className="space-y-4">
                  <div className="lg:sticky lg:top-20 lg:self-start">
                    <YouTubeEmbed
                      ref={youtubePlayerRef}
                      videoId={youtubeVideoId}
                      title={episode.title}
                      onTimeUpdate={setVideoCurrentTime}
                    />
                  </div>

                  <div className="space-y-3">
                    <h1 className="text-2xl md:text-3xl font-bold text-foreground">
                      {episode.title}
                    </h1>
                    {podcast && (
                      <Link
                        href={getBackLink()}
                        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {podcast.title}
                      </Link>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <YouTubeLogo videoId={youtubeVideoId} size="sm" />
                      {episode.published_at && (
                        <Badge
                          variant="secondary"
                          className="flex items-center gap-1"
                        >
                          <Calendar className="h-3 w-3" />
                          {formatDate(episode.published_at)}
                        </Badge>
                      )}
                      {episode.duration_seconds && (
                        <Badge
                          variant="secondary"
                          className="flex items-center gap-1"
                        >
                          <Clock className="h-3 w-3" />
                          {formatDuration(episode.duration_seconds)}
                        </Badge>
                      )}
                      {hasSummaryReady && (
                        <Badge
                          variant="default"
                          className="flex items-center gap-1"
                        >
                          <FileText className="h-3 w-3" />
                          Summary Available
                        </Badge>
                      )}
                    </div>

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
                          onClick={() =>
                            setShowAuthModal(
                              true,
                              'Sign up to explore AI-powered insights, chapters, and transcripts.'
                            )
                          }
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
                          posthog.capture('episode_shared', {
                            episode_id: episodeId,
                            title: episode.title,
                            method: canShare ? 'native' : 'clipboard',
                            is_youtube: true,
                          });
                          if (canShare) {
                            navigator.share({
                              title: episode.title,
                              url: window.location.href,
                            });
                          } else {
                            navigator.clipboard.writeText(
                              window.location.href
                            );
                          }
                        }}
                      >
                        <Share2 className="h-4 w-4" />
                        Share
                      </Button>
                    </div>

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
                      onChapterClick={(seconds: number) =>
                        youtubePlayerRef.current?.seekTo(seconds)
                      }
                      currentVideoTime={videoCurrentTime}
                    />
                  </Card>
                </div>
              </div>
            </div>
          ) : (
            /* ===== Podcast Layout (original) ===== */
            <div className="space-y-8">
              <Link href={getBackLink()}>
                <Button variant="ghost" className="-ml-2 max-w-[80vw] sm:max-w-none">
                  <ArrowLeft className="mr-2 h-4 w-4 shrink-0" />
                  <span className="truncate">Back to {podcast?.title || 'Podcast'}</span>
                </Button>
              </Link>

              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      {podcast && (
                        <p className="text-sm text-muted-foreground mb-2">
                          {podcast.title}
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
                      <Badge
                        variant="secondary"
                        className="flex items-center gap-1"
                      >
                        <Calendar className="h-3 w-3" />
                        {formatDate(episode.published_at)}
                      </Badge>
                    )}
                    {episode.duration_seconds && (
                      <Badge
                        variant="secondary"
                        className="flex items-center gap-1"
                      >
                        <Clock className="h-3 w-3" />
                        {formatDuration(episode.duration_seconds)}
                      </Badge>
                    )}
                    {hasSummaryReady && (
                      <Badge
                        variant="default"
                        className="flex items-center gap-1"
                      >
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
                    {episode.audio_url && podcast && (
                      <InlinePlayButton
                        track={{
                          id: episode.id,
                          title: episode.title,
                          artist:
                            podcast.title || podcast.author || 'Unknown',
                          artworkUrl: podcast.image_url || '',
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
                        onClick={() =>
                          setShowAuthModal(
                            true,
                            'Sign up to explore AI-powered insights, chapters, and transcripts.'
                          )
                        }
                      >
                        <Brain className="mr-2 h-4 w-4" />
                        View Insights
                      </Button>
                    )}
                    <SummarizeButton episodeId={episodeId} />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
      </div>
    </div>
  );
}
