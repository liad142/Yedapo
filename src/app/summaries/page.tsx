'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Link from 'next/link';

import { useRouter } from 'next/navigation';
import { FileText, Search, Calendar, Clock, Mic2, Loader2, RotateCcw, AlertCircle, XCircle, ArrowLeft } from 'lucide-react';
import {
  SoundWaveAnimation,
  ParticleGemAnimation,
  QueuePositionIndicator,
  GemCompleteAnimation,
} from '@/components/animations';
import { SafeImage } from '@/components/SafeImage';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { SignInPrompt } from '@/components/auth/SignInPrompt';
import { useAuth } from '@/contexts/AuthContext';
import { useSummarizeQueue } from '@/contexts/SummarizeQueueContext';
import { createClient } from '@/lib/supabase/client';
import { createLogger } from '@/lib/logger';

const log = createLogger('summary');

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
  status: string;
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

const NON_TERMINAL_STATUSES = ['queued', 'transcribing', 'summarizing'];
const POLL_INTERVAL = 5_000;

/** Get active queue position — only counts non-terminal items ahead */
function getActiveQueuePosition(queue: Array<{ episodeId: string; state: string }>, episodeId: string): number {
  const activeItems = queue.filter(qi => qi.state !== 'ready' && qi.state !== 'idle' && qi.state !== 'failed');
  const idx = activeItems.findIndex(qi => qi.episodeId === episodeId);
  return idx; // 0 = processing, 1 = next, -1 = not in queue
}

