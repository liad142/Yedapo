// src/contexts/SummarizeQueueContext.tsx
"use client";

import React, { createContext, useContext, useState, useCallback, useRef, useEffect, useMemo } from 'react';
import posthog from 'posthog-js';
import type { QueueItem, QueueItemState, SummarizeQueueContextValue } from '@/types/queue';
import { createLogger } from '@/lib/logger';
import { useUsage } from '@/contexts/UsageContext';

const log = createLogger('queue');

const SummarizeQueueContext = createContext<SummarizeQueueContextValue | null>(null);

export function useSummarizeQueue() {
  const context = useContext(SummarizeQueueContext);
  if (!context) {
    throw new Error('useSummarizeQueue must be used within SummarizeQueueProvider');
  }
  return context;
}

export function useSummarizeQueueOptional() {
  return useContext(SummarizeQueueContext);
}

const MAX_RETRIES = 1;
const RETRY_DELAY = 2000;
const MAX_POLL_DURATION_MS = 10 * 60 * 1000; // 10 minutes max polling before giving up

// Improved backoff intervals (ms) — much more conservative to reduce thundering herd
const POLL_INTERVALS = {
  initial: 3000,       // First poll after 3s
  transcribing: 10000, // During transcription, poll every 10s
  summarizing: 10000,  // During summarization, poll every 10s
  max: 30000,          // Maximum interval (30s)
};

/** Add ±20% random jitter to prevent synchronized polling across clients */
function withJitter(intervalMs: number): number {
  const jitter = intervalMs * 0.2 * (Math.random() * 2 - 1); // ±20%
  return Math.max(1000, Math.round(intervalMs + jitter));
}


