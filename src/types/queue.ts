// src/types/queue.ts

// Queue item states
export type QueueItemState =
  | 'idle'           // Not in queue, can be added
  | 'queued'         // Waiting in queue
  | 'transcribing'   // Stage 1: Audio → Text
  | 'summarizing'    // Stage 2: Text → Summary
  | 'ready'          // Complete, can navigate
  | 'failed';        // Error occurred

// Single queue item
export interface QueueItem {
  episodeId: string;
  state: QueueItemState;
  retryCount: number;
  addedAt: number;
  error?: string;
}

// Queue context value
export interface SummarizeQueueContextValue {
  // Queue state
  queue: QueueItem[];
  processingId: string | null;

  // Actions
  addToQueue: (episodeId: string) => void;
  resumePolling: (episodeId: string) => void;
  removeFromQueue: (episodeId: string) => void;
  retryEpisode: (episodeId: string) => void;

  // Selectors
  getQueueItem: (episodeId: string) => QueueItem | undefined;
  getQueuePosition: (episodeId: string) => number; // 0 = processing, -1 = not in queue

  // Stats for toast
  stats: {
    completed: number;
    failed: number;
    total: number;
  };
  clearStats: () => void;

  // Upgrade modal state (rendered in AppShell)
  showUpgradeModal: boolean;
  setShowUpgradeModal: (show: boolean) => void;
  rateLimitInfo: { limit: number; used: number };
}
