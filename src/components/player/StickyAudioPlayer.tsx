'use client';

import React, { useMemo, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Volume1,
  ChevronUp,
  ChevronDown,
  Loader2,
  X,
  Sparkles,
} from 'lucide-react';
import { useAudioPlayerSafe } from '@/contexts/AudioPlayerContext';
import { useAuth } from '@/contexts/AuthContext';
import { usePlayerAskAI } from '@/contexts/AskAIContext';
import { AskAIBar } from '@/components/insights/AskAIBar';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import { sanitizeImageUrl } from '@/lib/sanitize-image-url';
import { formatTime } from '@/lib/formatters';
import { ChapterScrubber } from './ChapterScrubber';
import { ExpandedPlayerView } from './ExpandedPlayerView';

export function StickyAudioPlayer() {
  const player = useAudioPlayerSafe();
  const { user, setShowAuthModal } = useAuth();
  const [upsellDismissed, setUpsellDismissed] = useState(false);

  // Stable refs to avoid re-triggering usePlayerAskAI effect
  const playerRef = useRef(player);
  playerRef.current = player;

  const handleChaptersLoaded = useCallback((chapters: { title: string; timestamp: string; timestamp_seconds: number }[]) => {
    const p = playerRef.current;
    if (p?.currentTrack && !p.currentTrack.chapters?.length) {
      p.updateTrackMeta({ chapters });
    }
  }, []);

  // Auto-activate Ask AI + load chapters when playing an episode with a summary
  usePlayerAskAI(player?.currentTrack?.id ?? null, player?.currentTrack?.audioUrl ?? null, handleChaptersLoaded);

  // All hooks must be before conditional return
  const VolumeIcon = useMemo(() => {
    if (!player) return Volume2;
    if (player.volume === 0) return VolumeX;
    if (player.volume < 0.5) return Volume1;
    return Volume2;
  }, [player]);

  const activeChapterIndex = useMemo(() => {
    const chapters = player?.currentTrack?.chapters;
    if (!chapters || chapters.length === 0) return -1;
    const time = player?.currentTime ?? 0;
    let idx = -1;
    for (let i = 0; i < chapters.length; i++) {
      if (chapters[i].timestamp_seconds <= time) idx = i;
    }
    return idx;
  }, [player?.currentTrack?.chapters, player?.currentTime]);

  const activeChapterTitle = player?.currentTrack?.chapters && activeChapterIndex >= 0
    ? player.currentTrack.chapters[activeChapterIndex].title
    : null;

  // Don't render if no player context or no track
  if (!player || !player.currentTrack) {
    return null;
  }

  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    playbackRate,
    isLoading,
    isExpanded,
    toggle,
    seekRelative,
    seek,
    setVolume,
    setPlaybackRate,
    toggleExpanded,
    clearTrack,
  } = player;

  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;
  const sanitizedArtwork = sanitizeImageUrl(currentTrack.artworkUrl);

  const handleProgressChange = (value: number[]) => {
    const newTime = (value[0] / 100) * duration;
    seek(newTime);
  };

  const handleVolumeChange = (value: number[]) => {
    setVolume(value[0] / 100);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className={cn(
          'fixed bottom-5 left-4 right-4 z-[60] flex justify-center',
          'lg:left-[17rem]' // Account for desktop sidebar
        )}
      >
        {/* Unified Floating Card */}
        <div className="relative w-full max-w-3xl rounded-2xl overflow-hidden bg-card/95 backdrop-blur-xl border border-border shadow-[var(--shadow-floating)]">
          {/* 1. Integrated Ask AI Bar / Guest Upsell */}
          {!user ? (
            <button
              onClick={() => setShowAuthModal(true, 'Sign up to unlock smart chapters, Ask AI, speed controls, and more.')}
              className="w-full px-4 py-2 border-b border-border hover:bg-secondary/50 transition-colors cursor-pointer group"
            >
              <div className="flex items-center gap-2.5">
                <div className="bg-gradient-to-r from-primary to-primary/60 rounded-full p-1 shrink-0">
                  <Sparkles className="h-3 w-3 text-white" />
                </div>
                <span className="flex-1 text-sm text-muted-foreground group-hover:text-foreground transition-colors text-left truncate">
                  Unlock AI chapters, Ask AI & more
                </span>
                <span className="text-xs text-primary font-medium shrink-0">Sign up</span>
              </div>
            </button>
          ) : (
            <AskAIBar mode="integrated" />
          )}

          {/* 2. Progress Bar / Chapter Scrubber — padded hit area so taps don't bleed into AskAI */}
          {currentTrack.chapters && currentTrack.chapters.length > 0 ? (
            <div className="relative pt-5 pb-1 px-1 group cursor-pointer">
              <div className="relative h-2 group-hover:h-2.5 transition-all">
                <ChapterScrubber
                  chapters={currentTrack.chapters}
                  currentTime={currentTime}
                  duration={duration}
                  onSeek={seek}
                />
              </div>
            </div>
          ) : (
            <div className="relative pt-5 pb-1 px-1 group cursor-pointer">
              <Slider
                value={[progressPercentage]}
                onValueChange={handleProgressChange}
                max={100}
                step={0.1}
                className="h-2"
                trackClassName="h-2 rounded-sm bg-secondary group-hover:h-2.5 transition-all"
                rangeClassName="bg-gradient-to-r from-primary via-primary to-primary/60"
                thumbClassName="opacity-0 group-hover:opacity-100 h-3.5 w-3.5 -mt-0.5 border-primary bg-background"
                aria-label="Playback progress"
              />
              {/* Glow effect on progress */}
              <div
                className="absolute top-3 h-2 bg-primary/50 blur-sm pointer-events-none transition-all"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
          )}

          {/* 3. Slim Player Controls — Spotify-style single row */}
          <div className="flex items-center gap-2.5 px-3 py-1.5 sm:gap-3 sm:py-2">
            {/* Album Art */}
            <div className="relative shrink-0">
              <div className="relative w-10 h-10 rounded-md overflow-hidden ring-1 ring-border">
                {sanitizedArtwork ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={sanitizedArtwork}
                    alt={currentTrack.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-primary/30 to-blue-600/30 flex items-center justify-center">
                    <Volume2 className="w-4 h-4 text-muted-foreground" />
                  </div>
                )}
              </div>
            </div>

            {/* Track Info — two lines */}
            <div className="min-w-0 flex-1" aria-live="polite">
              <h4 className="text-sm font-bold text-foreground truncate leading-tight">
                {activeChapterTitle || currentTrack.title}
              </h4>
              <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                {currentTrack.artist} &middot; {formatTime(currentTime)} / {formatTime(duration)}
              </p>
            </div>

            {/* Compact Controls */}
            <div className="flex items-center gap-0.5 shrink-0">
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => {
                  const chapters = currentTrack.chapters;
                  if (chapters && chapters.length > 0 && activeChapterIndex > 0) {
                    seek(chapters[activeChapterIndex - 1].timestamp_seconds);
                  } else {
                    seekRelative(-15);
                  }
                }}
                className="p-2.5 rounded-full text-muted-foreground hover:text-foreground transition-colors"
                aria-label={currentTrack.chapters ? 'Previous chapter' : 'Skip back 15 seconds'}
              >
                <SkipBack className="w-4 h-4" />
              </motion.button>

              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={toggle}
                disabled={isLoading}
                className={cn(
                  'w-11 h-11 rounded-full flex items-center justify-center transition-all',
                  'bg-primary text-primary-foreground shadow-lg shadow-primary/20',
                  isLoading && 'opacity-70'
                )}
                aria-label={isPlaying ? 'Pause' : 'Play'}
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : isPlaying ? (
                  <Pause className="w-4 h-4" fill="currentColor" />
                ) : (
                  <Play className="w-4 h-4 ml-0.5" fill="currentColor" />
                )}
              </motion.button>

              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => {
                  const chapters = currentTrack.chapters;
                  if (chapters && chapters.length > 0 && activeChapterIndex < chapters.length - 1) {
                    seek(chapters[activeChapterIndex + 1].timestamp_seconds);
                  } else {
                    seekRelative(15);
                  }
                }}
                className="p-2.5 rounded-full text-muted-foreground hover:text-foreground transition-colors"
                aria-label={currentTrack.chapters ? 'Next chapter' : 'Skip forward 15 seconds'}
              >
                <SkipForward className="w-4 h-4" />
              </motion.button>

              {/* Expand / Collapse toggle — glass circle */}
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={toggleExpanded}
                className={cn(
                  'w-11 h-11 flex items-center justify-center rounded-full cursor-pointer transition-all duration-200 border',
                  isExpanded
                    ? 'bg-foreground/10 border-foreground/15 text-foreground'
                    : 'bg-foreground/5 border-border/50 text-muted-foreground hover:bg-foreground/10 hover:border-foreground/15 hover:text-foreground'
                )}
                aria-label={isExpanded ? 'Collapse player' : 'Expand player'}
              >
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronUp className="w-4 h-4" />
                )}
              </motion.button>

              {/* Dismiss — minimal icon, large hit area */}
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={clearTrack}
                className="w-11 h-11 flex items-center justify-center cursor-pointer transition-opacity duration-200 opacity-50 hover:opacity-100"
                aria-label="Close player"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </motion.button>
            </div>
          </div>

          {/* Expanded View */}
          <ExpandedPlayerView
            isExpanded={isExpanded}
            progressPercentage={progressPercentage}
            currentTime={currentTime}
            duration={duration}
            onProgressChange={handleProgressChange}
            playbackRate={playbackRate}
            onSetPlaybackRate={setPlaybackRate}
            volume={volume}
            VolumeIcon={VolumeIcon}
            onVolumeChange={handleVolumeChange}
            chapters={currentTrack.chapters}
            onSeek={seek}
            user={user}
            upsellDismissed={upsellDismissed}
            onDismissUpsell={() => setUpsellDismissed(true)}
            onShowAuthModal={setShowAuthModal}
          />

          {/* Ambient Glow Effect */}
          <div
            className="absolute inset-0 pointer-events-none opacity-30"
            style={{
              background: `radial-gradient(ellipse at 50% 0%, hsl(var(--primary) / 0.15) 0%, transparent 70%)`,
            }}
          />
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
