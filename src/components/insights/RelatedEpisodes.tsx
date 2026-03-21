'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Sparkles, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { extractYouTubeVideoId, getYouTubeThumbnail } from '@/lib/youtube/utils';

interface RelatedEpisode {
  episodeId: string;
  title: string;
  audioUrl: string;
  publishedAt: string | null;
  podcastName: string;
  podcastArtwork: string;
  podcastRssFeedUrl: string;
  hasDeepSummary: boolean;
}

interface RelatedEpisodesProps {
  episodeId: string;
}

export function RelatedEpisodes({ episodeId }: RelatedEpisodesProps) {
  const [episodes, setEpisodes] = useState<RelatedEpisode[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchRelated() {
      try {
        const res = await fetch(`/api/episodes/${episodeId}/related`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data.related?.length > 0) {
          setEpisodes(data.related);
        }
      } catch {
        // Silently fail — section just won't show
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    fetchRelated();
    return () => { cancelled = true; };
  }, [episodeId]);

  // Don't render anything if no related episodes
  if (!isLoading && episodes.length === 0) return null;

  // Loading skeleton
  if (isLoading) {
    return (
      <section className="container mx-auto px-4 max-w-3xl pb-8">
        <Skeleton className="h-6 w-48 mb-4" />
        <div className="grid gap-3">
          {[0, 1, 2].map(i => (
            <div key={i} className="flex items-center gap-4 p-4 rounded-2xl border border-border bg-card">
              <Skeleton className="w-12 h-12 rounded-xl shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-4 w-3/4" />
              </div>
              <Skeleton className="h-8 w-28 rounded-full" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="container mx-auto px-4 max-w-3xl pb-8">
      <h2 className="text-h3 text-foreground mb-4">You might also like</h2>
      <div className="grid gap-3">
        {episodes.map(ep => (
          <RelatedEpisodeCard key={ep.episodeId} episode={ep} />
        ))}
      </div>
    </section>
  );
}

function RelatedEpisodeCard({ episode }: { episode: RelatedEpisode }) {
  const isYouTube = episode.podcastRssFeedUrl?.startsWith('youtube:channel:');
  const youtubeVideoId = isYouTube ? extractYouTubeVideoId(episode.audioUrl) : null;

  const artworkUrl = isYouTube && youtubeVideoId
    ? getYouTubeThumbnail(youtubeVideoId)
    : episode.podcastArtwork?.startsWith('http')
      ? episode.podcastArtwork
      : '/placeholder-podcast.png';

  return (
    <Link
      href={`/episode/${episode.episodeId}/insights`}
      className="flex items-center gap-4 p-4 rounded-2xl border border-border bg-card shadow-[var(--shadow-1)] hover:border-primary/30 transition-colors"
    >
      <div className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0 border border-border">
        <Image
          src={artworkUrl}
          alt={episode.podcastName}
          fill
          className="object-cover"
          sizes="48px"
        />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-body-sm text-muted-foreground truncate">
          {episode.podcastName}
        </p>
        <h3 className="text-body-sm font-medium text-foreground line-clamp-2 mt-0.5">
          {episode.title}
        </h3>
      </div>

      <Button
        variant={episode.hasDeepSummary ? 'outline' : 'default'}
        size="sm"
        className="rounded-full px-4 shrink-0"
        tabIndex={-1}
      >
        {episode.hasDeepSummary ? (
          <>
            <BookOpen className="mr-1.5 h-3.5 w-3.5" />
            Read Summary
          </>
        ) : (
          <>
            <Sparkles className="mr-1.5 h-3.5 w-3.5" />
            Summarize
          </>
        )}
      </Button>
    </Link>
  );
}
