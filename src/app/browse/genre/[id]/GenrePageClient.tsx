'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ArrowLeft, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ApplePodcastCard } from '@/components/ApplePodcastCard';
import type { ApplePodcast } from '@/components/ApplePodcastCard';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/EmptyState';
import { useCountry } from '@/contexts/CountryContext';

const PAGE_SIZE = 30;
const FETCH_LIMIT = 200;

interface GenrePageClientProps {
  genreId: string;
  genreName: string;
  initialPodcasts: ApplePodcast[];
  initialCountry: string;
}

export default function GenrePageClient({
  genreId,
  genreName,
  initialPodcasts,
  initialCountry,
}: GenrePageClientProps) {
  const { country, countryInfo } = useCountry();

  const [allPodcasts, setAllPodcasts] = useState<ApplePodcast[]>(initialPodcasts);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPodcasts = useCallback(async () => {
    setIsLoading(true);
    setVisibleCount(PAGE_SIZE);
    setError(null);
    try {
      const response = await fetch(
        `/api/apple/genres/${genreId}/podcasts?country=${country.toLowerCase()}&limit=${FETCH_LIMIT}`
      );
      if (!response.ok) throw new Error('Failed to fetch podcasts');
      const data = await response.json();
      setAllPodcasts(data.podcasts || []);
    } catch (err) {
      console.error('Error fetching genre podcasts:', err);
      setError('Failed to load podcasts');
    } finally {
      setIsLoading(false);
    }
  }, [genreId, country]);

  // Re-fetch when user's country differs from the server-rendered default
  useEffect(() => {
    if (country.toLowerCase() !== initialCountry.toLowerCase()) {
      fetchPodcasts();
    }
  }, [country, initialCountry, fetchPodcasts]);

  const podcasts = allPodcasts.slice(0, visibleCount);
  const hasMore = visibleCount < allPodcasts.length;

  const handleLoadMore = () => {
    setVisibleCount((prev) => prev + PAGE_SIZE);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <section className="bg-card border-b border-border py-8 shadow-[var(--shadow-1)]">
        <div className="container mx-auto px-4">
          <Link href="/discover">
            <Button
              variant="ghost"
              size="sm"
              className="mb-4 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Discover
            </Button>
          </Link>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-semibold text-primary bg-primary-subtle px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Category
                </span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-black text-foreground tracking-tight">
                {genreName}
              </h1>
              <p className="text-muted-foreground mt-2 flex items-center gap-2 font-medium">
                <Globe className="h-4 w-4" />
                Top podcasts in {genreName} • {countryInfo?.flag}{' '}
                {countryInfo?.name}
              </p>
            </div>

            {!isLoading && allPodcasts.length > 0 && (
              <div className="text-sm font-semibold text-muted-foreground bg-secondary px-3 py-1.5 rounded-full border border-border">
                {allPodcasts.length} podcasts found
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        {error && (
          <div className="p-4 rounded-lg bg-destructive/10 text-destructive text-center mb-8">
            {error}
            <Button
              variant="outline"
              size="sm"
              className="ml-4"
              onClick={() => fetchPodcasts()}
            >
              Retry
            </Button>
          </div>
        )}

        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {[...Array(PAGE_SIZE)].map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="aspect-square rounded-xl" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        ) : podcasts.length === 0 ? (
          <EmptyState
            type="podcasts"
            title={`No ${genreName} Podcasts`}
            description={`We couldn't find any podcasts in ${genreName} for ${countryInfo?.name}. Try another country or genre.`}
            actionLabel="Browse All Genres"
            onAction={() => (window.location.href = '/browse')}
          />
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {podcasts.map((podcast, index) => (
                <ApplePodcastCard
                  key={podcast.id}
                  podcast={podcast}
                  priority={index < 6}
                />
              ))}
            </div>

            {hasMore && (
              <div className="flex justify-center pt-8">
                <Button
                  variant="outline"
                  size="lg"
                  onClick={handleLoadMore}
                  className="min-w-[200px]"
                >
                  Load More
                </Button>
              </div>
            )}

            {!hasMore && allPodcasts.length > PAGE_SIZE && (
              <div className="text-center pt-8 text-sm text-muted-foreground">
                You&apos;ve reached the end • {allPodcasts.length} podcasts
                shown
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
