'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X } from 'lucide-react';
import { formatTime } from '@/lib/formatters';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import { PlayerChapters } from './PlayerChapters';
import type { Chapter } from './ChapterScrubber';
import type { User } from '@supabase/supabase-js';

const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

interface ExpandedPlayerViewProps {
  isExpanded: boolean;
  progressPercentage: number;
  currentTime: number;
  duration: number;
  onProgressChange: (value: number[]) => void;
  playbackRate: number;
  onSetPlaybackRate: (rate: number) => void;
  volume: number;
  VolumeIcon: React.ComponentType<{ className?: string }>;
  onVolumeChange: (value: number[]) => void;
  chapters: Chapter[] | undefined;
  onSeek: (time: number) => void;
  user: User | null;
  upsellDismissed: boolean;
  onDismissUpsell: () => void;
  onShowAuthModal: (show: boolean, message: string) => void;
}

export function ExpandedPlayerView({
  isExpanded,
  progressPercentage,
  currentTime,
  duration,
  onProgressChange,
  playbackRate,
  onSetPlaybackRate,
  volume,
  VolumeIcon,
  onVolumeChange,
  chapters,
  onSeek,
  user,
  upsellDismissed,
  onDismissUpsell,
  onShowAuthModal,
}: ExpandedPlayerViewProps) {
  return (
    <AnimatePresence>
      {isExpanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="overflow-hidden border-t border-border/30"
        >
          <div className="px-4 py-4">
            {/* Full Progress Bar */}
            <div className="mb-4">
              <Slider
                value={[progressPercentage]}
                onValueChange={onProgressChange}
                max={100}
                step={0.1}
                className="mb-2"
                trackClassName="h-2 bg-secondary"
                rangeClassName="bg-gradient-to-r from-primary to-blue-400"
                thumbClassName="h-4 w-4 border-2 border-primary"
              />
              <div className="flex justify-between text-xs text-muted-foreground font-mono">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Playback Speed Options */}
            <div className="flex items-center justify-center gap-2">
              <span className="text-xs text-muted-foreground mr-2">Speed:</span>
              {PLAYBACK_RATES.map((rate) => (
                <motion.button
                  key={rate}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => onSetPlaybackRate(rate)}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-xs font-medium transition-all',
                    playbackRate === rate
                      ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/30'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                  )}
                >
                  {rate}x
                </motion.button>
              ))}
            </div>

            {/* Mobile Volume */}
            <div className="flex md:hidden items-center gap-3 mt-4 pt-4 border-t border-border/30">
              <VolumeIcon className="w-4 h-4 text-muted-foreground" />
              <Slider
                value={[volume * 100]}
                onValueChange={onVolumeChange}
                max={100}
                className="flex-1"
                trackClassName="h-1.5 bg-secondary"
                rangeClassName="bg-foreground/70"
                thumbClassName="h-4 w-4 border-foreground/70 bg-foreground"
              />
              <span className="text-xs text-muted-foreground w-8 text-right font-mono">
                {Math.round(volume * 100)}%
              </span>
            </div>

            {/* Chapters (authenticated) or upsell (guest) */}
            {chapters && chapters.length > 0 ? (
              <PlayerChapters
                chapters={chapters}
                currentTime={currentTime}
                onSeek={onSeek}
              />
            ) : !user && !upsellDismissed ? (
              <div className="mt-4 pt-4 border-t border-border/30">
                <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-primary/5 border border-primary/15">
                  <Sparkles className="w-4 h-4 text-primary shrink-0" />
                  <p className="text-xs text-muted-foreground flex-1">
                    <button
                      onClick={() => onShowAuthModal(true, 'Sign up to unlock smart chapters, speed controls, and more.')}
                      className="text-primary font-medium hover:underline cursor-pointer"
                    >
                      Sign up
                    </button>
                    {' '}to unlock AI chapters & full insights
                  </p>
                  <button
                    onClick={onDismissUpsell}
                    className="p-1 rounded-full text-muted-foreground/40 hover:text-muted-foreground transition-colors cursor-pointer"
                    aria-label="Dismiss"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
