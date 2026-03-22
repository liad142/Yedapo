'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Sparkles, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { stripHtml } from '@/lib/utils';
import { extractYouTubeVideoId, getYouTubeThumbnail } from '@/lib/youtube/utils';

interface RelatedEpisode {
  episodeId: string;
  title: string;
  audioUrl: string;
  publishedAt: string | null;
  description: string | null;
  podcastName: string;
  podcastArtwork: string;
  podcastRssFeedUrl: string;
  hasDeepSummary: boolean;
  sharedTags: string[];
}

interface RelatedEpisodesProps {
  episodeId: string;
}

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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
      <section>
        <Skeleton className="h-6 w-48 mb-4" />
        <div className="grid gap-3">
          {[0, 1, 2].map(i => (
            <div key={i} className="flex gap-4 p-4 rounded-2xl border border-border bg-card">
              <Skeleton className="w-14 h-14 rounded-xl shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section>
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

  const descriptionSnippet = episode.description
    ? stripHtml(episode.description)
    : null;

  return (
    <Link
      href={`/episode/${episode.episodeId}/insights`}
      className="flex gap-4 p-4 rounded-2xl border border-border bg-card shadow-[var(--shadow-1)] hover:border-primary/30 hover:shadow-[var(--shadow-floating)] transition-all duration-200"
    >
      <div className="relative w-14 h-14 rounded-xl overflow-hidden shrink-0 border border-border">
        <Image
          src={artworkUrl}
          alt={episode.podcastName}
          fill
          className="object-cover"
          sizes="56px"
        />
      </div>

      <div className="flex-1 min-w-0">
        {/* Source + date */}
        <div className="flex items-center gap-2 text-muted-foreground">
          <span className="text-xs font-medium truncate">{episode.podcastName}</span>
          {episode.publishedAt && (
            <>
              <span className="text-xs">·</span>
              <span className="text-xs shrink-0">{formatRelativeDate(episode.publishedAt)}</span>
            </>
          )}
        </div>

        {/* Title */}
        <h3 className="text-body-sm font-medium text-foreground line-clamp-2 mt-0.5">
          {episode.title}
        </h3>

        {/* Description snippet */}
        {descriptionSnippet && (
          <p className="text-xs text-muted-foreground line-clamp-1 mt-1">
            {descriptionSnippet}
          </p>
        )}

        {/* Shared topic tags + CTA */}
        <div className="flex items-center gap-2 mt-2">
          {episode.sharedTags?.length > 0 && (
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              {episode.sharedTags.map(tag => (
                <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0 h-5 shrink-0">
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          <Button
            variant={episode.hasDeepSummary ? 'outline' : 'default'}
            size="sm"
            className="rounded-full px-3 h-7 text-xs shrink-0"
            tabIndex={-1}
          >
            {episode.hasDeepSummary ? (
              <>
                <BookOpen className="mr-1 h-3 w-3" />
                Read Summary
              </>
            ) : (
              <>
                <Sparkles className="mr-1 h-3 w-3" />
                Summarize
              </>
            )}
          </Button>
        </div>
      </div>
    </Link>
  );
}
