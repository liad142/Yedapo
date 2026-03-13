'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useSummarizeQueue } from '@/contexts/SummarizeQueueContext';
import { useEpisodeLookup } from '@/contexts/EpisodeLookupContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  SoundWaveAnimation,
  ParticleGemAnimation,
  GemCompleteAnimation,
  QueuePositionIndicator
} from '@/components/animations';
import { Sparkles, AlertCircle, RefreshCw, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DiscoverySummarizeButtonProps {
  // External episode data (from Apple/RSS feed)
  externalEpisodeId: string;
  episodeTitle: string;
  episodeDescription: string;
  episodePublishedAt: string;
  episodeDuration?: number;
  audioUrl?: string;
  // External podcast data
  externalPodcastId: string;
  podcastName: string;
  podcastArtist: string;
  podcastArtwork: string;
  podcastFeedUrl?: string;
  className?: string;
}

type ButtonState = 'checking' | 'idle' | 'importing' | 'import_failed' | 'queued' | 'transcribing' | 'summarizing' | 'ready' | 'failed';

export function DiscoverySummarizeButton({
  externalEpisodeId,
  episodeTitle,
  episodeDescription,
  episodePublishedAt,
  episodeDuration,
  audioUrl,
  externalPodcastId,
  podcastName,
  podcastArtist,
  podcastArtwork,
  podcastFeedUrl,
  className = '',
}: DiscoverySummarizeButtonProps) {
  const router = useRouter();
  const { user, setShowCompactPrompt } = useAuth();
  const { addToQueue, retryEpisode, getQueueItem, getQueuePosition } = useSummarizeQueue();
  const { registerLookup, getLookupResult, isLoading: isLookupLoading } = useEpisodeLookup();

  // Track imported episode ID (from our database)
  const [importedEpisodeId, setImportedEpisodeId] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [initialStatus, setInitialStatus] = useState<'not_ready' | 'ready' | 'failed'>('not_ready');

  // Register for batched lookup on mount
  useEffect(() => {
    if (audioUrl) {
      registerLookup(audioUrl);
    }
  }, [audioUrl, registerLookup]);

  // Update local state when lookup result comes in
  const lookupResult = audioUrl ? getLookupResult(audioUrl) : undefined;
  const isChecking = audioUrl ? isLookupLoading(audioUrl) : false;

  useEffect(() => {
    if (lookupResult) {
      setImportedEpisodeId(lookupResult.episodeId);
      if (lookupResult.summaryStatus === 'ready') {
        setInitialStatus('ready');
      } else if (lookupResult.summaryStatus === 'failed') {
        setInitialStatus('failed');
      }
    }
  }, [lookupResult]);

  // Get queue item using imported episode ID
  const queueItem = importedEpisodeId ? getQueueItem(importedEpisodeId) : null;
  const queuePosition = importedEpisodeId ? getQueuePosition(importedEpisodeId) : -1;

  // Determine current state
  const getState = (): ButtonState => {
    if (isChecking) return 'checking';
    if (isImporting) return 'importing';
    if (importError) return 'import_failed';

    // If we have a queue item, use its state
    if (queueItem?.state) {
      return queueItem.state as ButtonState;
    }

    // If imported but no queue item, check initial status
    if (importedEpisodeId) {
      if (initialStatus === 'ready') return 'ready';
      if (initialStatus === 'failed') return 'failed';
    }

    return 'idle';
  };

  const state = getState();

  const handleClick = async () => {
    // If already imported and ready, navigate to insights (public — no auth needed)
    if (state === 'ready' && importedEpisodeId) {
      router.push(`/episode/${importedEpisodeId}/insights?tab=summary`);
      return;
    }

    // All creation/retry actions require auth
    if (!user) {
      setShowCompactPrompt(true, 'Only registered users can summarize episodes. Please sign in or create an account to continue.');
      return;
    }

    // If failed import, retry import
    if (state === 'import_failed') {
      await importAndSummarize();
      return;
    }

    // If processing failed, retry
    if (state === 'failed' && importedEpisodeId) {
      setInitialStatus('not_ready');
      retryEpisode(importedEpisodeId);
      return;
    }

    // Start fresh: import then summarize
    if (state === 'idle') {
      await importAndSummarize();
    }
  };

  const importAndSummarize = async () => {
    setIsImporting(true);
    setImportError(null);

    try {
      // Import the episode into our database
      const response = await fetch('/api/episodes/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          episode: {
            externalId: externalEpisodeId,
            title: episodeTitle,
            description: episodeDescription,
            publishedAt: episodePublishedAt,
            duration: episodeDuration || 0,
            audioUrl: audioUrl,
          },
          podcast: {
            externalId: externalPodcastId,
            name: podcastName,
            artistName: podcastArtist,
            artworkUrl: podcastArtwork,
            feedUrl: podcastFeedUrl,
          },
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to import episode');
      }

      const data = await response.json();
      const episodeId = data.episodeId;

      setImportedEpisodeId(episodeId);

      // Now add to summarize queue
      addToQueue(episodeId);
    } catch (error) {
      console.error('Error importing episode:', error);
      setImportError(error instanceof Error ? error.message : 'Import failed');
    } finally {
      setIsImporting(false);
    }
  };

  const renderContent = () => {
    switch (state) {
      case 'checking':
        return (
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        );

      case 'idle':
        return (
          <>
            <Sparkles className="mr-2 h-4 w-4 text-white fill-white/20" />
            <span className="font-semibold text-white">Summarize</span>
          </>
        );

      case 'importing':
        return (
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-xs">Importing...</span>
          </div>
        );

      case 'import_failed':
        return (
          <>
            <AlertCircle className="mr-2 h-4 w-4" />
            <span>Import Failed</span>
            <RefreshCw className="ml-2 h-3 w-3" />
          </>
        );

      case 'queued':
        return <QueuePositionIndicator position={queuePosition} />;

      case 'transcribing':
        return (
          <div className="flex items-center gap-2">
            <SoundWaveAnimation className="h-5" />
            <span className="text-xs">Transcribing...</span>
          </div>
        );

      case 'summarizing':
        return (
          <div className="flex items-center gap-2">
            <ParticleGemAnimation className="h-5 w-8" />
            <span className="text-xs">Summarizing...</span>
          </div>
        );

      case 'ready':
        return (
          <div className="flex items-center gap-2">
            <GemCompleteAnimation className="h-5 w-5" />
            <span>View Summary</span>
          </div>
        );

      case 'failed':
        return (
          <>
            <AlertCircle className="mr-2 h-4 w-4" />
            <span>Failed</span>
            <RefreshCw className="ml-2 h-3 w-3" />
          </>
        );

      default:
        return null;
    }
  };

  const getVariant = (): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (state) {
      case 'failed':
      case 'import_failed':
        return 'destructive';
      case 'ready':
        return 'default';
      case 'queued':
      case 'transcribing':
      case 'summarizing':
      case 'importing':
      case 'checking':
        return 'outline';
      default:
        return 'default';
    }
  };

  const isInteractive = ['idle', 'ready', 'failed', 'import_failed'].includes(state);
  const isGradientState = state === 'idle' || state === 'ready';

  return (
    <Button
      variant={getVariant()}
      size="sm"
      onClick={handleClick}
      disabled={!isInteractive}
      className={cn(
        'rounded-full px-5 transition-all hover:scale-105 active:scale-95',
        isGradientState && 'bg-primary border-0 shadow-lg shadow-primary/20 hover:shadow-primary/40',
        className
      )}
    >
      {renderContent()}
    </Button>
  );
}
