'use client';

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { X, Check, Loader2, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { springGentle, useSafeSpring } from '@/lib/motion';

interface YouTubeChannel {
  channelId: string;
  title: string;
  description: string;
  thumbnailUrl: string;
}

interface YouTubeImportModalProps {
  channels: YouTubeChannel[];
  onImport: (selectedChannelIds: string[]) => void;
  onClose: () => void;
  isImporting?: boolean;
}

// ---------------------------------------------------------------------------
// Backdrop + container animation variants
// ---------------------------------------------------------------------------

const backdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

const panelVariants = {
  hidden: { opacity: 0, y: 40, scale: 0.97 },
  visible: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: 20, scale: 0.97 },
};

const cardVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
};

// ---------------------------------------------------------------------------
// Channel card (internal)
// ---------------------------------------------------------------------------

function ChannelCard({
  channel,
  selected,
  onToggle,
  index,
}: {
  channel: YouTubeChannel;
  selected: boolean;
  onToggle: (id: string) => void;
  index: number;
}) {
  return (
    <motion.button
      type="button"
      variants={cardVariants}
      transition={{ delay: Math.min(index * 0.04, 0.6), duration: 0.35 }}
      whileTap={{ scale: 0.97 }}
      onClick={() => onToggle(channel.channelId)}
      className={cn(
        'group relative flex items-center gap-3.5 p-3.5 rounded-xl border-2 transition-colors text-left w-full',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
        selected
          ? 'border-primary bg-primary/10'
          : 'border-border hover:border-primary/50',
      )}
    >
      {/* Thumbnail */}
      <div className="relative shrink-0">
        <div className="w-12 h-12 rounded-full overflow-hidden bg-muted ring-2 ring-background">
          {channel.thumbnailUrl ? (
            <Image
              src={channel.thumbnailUrl}
              alt={channel.title}
              width={48}
              height={48}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground text-lg font-bold">
              {channel.title.charAt(0)}
            </div>
          )}
        </div>
        {/* Checkmark badge */}
        <AnimatePresence>
          {selected && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 25 }}
              className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary flex items-center justify-center shadow-sm"
            >
              <Check className="h-3 w-3 text-primary-foreground" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            'text-sm font-medium truncate transition-colors',
            selected ? 'text-primary' : 'text-foreground',
          )}
        >
          {channel.title}
        </p>
        {channel.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5 leading-relaxed">
            {channel.description}
          </p>
        )}
      </div>

      {/* Checkmark indicator on the right */}
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 25 }}
            className="shrink-0 w-5 h-5 rounded-full bg-primary flex items-center justify-center"
          >
            <Check className="h-3 w-3 text-primary-foreground" />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

// ---------------------------------------------------------------------------
// Main modal
// ---------------------------------------------------------------------------

export function YouTubeImportModal({
  channels,
  onImport,
  onClose,
  isImporting = false,
}: YouTubeImportModalProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() =>
    new Set(channels.map((c) => c.channelId)),
  );

  const modalRef = useRef<HTMLDivElement>(null);
  const spring = useSafeSpring(springGentle);

  const allSelected = selectedIds.size === channels.length;
  const noneSelected = selectedIds.size === 0;

  const selectedArray = useMemo(
    () => Array.from(selectedIds),
    [selectedIds],
  );

  // ---- Toggle handlers ----

  const toggleChannel = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(channels.map((c) => c.channelId)));
    }
  }, [allSelected, channels]);

  // ---- Body scroll lock ----

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  // ---- Focus trap + Escape ----

  useEffect(() => {
    const el = modalRef.current;
    if (!el) return;
    const focusable = el.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    if (focusable.length > 0) focusable[0].focus();
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const el = modalRef.current;
      if (!el) return;
      const focusable = el.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    },
    [onClose],
  );

  return (
    <AnimatePresence>
      {/* Backdrop */}
      <motion.div
        key="yt-import-backdrop"
        variants={backdropVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        transition={{ duration: 0.25 }}
        className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-md"
        onClick={onClose}
      />

      {/* Panel */}
      <motion.div
        key="yt-import-panel"
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="yt-import-title"
        onKeyDown={handleKeyDown}
        variants={panelVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        transition={spring}
        className={cn(
          'fixed z-[60] inset-0 flex items-center justify-center p-4',
          'pointer-events-none',
        )}
      >
        <div
          className={cn(
            'pointer-events-auto w-full max-w-2xl max-h-[90vh] flex flex-col',
            'rounded-2xl bg-card border border-border shadow-2xl overflow-hidden',
          )}
        >
          {/* ---- Header ---- */}
          <div className="shrink-0 px-6 pt-6 pb-4 border-b border-border">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                {/* YouTube logo */}
                <Image
                  src="/youtube-logo.svg"
                  alt="YouTube"
                  width={28}
                  height={20}
                  className="shrink-0"
                />
                <div>
                  <h2
                    id="yt-import-title"
                    className="text-lg font-bold text-foreground"
                  >
                    Import YouTube Subscriptions
                  </h2>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Choose which channels to follow on Yedapo
                  </p>
                </div>
              </div>

              <button
                onClick={onClose}
                aria-label="Close"
                className="p-1.5 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground shrink-0"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Select all + counter bar */}
            <div className="flex items-center justify-between mt-4">
              <button
                type="button"
                onClick={toggleAll}
                className="text-sm font-medium text-primary hover:text-primary/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-md px-1"
              >
                {allSelected ? 'Deselect All' : 'Select All'}
              </button>
              <span className="text-sm text-muted-foreground tabular-nums">
                {selectedIds.size} of {channels.length} selected
              </span>
            </div>
          </div>

          {/* ---- Scrollable channel grid ---- */}
          <motion.div
            className="flex-1 overflow-y-auto overscroll-contain px-6 py-4"
            initial="hidden"
            animate="visible"
            variants={{
              hidden: {},
              visible: { transition: { staggerChildren: 0.04 } },
            }}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {channels.map((channel, i) => (
                <ChannelCard
                  key={channel.channelId}
                  channel={channel}
                  selected={selectedIds.has(channel.channelId)}
                  onToggle={toggleChannel}
                  index={i}
                />
              ))}
            </div>
          </motion.div>

          {/* ---- Footer ---- */}
          <div className="shrink-0 px-6 py-4 border-t border-border bg-card">
            <div className="flex items-center gap-3">
              <Button
                onClick={() => onImport(selectedArray)}
                disabled={noneSelected || isImporting}
                className={cn(
                  'flex-1 gap-2 rounded-full',
                  'shadow-lg shadow-primary/20 hover:shadow-primary/30',
                  'hover:scale-[1.01] active:scale-[0.99] transition-all',
                )}
                size="lg"
              >
                {isImporting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4" />
                    Import {selectedIds.size > 0 ? selectedIds.size : ''} Selected
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
