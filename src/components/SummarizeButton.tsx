"use client";

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useSummarizeQueue } from '@/contexts/SummarizeQueueContext';
import { useAuth } from '@/contexts/AuthContext';
import { useUsage } from '@/contexts/UsageContext';
import {
  SoundWaveAnimation,
  ParticleGemAnimation,
  GemCompleteAnimation,
  QueuePositionIndicator
} from '@/components/animations';
import { Sparkles, AlertCircle, RefreshCw } from 'lucide-react';
import { ShortcutHint } from '@/components/ui/ShortcutHint';
import posthog from 'posthog-js';
import type { QueueItemState } from '@/types/queue';

interface SummarizeButtonProps {
  episodeId: string;
  initialStatus?: 'not_ready' | 'ready' | 'failed' | 'transcribing' | 'summarizing' | 'queued';
  className?: string;
}

// Map initialStatus to QueueItemState
function mapInitialStatus(status: string): QueueItemState {
  switch (status) {
    case 'ready': return 'ready';
    case 'failed': return 'failed';
    case 'transcribing': return 'transcribing';
    case 'summarizing': return 'summarizing';
    case 'queued': return 'queued';
    default: return 'idle';
  }
}

export function SummarizeButton({ episodeId, initialStatus = 'not_ready', className = '' }: SummarizeButtonProps) {
  const router = useRouter();
  const { user, setShowCompactPrompt } = useAuth();
  const { addToQueue, resumePolling, retryEpisode, getQueueItem, getQueuePosition, setShowUpgradeModal } = useSummarizeQueue();
  const { usage, incrementSummary } = useUsage();
  const resumedRef = useRef(false);

  const queueItem = getQueueItem(episodeId);
  const queuePosition = getQueuePosition(episodeId);

  // Use queue state if in queue, otherwise map initialStatus from parent
  const state: QueueItemState = queueItem?.state || mapInitialStatus(initialStatus);

  // Auto-resume polling for in-progress summaries detected on page load (skip POST)
  useEffect(() => {
    const isInProgress = ['transcribing', 'summarizing', 'queued'].includes(initialStatus);
    if (isInProgress && !queueItem && !resumedRef.current) {
      resumedRef.current = true;
      // Resume polling only — the backend is already processing, no need to POST again
      resumePolling(episodeId);
    }
  }, [initialStatus, episodeId, queueItem, resumePolling]);

  const handleClick = () => {
    switch (state) {
      case 'idle': {
        if (!user) {
          setShowCompactPrompt(true, 'Only registered users can summarize episodes. Please sign in or create an account to continue.');
          return;
        }
        // Block if at quota limit — don't queue, show upgrade modal instead
        const atQuotaLimit = usage && usage.summary.limit !== -1 && usage.summary.used >= usage.summary.limit;
        if (atQuotaLimit) {
          setShowUpgradeModal(true);
          return;
        }
        addToQueue(episodeId);
        incrementSummary();
        break;
      }
      case 'ready':
        posthog.capture('summary_viewed', { episode_id: episodeId });
        router.push(`/episode/${episodeId}/insights?tab=summary`);
        break;
      case 'failed': {
        if (!user) {
          setShowCompactPrompt(true, 'Only registered users can summarize episodes. Please sign in or create an account to continue.');
          return;
        }
        const atRetryLimit = usage && usage.summary.limit !== -1 && usage.summary.used >= usage.summary.limit;
        if (atRetryLimit) {
          setShowUpgradeModal(true);
          return;
        }
        posthog.capture('summary_retried', { episode_id: episodeId });
        retryEpisode(episodeId);
        incrementSummary();
        break;
      }
      default:
        break;
    }
  };

  const renderContent = () => {
    switch (state) {
      case 'idle': {
        const atLimit = usage && usage.summary.limit !== -1 && usage.summary.used >= usage.summary.limit;
        return (
          <div className="flex items-center">
            <Sparkles className="mr-2 h-4 w-4" />
            {atLimit ? 'Upgrade to summarize' : 'Summarize'}
            {!atLimit && <ShortcutHint shortcut="S" className="ml-2" />}
          </div>
        );
      }

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
        return 'destructive';
      case 'ready':
        return 'default';
      case 'queued':
      case 'transcribing':
      case 'summarizing':
        return 'outline';
      default:
        return 'default';
    }
  };

  const summaryAtLimit = usage && usage.summary.limit !== -1 && usage.summary.used >= usage.summary.limit;
  const isInteractive = ['idle', 'ready', 'failed'].includes(state) && !(state === 'idle' && summaryAtLimit);

  const isGradientState = (state === 'idle' && !summaryAtLimit) || state === 'ready';

  return (
    <Button
      variant={getVariant()}
      size="sm"
      onClick={handleClick}
      disabled={!isInteractive}
      data-shortcut="summarize"
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
