'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { KnowledgeCard } from './KnowledgeCard';
import { Skeleton } from '@/components/ui/skeleton';

interface GenreEpisode {
  id: string;
  title: string;
  description: string;
  publishedAt: string;
  podcastId: string;
  podcastAppleId?: string | null;
  podcastName: string;
  podcastArtwork: string;
  audioUrl?: string;
  durationSeconds?: number;
  summaryPreview?: {
    tags?: string[];
    hookHeadline?: string;
    executiveBrief?: string;
    takeawayCount?: number;
    chapterCount?: number;
  };
}

interface GenreEpisodeRowProps {
  genreId: string;
  isOpen: boolean;
}

export function GenreEpisodeRow({ genreId, isOpen }: GenreEpisodeRowProps) {
  const [episodes, setEpisodes] = useState<GenreEpisode[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);

  useEffect(() => {
    if (!isOpen || hasFetched) return;

    async function fetchEpisodes() {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/discover/genre-episodes?genreId=${genreId}&limit=5`);
        if (res.ok) {
          const data = await res.json();
          setEpisodes(data.episodes || []);
        }
      } catch {
        // Silently fail
      } finally {
        setIsLoading(false);
        setHasFetched(true);
      }
    }
    fetchEpisodes();
  }, [genreId, isOpen, hasFetched]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="overflow-hidden"
        >
          <div className="pt-4 flex flex-col gap-3">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-[120px] rounded-2xl" />
              ))
            ) : episodes.length === 0 ? (
              <p className="text-body-sm text-muted-foreground text-center py-4">
                No summarized episodes found for this genre yet.
              </p>
            ) : (
              episodes.map((ep) => (
                <KnowledgeCard
                  key={ep.id}
                  id={ep.id}
                  type="podcast"
                  title={ep.title}
                  description={ep.description}
                  sourceName={ep.podcastName}
                  sourceArtwork={ep.podcastArtwork}
                  sourceId={ep.podcastId}
                  sourceAppleId={ep.podcastAppleId}
                  publishedAt={ep.publishedAt}
                  duration={ep.durationSeconds}
                  audioUrl={ep.audioUrl}
                  summaryPreview={ep.summaryPreview}
                  summaryStatus={ep.summaryPreview ? 'ready' : 'none'}
                  episodeId={ep.id}
                />
              ))
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
