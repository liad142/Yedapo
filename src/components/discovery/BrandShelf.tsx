'use client';

import { useRef, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { BrandBubble } from './BrandBubble';
import { GenreEpisodeRow } from './GenreEpisodeRow';
import { ApplePodcast } from '@/components/ApplePodcastCard';
import { cn } from '@/lib/utils';

interface BrandShelfProps {
  podcasts: ApplePodcast[];
  isLoading?: boolean;
  title?: string;
  genreId?: string;
  showBestThisWeek?: boolean;
}

export function BrandShelf({
  podcasts,
  isLoading = false,
  title = 'Top Podcasts',
  genreId,
  showBestThisWeek = false,
}: BrandShelfProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showEpisodes, setShowEpisodes] = useState(false);

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-h3 text-foreground">{title}</h2>
        <div className="flex items-center gap-3">
          {showBestThisWeek && genreId && (
            <button
              onClick={() => setShowEpisodes(!showEpisodes)}
              className={cn(
                'flex items-center gap-1 text-body-sm font-medium transition-colors cursor-pointer',
                showEpisodes ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Best this week
              {showEpisodes ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </button>
          )}
          <span className="text-body-sm text-primary font-medium hover:underline cursor-pointer">
            See All
          </span>
        </div>
      </div>
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto scrollbar-hide pb-4 px-1"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {isLoading
          ? Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-2">
              <Skeleton className="w-20 h-20 rounded-full" />
              <Skeleton className="w-14 h-3" />
            </div>
          ))
          : podcasts.map((podcast) => (
            <div key={podcast.id}>
              <BrandBubble
                id={podcast.id}
                name={podcast.name}
                artworkUrl={podcast.artworkUrl}
              />
            </div>
          ))}
      </div>

      {/* Expandable episode row */}
      {showBestThisWeek && genreId && (
        <GenreEpisodeRow genreId={genreId} isOpen={showEpisodes} />
      )}
    </section>
  );
}
