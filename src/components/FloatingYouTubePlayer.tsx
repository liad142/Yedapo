"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { AnimatePresence, motion, useDragControls } from "framer-motion";
import { X, GripHorizontal } from "lucide-react";
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
  const constraintsRef = useRef<HTMLDivElement>(null);
  const dragControls = useDragControls();
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
    <>
      {/* Full-screen drag constraint boundary */}
      <div ref={constraintsRef} className="fixed inset-0 pointer-events-none z-[48]" />

      <div ref={sentinelRef} className={cn("w-full", className)}>
        {/* Spacer to prevent layout shift when the player is floating */}
        {shouldFloat && (
          <div className="aspect-video rounded-2xl bg-muted/30" />
        )}

        {/* Player wrapper: toggles between inline and floating draggable mini-player */}
        {shouldFloat ? (
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0, y: 40, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 40, scale: 0.9 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              drag
              dragControls={dragControls}
              dragMomentum={false}
              dragElastic={0.1}
              dragConstraints={constraintsRef}
              className={cn(
                "fixed bottom-36 lg:bottom-24 right-3 z-[49] w-56 lg:w-64",
                "rounded-xl shadow-2xl ring-1 ring-border/20 dark:ring-white/10",
                "overflow-visible cursor-grab active:cursor-grabbing",
              )}
              style={{ touchAction: "none" }}
            >
              {/* Drag handle */}
              <div
                className="absolute -top-5 left-1/2 -translate-x-1/2 z-10 bg-black/50 hover:bg-black/70 backdrop-blur-sm rounded-full px-3 py-0.5 cursor-grab active:cursor-grabbing transition-colors"
                onPointerDown={(e) => dragControls.start(e)}
              >
                <GripHorizontal className="h-3 w-3 text-white/80" />
              </div>

              {/* Video */}
              <div className="rounded-xl overflow-hidden">
                <YouTubeEmbed
                  ref={playerRef}
                  videoId={videoId}
                  title={title}
                  onTimeUpdate={onTimeUpdate}
                  onPlayingChange={handlePlayingChange}
                />
              </div>

              {/* Close / dismiss button */}
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2, duration: 0.15 }}
                onClick={(e) => {
                  e.stopPropagation();
                  setIsDismissed(true);
                }}
                className="absolute top-1 right-1 z-10 bg-black/60 hover:bg-black/80 text-white rounded-full p-1 transition-colors"
                aria-label="Close mini player"
              >
                <X className="h-3 w-3" />
              </motion.button>
            </motion.div>
          </AnimatePresence>
        ) : (
          <YouTubeEmbed
            ref={playerRef}
            videoId={videoId}
            title={title}
            onTimeUpdate={onTimeUpdate}
            onPlayingChange={handlePlayingChange}
          />
        )}
      </div>
    </>
  );
}