export function SummarizeQueueProvider({ children }: { children: React.ReactNode }) {
  const { refresh: refreshUsage } = useUsage();
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [stats, setStats] = useState({ completed: 0, failed: 0, total: 0 });
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [rateLimitInfo, setRateLimitInfo] = useState<{ limit: number; used: number }>({ limit: 5, used: 5 });

  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const processingRef = useRef(false);
  const tabVisibleRef = useRef(true);
  const pendingPollRef = useRef<{ episodeId: string; pollCount: number; startTime: number } | null>(null);
  const startProcessingRef = useRef<((id: string) => Promise<void>) | null>(null);

  // Track tab visibility — pause polling when tab is hidden
  useEffect(() => {
    const handleVisibilityChange = () => {
      const wasHidden = !tabVisibleRef.current;
      tabVisibleRef.current = !document.hidden;

      if (wasHidden && tabVisibleRef.current && pendingPollRef.current) {
        // Tab became visible again and we have a pending poll — resume immediately
        log.info('Tab visible again, resuming poll');
        const { episodeId, pollCount, startTime } = pendingPollRef.current;
        pendingPollRef.current = null;
        pollLoop(episodeId, pollCount, startTime);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  const getQueueItem = useCallback((episodeId: string) => {
    return queue.find(item => item.episodeId === episodeId);
  }, [queue]);

  const getQueuePosition = useCallback((episodeId: string) => {
    const index = queue.findIndex(item => item.episodeId === episodeId);
    if (index === -1) return -1;
    if (queue[index].state === 'queued') {
      return queue.slice(0, index + 1).filter(i =>
        i.state === 'queued' || i.state === 'transcribing' || i.state === 'summarizing'
      ).length;
    }
    return 0;
  }, [queue]);

  const updateQueueItem = useCallback((episodeId: string, updates: Partial<QueueItem>) => {
    setQueue(prev => prev.map(item =>
      item.episodeId === episodeId ? { ...item, ...updates } : item
    ));
  }, []);

  const pollStatus = useCallback(async (episodeId: string): Promise<QueueItemState> => {
    try {
      const res = await fetch(`/api/episodes/${episodeId}/summaries`);
      if (!res.ok) throw new Error('Failed to fetch status');

      const data = await res.json();
      const deepStatus = data.summaries?.deep?.status;
      const transcriptStatus = data.transcript?.status;

      if (deepStatus === 'ready') return 'ready';
      if (deepStatus === 'failed' || transcriptStatus === 'failed') return 'failed';
      if (deepStatus === 'summarizing') return 'summarizing';
      if (transcriptStatus === 'transcribing' || deepStatus === 'transcribing') return 'transcribing';
      if (deepStatus === 'queued' || transcriptStatus === 'queued') return 'transcribing';

      return 'transcribing';
    } catch {
      return 'failed';
    }
  }, []);

  const finishProcessing = useCallback(() => {
    if (pollingRef.current) { clearTimeout(pollingRef.current); pollingRef.current = null; }
    processingRef.current = false;
    setProcessingId(null);
    pendingPollRef.current = null;
  }, []);

  const processNext = useCallback(() => {
    if (processingRef.current) return;

    setQueue(currentQueue => {
      const nextItem = currentQueue.find(item => item.state === 'queued');
      if (nextItem) {
        setTimeout(() => {
          startProcessingRef.current?.(nextItem.episodeId);
        }, 0);
      }
      return currentQueue;
    });
  }, []);

  /** Shared poll loop used by both startProcessingEpisode and resumePolling */
  const pollLoop = useCallback(async (episodeId: string, initialPollCount: number, startTime: number) => {
    let pollCount = initialPollCount;

    const getNextPollInterval = (currentState: QueueItemState): number => {
      const baseInterval = currentState === 'transcribing'
        ? POLL_INTERVALS.transcribing
        : currentState === 'summarizing'
          ? POLL_INTERVALS.summarizing
          : POLL_INTERVALS.initial;

      // Exponential backoff: double after every 5 polls, cap at max
      const backoffMultiplier = Math.min(Math.pow(1.3, Math.floor(pollCount / 3)), 3);
      return withJitter(Math.min(baseInterval * backoffMultiplier, POLL_INTERVALS.max));
    };

    const poll = async () => {
      // Pause polling when tab is hidden — save the state and resume on visibility
      if (!tabVisibleRef.current) {
        log.info('Tab hidden, pausing poll', { episodeId, pollCount });
        pendingPollRef.current = { episodeId, pollCount, startTime };
        return;
      }

      pollCount++;
      const elapsedMs = Date.now() - startTime;
      log.debug('Polling status', { episodeId, pollCount, elapsedMs });

      if (elapsedMs > MAX_POLL_DURATION_MS) {
        log.error('Polling TIMEOUT - giving up', { episodeId, pollCount, elapsedMs });
        updateQueueItem(episodeId, { state: 'failed', error: 'Processing timed out' });
        setStats(prev => ({ ...prev, failed: prev.failed + 1 }));
        finishProcessing();
        processNext();
        return;
      }

      const state = await pollStatus(episodeId);
      log.debug('Poll result', { episodeId, state, durationMs: elapsedMs });
      updateQueueItem(episodeId, { state });

      if (state === 'ready') {
        log.success('Processing complete', { episodeId, durationMs: elapsedMs });
        setStats(prev => ({ ...prev, completed: prev.completed + 1 }));
        refreshUsage();
        finishProcessing();
        processNext();
        return;
      }

      if (state === 'failed') {
        // Grace period: ignore "failed" in early polls — the after() background
        // job may not have updated the DB status from the previous failed attempt yet.
        if (pollCount <= 3) {
          log.info('Ignoring stale "failed" status during grace period', { episodeId, pollCount });
          const nextInterval = getNextPollInterval('transcribing');
          pollingRef.current = setTimeout(poll, nextInterval);
          return;
        }
        log.error('Processing failed', { episodeId, durationMs: elapsedMs });
        setQueue(currentQueue => {
          const item = currentQueue.find(i => i.episodeId === episodeId);
          if (item && item.retryCount < MAX_RETRIES) {
            log.warn('Retrying', { episodeId, retryCount: item.retryCount + 1 });
            updateQueueItem(episodeId, { retryCount: item.retryCount + 1, state: 'transcribing' });
            setTimeout(() => startProcessingRef.current?.(episodeId), RETRY_DELAY);
          } else {
            log.error('Max retries reached', { episodeId });
            setStats(prev => ({ ...prev, failed: prev.failed + 1 }));
            finishProcessing();
            processNext();
          }
          return currentQueue;
        });
        return;
      }

      const nextInterval = getNextPollInterval(state);
      log.debug('Scheduling next poll', { episodeId, nextInterval });
      pollingRef.current = setTimeout(poll, nextInterval);
    };

    pollingRef.current = setTimeout(poll, withJitter(POLL_INTERVALS.initial));
  }, [pollStatus, updateQueueItem, finishProcessing, processNext]);

  const startProcessingEpisode = useCallback(async (episodeId: string) => {
    if (processingRef.current) return;
    processingRef.current = true;
    setProcessingId(episodeId);
    updateQueueItem(episodeId, { state: 'transcribing' });

    log.info('Starting processing', { episodeId });
    const startTime = Date.now();

    try {
      log.info('Sending POST to start summarization', { episodeId });
      const res = await fetch(`/api/episodes/${episodeId}/summaries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level: 'deep' })
      });

      log.info('POST returned', { episodeId, ok: res.ok, status: res.status, durationMs: Date.now() - startTime });

      if (!res.ok) {
        // Handle rate limit: show upgrade modal for daily quota, don't retry
        if (res.status === 429) {
          const body = await res.json().catch(() => ({}));
          if (body.limit != null && body.used != null) {
            // Daily quota exceeded — show upgrade modal
            log.warn('Daily quota exceeded', { episodeId, limit: body.limit, used: body.used });
            setRateLimitInfo({ limit: body.limit, used: body.used });
            setShowUpgradeModal(true);
            refreshUsage();
            updateQueueItem(episodeId, { state: 'failed', error: 'Daily limit reached' });
            setStats(prev => ({ ...prev, failed: prev.failed + 1 }));
            finishProcessing();
            processNext();
            return;
          }
          // Per-minute rate limit — fail with message (no retry, it'll just hit the limit again)
          log.warn('Rate limited', { episodeId });
          updateQueueItem(episodeId, { state: 'failed', error: 'Too many requests. Try again in a minute.' });
          setStats(prev => ({ ...prev, failed: prev.failed + 1 }));
          finishProcessing();
          processNext();
          return;
        }
        throw new Error('Failed to start processing');
      }

      const responseData = await res.json();
      log.debug('POST response data', { episodeId, responseData });

      // Use shared poll loop
      pollLoop(episodeId, 0, startTime);
    } catch (err) {
      log.error('POST request failed', { episodeId, error: err instanceof Error ? err.message : String(err), durationMs: Date.now() - startTime });
      setQueue(currentQueue => {
        const item = currentQueue.find(i => i.episodeId === episodeId);
        if (item && item.retryCount < MAX_RETRIES) {
          updateQueueItem(episodeId, { retryCount: item.retryCount + 1 });
          setTimeout(() => startProcessingRef.current?.(episodeId), RETRY_DELAY);
        } else {
          updateQueueItem(episodeId, { state: 'failed', error: 'Failed to start processing' });
          setStats(prev => ({ ...prev, failed: prev.failed + 1 }));
          finishProcessing();
          processNext();
        }
        return currentQueue;
      });
    }
  }, [pollStatus, updateQueueItem, processNext, pollLoop, finishProcessing]);

  useEffect(() => { startProcessingRef.current = startProcessingEpisode; }, [startProcessingEpisode]);

  useEffect(() => {
    if (!processingId && queue.some(item => item.state === 'queued')) {
      processNext();
    }
  }, [processingId, queue, processNext]);

  // Resume polling for an already-in-progress episode (skip POST, go straight to polling)
  const resumePolling = useCallback((episodeId: string) => {
    if (processingRef.current) return;
    processingRef.current = true;
    setProcessingId(episodeId);

    const newItem: QueueItem = {
      episodeId,
      state: 'transcribing',
      retryCount: 0,
      addedAt: Date.now(),
    };
    setQueue(prev => {
      const filtered = prev.filter(i => i.episodeId !== episodeId);
      return [...filtered, newItem];
    });

    log.info('Resuming polling (no POST)', { episodeId });

    // Use shared poll loop — no POST, start polling directly
    pollLoop(episodeId, 0, Date.now());
  }, [pollLoop]);

  const addToQueue = useCallback((episodeId: string) => {
    setQueue(prev => {
      const existing = prev.find(item => item.episodeId === episodeId);
      if (existing && existing.state !== 'failed') return prev;

      const newItem: QueueItem = {
        episodeId,
        state: 'queued',
        retryCount: 0,
        addedAt: Date.now()
      };

      const filtered = prev.filter(i => i.episodeId !== episodeId);
      return [...filtered, newItem];
    });
    setStats(prev => ({ ...prev, total: prev.total + 1 }));
    posthog.capture('summary_requested', { level: 'deep', episode_id: episodeId });
  }, []);

  const removeFromQueue = useCallback((episodeId: string) => {
    setQueue(prev => prev.filter(item => item.episodeId !== episodeId));
  }, []);

  const retryEpisode = useCallback((episodeId: string) => {
    setQueue(prev => {
      const existing = prev.find(item => item.episodeId === episodeId);
      if (existing) {
        return prev.map(item =>
          item.episodeId === episodeId
            ? { ...item, state: 'queued' as QueueItemState, retryCount: 0, error: undefined }
            : item
        );
      }
      return [...prev, {
        episodeId,
        state: 'queued' as QueueItemState,
        retryCount: 0,
        addedAt: Date.now(),
      }];
    });
    setStats(prev => ({ ...prev, total: prev.total + 1 }));
  }, []);

  const clearStats = useCallback(() => {
    setStats({ completed: 0, failed: 0, total: 0 });
    // Only remove failed items — keep 'ready' items so SummarizeButton
    // continues to show "View Summary" without needing a page refresh
    setQueue(prev => prev.filter(item => item.state !== 'failed'));
  }, []);

  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearTimeout(pollingRef.current);
      }
    };
  }, []);

  const value = useMemo<SummarizeQueueContextValue>(() => ({
    queue,
    processingId,
    addToQueue,
    resumePolling,
    removeFromQueue,
    retryEpisode,
    getQueueItem,
    getQueuePosition,
    stats,
    clearStats,
    showUpgradeModal,
    setShowUpgradeModal,
    rateLimitInfo,
  }), [queue, processingId, addToQueue, resumePolling, removeFromQueue, retryEpisode, getQueueItem, getQueuePosition, stats, clearStats, showUpgradeModal, rateLimitInfo]);

  return (
    <SummarizeQueueContext.Provider value={value}>
      {children}
    </SummarizeQueueContext.Provider>
  );
}
