'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { FileText, Search, Calendar, Clock, Mic2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { SignInPrompt } from '@/components/auth/SignInPrompt';
import { useAuth } from '@/contexts/AuthContext';

interface EpisodeWithSummary {
  id: string;
  title: string;
  description: string | null;
  published_at: string | null;
  duration_seconds: number | null;
  podcast: {
    id: string;
    title: string;
    image_url: string | null;
    author: string | null;
  } | null;
  summary_updated_at: string | null;
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return '';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes} min`;
}

function formatDate(dateString: string | null): string {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function SummariesPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [episodes, setEpisodes] = useState<EpisodeWithSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    async function fetchSummaries() {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch('/api/summaries');
        if (!response.ok) throw new Error('Failed to fetch');

        const data = await response.json();
        setEpisodes(data.episodes || []);
      } catch (err) {
        console.error('Error fetching summaries:', err);
        setError('Failed to load summaries');
      } finally {
        setIsLoading(false);
      }
    }

    fetchSummaries();
  }, [user]);

  // Filter episodes by search query
  const filteredEpisodes = episodes.filter(episode => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      episode.title.toLowerCase().includes(query) ||
      episode.podcast?.title.toLowerCase().includes(query) ||
      episode.description?.toLowerCase().includes(query)
    );
  });

  if (authLoading) {
    return (
      <div className="px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <h1 className="text-h1">My Summaries</h1>
            </div>
          </div>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="flex gap-4">
                    <Skeleton className="w-16 h-16 rounded-lg flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-5 w-3/4" />
                      <Skeleton className="h-4 w-1/2" />
                      <Skeleton className="h-4 w-1/4" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <h1 className="text-h1">My Summaries</h1>
            </div>
          </div>
          <SignInPrompt
            message="Sign up to view your summaries"
            description="Your AI-generated episode summaries will appear here after you sign up."
          />
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <FileText className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-h1">My Summaries</h1>
          </div>
          <p className="text-muted-foreground">
            All your AI-generated episode summaries in one place
          </p>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search summaries..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="flex gap-4">
                    <Skeleton className="w-16 h-16 rounded-lg flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-5 w-3/4" />
                      <Skeleton className="h-4 w-1/2" />
                      <Skeleton className="h-4 w-1/4" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-destructive mb-4">{error}</p>
            <Button variant="outline" onClick={() => window.location.reload()}>
              Try Again
            </Button>
          </div>
        ) : filteredEpisodes.length === 0 ? (
          <div className="text-center py-16">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-6">
              <FileText className="h-8 w-8 text-muted-foreground" />
            </div>
            {searchQuery ? (
              <>
                <h2 className="text-h3 mb-2">No matches found</h2>
                <p className="text-muted-foreground">
                  Try a different search term
                </p>
              </>
            ) : (
              <>
                <h2 className="text-h3 mb-2">No summaries yet</h2>
                <p className="text-muted-foreground mb-6">
                  Browse podcasts and create summaries to see them here
                </p>
                <Link href="/discover">
                  <Button>Browse Podcasts</Button>
                </Link>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground mb-4">
              {filteredEpisodes.length} {filteredEpisodes.length === 1 ? 'summary' : 'summaries'}
            </p>

            {filteredEpisodes.map((episode) => (
              <Link key={episode.id} href={`/episode/${episode.id}/insights`}>
                <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
                  <CardContent className="p-4">
                    <div className="flex gap-4">
                      {/* Podcast Artwork */}
                      <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-muted">
                        {episode.podcast?.image_url ? (
                          <Image
                            src={episode.podcast.image_url}
                            alt={episode.podcast.title}
                            width={64}
                            height={64}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Mic2 className="h-6 w-6 text-muted-foreground" />
                          </div>
                        )}
                      </div>

                      {/* Episode Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h3 className="font-medium line-clamp-1 hover:text-primary transition-colors">
                              {episode.title}
                            </h3>
                            <p className="text-sm text-muted-foreground line-clamp-1">
                              {episode.podcast?.title}
                            </p>
                          </div>
                          <Badge variant="secondary" className="shrink-0">
                            <FileText className="h-3 w-3 mr-1" />
                            Summary
                          </Badge>
                        </div>

                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          {episode.published_at && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {formatDate(episode.published_at)}
                            </span>
                          )}
                          {episode.duration_seconds && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDuration(episode.duration_seconds)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