function getSuffix(n: number): string {
  if (n >= 11 && n <= 13) return 'th';
  switch (n % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
}

function StatusBadge({ status, queuePosition }: { status: string; queuePosition?: number }) {
  switch (status) {
    case 'queued':
      return (
        <div className="shrink-0 flex items-center gap-1.5 rounded-full border border-border/50 bg-background/80 px-3 py-1.5">
          <QueuePositionIndicator position={queuePosition ?? 0} className="[&>span]:hidden" />
          <span className="text-xs font-medium text-muted-foreground">
            {queuePosition && queuePosition > 0 ? `${queuePosition + 1}${getSuffix(queuePosition + 1)} in queue` : 'Queued'}
          </span>
        </div>
      );
    case 'transcribing':
      return (
        <div className="shrink-0 flex items-center gap-2 rounded-full border border-border/50 bg-background/80 px-3 py-1.5">
          <SoundWaveAnimation className="h-4" />
          <span className="text-xs font-medium">Transcribing...</span>
        </div>
      );
    case 'summarizing':
      return (
        <div className="shrink-0 flex items-center gap-2 rounded-full border border-border/50 bg-background/80 px-3 py-1.5">
          <ParticleGemAnimation className="h-5 w-6" />
          <span className="text-xs font-medium">Summarizing...</span>
        </div>
      );
    case 'ready':
      return (
        <div className="shrink-0 flex items-center gap-1.5 rounded-full border border-border/50 bg-background/80 px-3 py-1.5">
          <GemCompleteAnimation className="h-4 w-4" />
          <span className="text-xs font-medium text-green-600 dark:text-green-400">Ready</span>
        </div>
      );
    case 'failed':
      return (
        <Badge variant="destructive" className="shrink-0">
          <AlertCircle className="h-3 w-3 mr-1" />
          Failed
        </Badge>
      );
    default:
      return (
        <Badge variant="secondary" className="shrink-0">
          <FileText className="h-3 w-3 mr-1" />
          {status}
        </Badge>
      );
  }
}

export default function SummariesPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const { queue } = useSummarizeQueue();
  const [episodes, setEpisodes] = useState<EpisodeWithSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [retryingIds, setRetryingIds] = useState<Set<string>>(new Set());
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchSummaries = useCallback(async (silent = false) => {
    try {
      if (!silent) {
        setIsLoading(true);
        setError(null);
      }

      const response = await fetch('/api/summaries');
      if (!response.ok) throw new Error('Failed to fetch');

      const data = await response.json();
      setEpisodes(data.episodes || []);
    } catch (err) {
      log.error('Error fetching summaries', err);
      if (!silent) setError('Failed to load summaries');
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }
    fetchSummaries();
  }, [user, fetchSummaries]);

  // Refresh when tab becomes visible (user navigates back from channel page)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && user) fetchSummaries(true);
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [user, fetchSummaries]);

  // Fetch episode info for queue items not yet in DB results
  const [queueEpisodeCache, setQueueEpisodeCache] = useState<Map<string, EpisodeWithSummary>>(new Map());
  const fetchingRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const dbIds = new Set(episodes.map(ep => ep.id));
    const activeQueue = queue.filter(qi => qi.state !== 'ready' && qi.state !== 'idle');
    const missingIds = activeQueue
      .map(qi => qi.episodeId)
      .filter(id => !dbIds.has(id) && !queueEpisodeCache.has(id) && !fetchingRef.current.has(id));

    if (missingIds.length === 0) return;

    // Mark as fetching to prevent duplicate requests
    missingIds.forEach(id => fetchingRef.current.add(id));

    const supabase = createClient();
    supabase
      .from('episodes')
      .select('id, title, description, published_at, duration_seconds, podcast_id, podcasts(id, title, image_url, author)')
      .in('id', missingIds)
      .then(({ data }: { data: any[] | null }) => {
        if (!data?.length) {
          missingIds.forEach(id => fetchingRef.current.delete(id));
          return;
        }
        setQueueEpisodeCache(prev => {
          const next = new Map(prev);
          for (const ep of data) {
            const podcast = Array.isArray(ep.podcasts) ? ep.podcasts[0] : ep.podcasts;
            next.set(ep.id, {
              id: ep.id,
              title: ep.title,
              description: ep.description,
              published_at: ep.published_at,
              duration_seconds: ep.duration_seconds,
              podcast: podcast || null,
              summary_updated_at: null,
              status: 'queued',
            });
          }
          return next;
        });
        missingIds.forEach(id => fetchingRef.current.delete(id));
      });
  }, [queue, episodes, queueEpisodeCache]);

  // Also refresh DB results when queue items finish (state changes to ready)
  useEffect(() => {
    const hasNewReady = queue.some(qi => qi.state === 'ready');
    if (hasNewReady && user) {
      fetchSummaries(true);
    }
  }, [queue, user, fetchSummaries]);

  // Build final list: merge DB episodes + queue-only episodes with real-time status
  const allEpisodes = (() => {
    const queueMap = new Map(queue.map(qi => [qi.episodeId, qi]));
    const dbIds = new Set(episodes.map(ep => ep.id));

    // Update status for DB episodes that are in the client queue
    const updated = episodes.map(ep => {
      const qi = queueMap.get(ep.id);
      if (qi && qi.state !== 'ready' && qi.state !== 'idle') {
        return { ...ep, status: qi.state };
      }
      return ep;
    });

    // Add queue items not in DB (from cache)
    const queueOnly: EpisodeWithSummary[] = [];
    for (const qi of queue) {
      if (qi.state === 'ready' || qi.state === 'idle') continue;
      if (dbIds.has(qi.episodeId)) continue;
      const cached = queueEpisodeCache.get(qi.episodeId);
      if (cached) {
        queueOnly.push({ ...cached, status: qi.state });
      }
    }

    // In-progress first (sorted by actual queue index position), then terminal
    const all = [...updated, ...queueOnly];
    const inProgress = all.filter(ep => NON_TERMINAL_STATUSES.includes(ep.status));
    const terminal = all.filter(ep => !NON_TERMINAL_STATUSES.includes(ep.status));

    // Use the queue array index order directly — this matches getQueuePosition()
    const queueOrder = new Map(queue.map((qi, idx) => [qi.episodeId, idx]));
    inProgress.sort((a, b) => {
      const posA = queueOrder.get(a.id) ?? 999;
      const posB = queueOrder.get(b.id) ?? 999;
      return posA - posB;
    });

    return [...inProgress, ...terminal];
  })();

  // Polling when any episode is non-terminal
  const hasNonTerminal = allEpisodes.some(ep => NON_TERMINAL_STATUSES.includes(ep.status));

  useEffect(() => {
    if (hasNonTerminal && user) {
      pollingRef.current = setInterval(() => fetchSummaries(true), POLL_INTERVAL);
    } else if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [hasNonTerminal, user, fetchSummaries]);

  const handleRetry = async (episodeId: string) => {
    setRetryingIds(prev => new Set(prev).add(episodeId));
    try {
      const res = await fetch(`/api/episodes/${episodeId}/summaries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level: 'deep' }),
      });
      if (res.ok) {
        await fetchSummaries(true);
      }
    } catch (err) {
      log.error('Retry failed', err);
    } finally {
      setRetryingIds(prev => {
        const next = new Set(prev);
        next.delete(episodeId);
        return next;
      });
    }
  };

  const handleCancel = async (episodeId: string) => {
    setRetryingIds(prev => new Set(prev).add(episodeId));
    try {
      const res = await fetch(`/api/summaries/${episodeId}/cancel`, { method: 'POST' });
      if (res.ok) {
        await fetchSummaries(true);
      }
    } catch (err) {
      log.error('Cancel failed', err);
    } finally {
      setRetryingIds(prev => {
        const next = new Set(prev);
        next.delete(episodeId);
        return next;
      });
    }
  };

  // Filter episodes by search query
  const filteredEpisodes = useMemo(() => allEpisodes.filter(episode => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      episode.title.toLowerCase().includes(query) ||
      episode.podcast?.title.toLowerCase().includes(query) ||
      episode.description?.toLowerCase().includes(query)
    );
  }), [allEpisodes, searchQuery]);

  if (authLoading) {
    return (
      <div className="px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <Button variant="ghost" size="sm" className="mb-3 -ml-2" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
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
            <Button variant="ghost" size="sm" className="mb-3 -ml-2" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
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
    <div className="px-3 sm:px-4 py-6 sm:py-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <Button variant="ghost" size="sm" className="mb-3 -ml-2" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <FileText className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            </div>
            <h1 className="text-h2 sm:text-h1">My Summaries</h1>
          </div>
          <p className="text-sm sm:text-base text-muted-foreground">
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
            <Button variant="outline" onClick={() => fetchSummaries()}>
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

            {filteredEpisodes.map((episode) => {
              const isInProgress = NON_TERMINAL_STATUSES.includes(episode.status);
              const isFailed = episode.status === 'failed';
              const isReady = episode.status === 'ready';

              const cardContent = (
                <Card className={`transition-colors ${isReady ? 'hover:bg-accent/50 cursor-pointer' : ''} ${isInProgress ? 'border-blue-200 dark:border-blue-800' : ''} ${isFailed ? 'border-destructive/30' : ''}`}>
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex gap-3 sm:gap-4">
                      {/* Podcast Artwork */}
                      <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-lg overflow-hidden flex-shrink-0 bg-muted relative">
                        {episode.podcast?.image_url ? (
                          <SafeImage
                            src={episode.podcast.image_url}
                            alt={episode.podcast.title}
                            width={64}
                            height={64}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Mic2 className="h-5 w-5 sm:h-6 sm:w-6 text-muted-foreground" />
                          </div>
                        )}
                      </div>

                      {/* Episode Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h3 className={`text-sm sm:text-base font-medium line-clamp-2 sm:line-clamp-1 ${isReady ? 'hover:text-primary' : ''} transition-colors`}>
                              {episode.title}
                            </h3>
                            <p className="text-xs sm:text-sm text-muted-foreground line-clamp-1">
                              {episode.podcast?.title}
                            </p>
                          </div>
                          <StatusBadge status={episode.status} queuePosition={getActiveQueuePosition(queue, episode.id)} />
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
                          {isFailed && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-xs text-destructive hover:text-destructive"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleRetry(episode.id);
                              }}
                              disabled={retryingIds.has(episode.id)}
                            >
                              {retryingIds.has(episode.id) ? (
                                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                              ) : (
                                <RotateCcw className="h-3 w-3 mr-1" />
                              )}
                              Retry
                            </Button>
                          )}
                          {isInProgress && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-xs text-muted-foreground hover:text-destructive"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleCancel(episode.id);
                              }}
                              disabled={retryingIds.has(episode.id)}
                            >
                              {retryingIds.has(episode.id) ? (
                                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                              ) : (
                                <XCircle className="h-3 w-3 mr-1" />
                              )}
                              Cancel
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );

              if (isReady) {
                return (
                  <Link key={episode.id} href={`/episode/${episode.id}/insights`}>
                    {cardContent}
                  </Link>
                );
              }

              return <div key={episode.id}>{cardContent}</div>;
            })}
          </div>
        )}
      </div>
    </div>
  );
}
