'use client';

import { useState, useMemo } from 'react';
import { KnowledgeCard } from './KnowledgeCard';
import type { KnowledgeCardProps } from './KnowledgeCard';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Loader2,
  Compass,
  Sparkles,
  ArrowDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCountry } from '@/contexts/CountryContext';

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
  chartRank?: number;
  primaryGenre?: string;
}

export interface TrendingFeedProps {
  episodes: FeedEpisode[];
  isLoading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
}

// --- Format break sub-component ---

const BREAK_CONFIGS = [
  { label: 'Keep exploring', icon: Compass },
  { label: 'Worth your time', icon: Sparkles },
  { label: 'Up next', icon: ArrowDown },
];

function FeedBreak({ index }: { index: number }) {
  const config = BREAK_CONFIGS[index % BREAK_CONFIGS.length];
  const Icon = config.icon;
  return (
    <div className="flex items-center gap-3 py-3 my-2">
      <div className="flex-1 h-px bg-border/40" />
      <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary/50">
        <Icon className="h-3 w-3 text-muted-foreground/60" />
        <span className="text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider">
          {config.label}
        </span>
      </div>
      <div className="flex-1 h-px bg-border/40" />
    </div>
  );
}

function mapToKnowledgeCard(ep: FeedEpisode, countryName?: string): KnowledgeCardProps {
  return {
    id: ep.id,
    type: 'podcast',
    title: ep.title,
    description: ep.description || '',
    sourceName: ep.podcastName,
    sourceArtwork: ep.podcastArtwork,
    sourceId: ep.podcastId,
    publishedAt: ep.publishedAt,
    duration: ep.duration,
    audioUrl: ep.audioUrl,
    summaryStatus: 'none',
    recommendReason: ep.chartRank
      ? `#${ep.chartRank} in ${ep.primaryGenre || 'Top Podcasts'}${countryName ? ` · ${countryName}` : ''}`
      : undefined,
    podcastFeedData: {
      externalPodcastId: ep.podcastId,
      podcastArtist: ep.podcastArtist || ep.podcastName,
      podcastFeedUrl: ep.podcastFeedUrl,
    },
  };
}

export function TrendingFeed({
  episodes,
  isLoading,
  hasMore,
  onLoadMore,
}: TrendingFeedProps) {
  const { countryInfo } = useCountry();
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const cards = useMemo(() =>
    episodes.map(ep => mapToKnowledgeCard(ep, countryInfo?.name)),
    [episodes, countryInfo?.name]
  );

  const handleLoadMore = () => {
    if (isLoadingMore) return;
    setIsLoadingMore(true);
    onLoadMore();
    setTimeout(() => setIsLoadingMore(false), 1500);
  };

  return (
    <section>
      <div className="mb-4">
        <h2 className="text-h3 text-foreground">Trending This Week</h2>
        <p className="text-body-sm text-muted-foreground">
          Most popular right now{countryInfo ? ` · ${countryInfo.flag} ${countryInfo.name}` : ''}
        </p>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-[180px] rounded-2xl" />
          ))}
        </div>
      ) : cards.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <p>No trending episodes available. Check back soon!</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {cards.map((props, index) => (
            <div key={`${props.type}-${props.id}-${index}`}>
              <KnowledgeCard {...props} />
              {(index + 1) % 5 === 0 && index < cards.length - 1 && (
                <FeedBreak index={Math.floor(index / 5)} />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Load More */}
      <div className="h-20 flex items-center justify-center">
        {hasMore && cards.length > 0 && (
          <Button
            variant="outline"
            onClick={handleLoadMore}
            disabled={isLoadingMore}
            className="gap-2"
          >
            {isLoadingMore ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Loading...</>
            ) : (
              'Load More'
            )}
          </Button>
        )}
        {!hasMore && cards.length > 0 && (
          <p className="text-sm text-muted-foreground">You&apos;ve reached the end</p>
        )}
      </div>
    </section>
  );
}
