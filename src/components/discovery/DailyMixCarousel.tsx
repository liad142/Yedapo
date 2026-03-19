'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import posthog from 'posthog-js';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { DailyMixCard } from './DailyMixCard';
import { SummaryModal } from './SummaryModal';
import { cn } from '@/lib/utils';

interface Episode {
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
  summaries?: { quick?: any; deep?: any };
  summaryPreview?: { tags?: string[]; hookHeadline?: string; executiveBrief?: string; takeawayCount?: number; chapterCount?: number };
}

interface DailyMixCarouselProps {
  episodes: Episode[];
  isLoading?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
}

export function DailyMixCarousel({ episodes, isLoading = false, hasMore = false, onLoadMore }: DailyMixCarouselProps) {
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<string | null>(null);
  const loadMoreTriggered = useRef(false);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    const nearEnd = el.scrollLeft >= el.scrollWidth - el.clientWidth - 300;
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 1);

    // Trigger load more when near the right edge
    if (nearEnd && hasMore && onLoadMore && !loadMoreTriggered.current) {
      loadMoreTriggered.current = true;
      onLoadMore();
    }
    if (!nearEnd) {
      loadMoreTriggered.current = false;
    }
  }, [hasMore, onLoadMore]);

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', checkScroll);
    window.addEventListener('resize', checkScroll);
    return () => {
      el.removeEventListener('scroll', checkScroll);
      window.removeEventListener('resize', checkScroll);
    };
  }, [checkScroll, episodes]);

  const scroll = (dir: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.8;
    el.scrollBy({ left: dir === 'left' ? -amount : amount, behavior: 'smooth' });
    // Proactively load more when clicking the right arrow near the end
    if (dir === 'right' && hasMore && onLoadMore) {
      const willBeNearEnd = el.scrollLeft + amount >= el.scrollWidth - el.clientWidth - 300;
      if (willBeNearEnd && !loadMoreTriggered.current) {
        loadMoreTriggered.current = true;
        onLoadMore();
      }
    }
  };

  const selectedEpisode = selectedEpisodeId
    ? episodes.find(ep => ep.id === selectedEpisodeId) ?? null
    : null;

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-h2 text-foreground">Daily Mix</h2>
          <p className="text-body-sm text-muted-foreground">Fresh summaries picked for you</p>
        </div>
        <div className="hidden sm:flex items-center gap-1">
          <button
            className={cn(
              'w-8 h-8 rounded-full bg-secondary hover:bg-accent border border-border flex items-center justify-center transition-colors',
              !canScrollLeft && 'opacity-40 pointer-events-none'
            )}
            onClick={() => scroll('left')}
            disabled={!canScrollLeft}
          >
            <ChevronLeft className="h-4 w-4 text-foreground" />
          </button>
          <button
            className={cn(
              'w-8 h-8 rounded-full bg-secondary hover:bg-accent border border-border flex items-center justify-center transition-colors',
              !canScrollRight && 'opacity-40 pointer-events-none'
            )}
            onClick={() => scroll('right')}
            disabled={!canScrollRight}
          >
            <ChevronRight className="h-4 w-4 text-foreground" />
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto scrollbar-hide snap-x snap-mandatory pb-2"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {isLoading
          ? Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="w-[320px] h-[220px] rounded-2xl flex-shrink-0" />
            ))
          : episodes.map((ep) => (
              <div key={ep.id} className="snap-start">
                <DailyMixCard
                  title={ep.title}
                  description={ep.description}
                  podcastName={ep.podcastName}
                  podcastArtwork={ep.podcastArtwork}
                  publishedAt={ep.publishedAt}
                  podcastId={ep.podcastId}
                  podcastAppleId={ep.podcastAppleId}
                  sourceType={ep.sourceType}
                  channelId={ep.channelId}
                  summaryPreview={ep.summaryPreview}
                  onClick={() => {
                    if (ep.sourceType === 'youtube') {
                      posthog.capture('youtube_insights_opened', { episode_id: ep.id, podcast_name: ep.podcastName });
                      router.push(`/episode/${ep.id}/insights`);
                    } else {
                      posthog.capture('summary_modal_opened', { episode_id: ep.id, podcast_name: ep.podcastName });
                      setSelectedEpisodeId(ep.id);
                    }
                  }}
                />
              </div>
            ))}
      </div>

      {/* Summary Modal */}
      {selectedEpisode && (
        <SummaryModal
          episodeId={selectedEpisode.id}
          title={selectedEpisode.title}
          podcastName={selectedEpisode.podcastName}
          podcastArtwork={selectedEpisode.podcastArtwork}
          audioUrl={selectedEpisode.audioUrl}
          durationSeconds={selectedEpisode.durationSeconds}
          podcastId={selectedEpisode.podcastId}
          podcastAppleId={selectedEpisode.podcastAppleId}
          summaries={selectedEpisode.summaries || {}}
          onClose={() => setSelectedEpisodeId(null)}
        />
      )}
    </section>
  );
}
