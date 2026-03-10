"use client";

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSummarizeQueue } from '@/contexts/SummarizeQueueContext';
import { CheckCircle, XCircle, X } from 'lucide-react';

export function QueueToast() {
  const { stats, clearStats, queue } = useSummarizeQueue();
  const [show, setShow] = useState(false);

  useEffect(() => {
    const isProcessing = queue.some(item =>
      ['queued', 'transcribing', 'summarizing'].includes(item.state)
    );

    if (!isProcessing && stats.total > 0 && (stats.completed > 0 || stats.failed > 0)) {
      setShow(true);
    }
  }, [queue, stats]);

  const handleDismiss = () => {
    setShow(false);
    setTimeout(clearStats, 300);
  };

  useEffect(() => {
    if (show) {
      const timer = setTimeout(handleDismiss, 8000);
      return () => clearTimeout(timer);
    }
  }, [show]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.9 }}
          className="fixed bottom-4 right-4 z-[60]"
        >
          <div role="status" aria-live="polite" className="bg-card border rounded-lg shadow-lg p-4 flex items-center gap-3 min-w-[280px]">
            <div className={`flex-shrink-0 ${stats.failed > 0 ? 'text-amber-500' : 'text-green-500'}`}>
              {stats.failed > 0 ? (
                <div className="relative">
                  <CheckCircle className="h-6 w-6" />
                  <XCircle className="h-3 w-3 absolute -bottom-1 -right-1 text-red-500" />
                </div>
              ) : (
                <CheckCircle className="h-6 w-6" />
              )}
            </div>

            <div className="flex-1">
              <p className="font-medium text-sm">
                {stats.failed > 0
                  ? `${stats.completed} episode${stats.completed !== 1 ? 's' : ''} ready, ${stats.failed} failed`
                  : `${stats.completed} episode${stats.completed !== 1 ? 's' : ''} ready!`
                }
              </p>
              <p className="text-xs text-muted-foreground">
                Click "View Summary" to see results
              </p>
            </div>

            <button
              onClick={handleDismiss}
              aria-label="Dismiss notification"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
