"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { YouTubeEmbed, type YouTubeEmbedRef } from "./YouTubeEmbed";

interface FloatingYouTubePlayerProps {
  videoId: string;
  title?: string;
  className?: string;
  onTimeUpdate?: (seconds: number) => void;
  playerRef?: React.Ref<YouTubeEmbedRef>;
}

export function FloatingYouTubePlayer({
  videoId,
  title,
  className,
  onTimeUpdate,
  playerRef,
}: FloatingYouTubePlayerProps) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isOutOfView, setIsOutOfView] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  const shouldFloat = isPlaying && isOutOfView && !isDismissed;

  const handlePlayingChange = useCallback((playing: boolean) => {
    setIsPlaying(playing);
  }, []);

  // Reset dismiss when the main player scrolls back into view
  useEffect(() => {
    if (!isOutOfView) setIsDismissed(false);
  }, [isOutOfView]);

  // IntersectionObserver on the sentinel to detect when the main embed leaves viewport
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => setIsOutOfView(!entry.isIntersecting),
      { threshold: 0.5 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={sentinelRef} className={cn("w-full", className)}>
      {/* Spacer to prevent layout shift when the player is floating */}
      {shouldFloat && (
        <div className="aspect-video rounded-2xl bg-muted/30" />
      )}

      {/* Player wrapper: toggles between inline and fixed mini-player */}
      <div
        className={cn(
          shouldFloat && [
            "fixed bottom-28 lg:bottom-20 right-3 z-[49] w-64",
            "rounded-xl shadow-2xl ring-1 ring-border/20 dark:ring-white/10",
            "overflow-hidden",
          ],
        )}
        style={
          shouldFloat
            ? { animation: "mini-player-slide-in 300ms ease-out" }
            : undefined
        }
      >
        <YouTubeEmbed
          ref={playerRef}
          videoId={videoId}
          title={title}
          onTimeUpdate={onTimeUpdate}
          onPlayingChange={handlePlayingChange}
        />

        {/* Close / dismiss button */}
        <AnimatePresence>
          {shouldFloat && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={() => setIsDismissed(true)}
              className="absolute top-1.5 right-1.5 z-10 bg-black/60 hover:bg-black/80 text-white rounded-full p-1 transition-colors"
              aria-label="Close mini player"
            >
              <X className="h-3 w-3" />
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
