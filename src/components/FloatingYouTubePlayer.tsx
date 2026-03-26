"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { AnimatePresence, motion, useDragControls } from "framer-motion";
import { X, Play, Pause, GripHorizontal, Maximize2, Minimize2 } from "lucide-react";
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
  const [hasPlayed, setHasPlayed] = useState(false);
  const [isOutOfView, setIsOutOfView] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showIcon, setShowIcon] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const iconTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Float when: video was played at least once, scrolled past, and not dismissed
  const shouldFloat = hasPlayed && isOutOfView && !isDismissed;

  // Detect mobile via pointer capability (touch = mobile, fine pointer = desktop)
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(
        window.matchMedia("(pointer: coarse)").matches ||
        window.matchMedia("(max-width: 768px)").matches
      );
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const handlePlayingChange = useCallback((playing: boolean) => {
    setIsPlaying(playing);
    if (playing) setHasPlayed(true);
  }, []);

  useEffect(() => {
    if (!isOutOfView) setIsDismissed(false);
  }, [isOutOfView]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => setIsOutOfView(!e.isIntersecting),
      { threshold: 0.5 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const handleMiniTap = useCallback(() => {
    const ref = playerRef as React.RefObject<YouTubeEmbedRef | null>;
    ref?.current?.togglePlayback();
    setShowIcon(true);
    if (iconTimer.current) clearTimeout(iconTimer.current);
    iconTimer.current = setTimeout(() => setShowIcon(false), 800);
  }, [playerRef]);

  // On mobile: overlay blocks iframe to prevent redirect, play/pause via API
  // On desktop: iframe is fully interactive, YouTube native controls work
  const needsOverlay = shouldFloat && isMobile;

  return (
    <>
      {/* Full-screen drag constraint boundary */}
      {shouldFloat && (
        <div ref={constraintsRef} className="fixed inset-0 pointer-events-none z-[48]" />
      )}

      <div ref={sentinelRef} className={cn("w-full", className)}>
        {/* Spacer to prevent layout shift when the player is floating */}
        {shouldFloat && <div className="aspect-video rounded-2xl bg-muted/30" />}

        {/*
          SINGLE YouTubeEmbed instance — NEVER unmounts.
          When floating: wraps in a draggable motion.div with fixed positioning.
          When inline: renders normally in document flow.
        */}
        <motion.div
          drag={shouldFloat}
          dragControls={dragControls}
          dragMomentum={false}
          dragElastic={0.1}
          dragConstraints={constraintsRef}
          // Reset drag position when returning to inline — prevents the player
          // from being "invisible" (stuck at the dragged offset)
          animate={shouldFloat ? undefined : { x: 0, y: 0 }}
          transition={shouldFloat ? undefined : { duration: 0 }}
          className={cn(
            "relative",
            !shouldFloat && "w-full",
            shouldFloat && [
              "fixed bottom-36 lg:bottom-24 right-3 z-[49]",
              isExpanded ? "w-80 lg:w-96" : "w-56 lg:w-64",
              "rounded-xl shadow-2xl ring-1 ring-border/20 dark:ring-white/10",
              "overflow-visible transition-[width] duration-200",
            ],
          )}
        >
          {/* Drag handle — only when floating. touchAction:none is ONLY on the handle,
              not the whole player, to avoid blocking page scroll on mobile. */}
          {shouldFloat && (
            <div
              className="absolute -top-5 left-1/2 -translate-x-1/2 z-30 bg-black/50 hover:bg-black/70 backdrop-blur-sm rounded-full px-3 py-0.5 cursor-grab active:cursor-grabbing transition-colors"
              style={{ touchAction: "none" }}
              onPointerDown={(e) => dragControls.start(e)}
            >
              <GripHorizontal className="h-3 w-3 text-white/80" />
            </div>
          )}

          {/* Video — on mobile: pointer-events blocked to prevent redirect.
              On desktop: fully interactive, YouTube native controls work. */}
          <div className={cn(
            "overflow-hidden rounded-xl",
            needsOverlay && "pointer-events-none",
          )}>
            <YouTubeEmbed
              ref={playerRef}
              videoId={videoId}
              title={title}
              onTimeUpdate={onTimeUpdate}
              onPlayingChange={handlePlayingChange}
            />
          </div>

          {/* Mobile-only: tap overlay for play/pause (prevents YouTube redirect) */}
          {needsOverlay && (
            <>
              <div
                className="absolute inset-0 z-10 rounded-xl cursor-pointer"
                onClick={handleMiniTap}
                role="button"
                tabIndex={0}
                aria-label="Toggle play/pause"
              />

              <AnimatePresence>
                {showIcon && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none"
                  >
                    <div className="bg-black/60 rounded-full p-2.5">
                      {isPlaying ? (
                        <Pause className="h-5 w-5 text-white" fill="white" />
                      ) : (
                        <Play className="h-5 w-5 text-white ml-0.5" fill="white" />
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}

          {/* Floating controls — close and expand buttons */}
          {shouldFloat && (
            <>
              {/* Close button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const ref = playerRef as React.RefObject<YouTubeEmbedRef | null>;
                  ref?.current?.pause();
                  setHasPlayed(false);
                  setIsDismissed(true);
                }}
                className="absolute top-1 right-1 z-30 bg-black/70 hover:bg-black/90 text-white rounded-full p-1 transition-colors"
                aria-label="Close mini player"
              >
                <X className="h-3 w-3" />
              </button>

              {/* Expand/Shrink toggle */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExpanded((prev) => !prev);
                }}
                className="absolute top-1 left-1 z-30 bg-black/70 hover:bg-black/90 text-white rounded-full p-1 transition-colors"
                aria-label={isExpanded ? "Shrink mini player" : "Expand mini player"}
              >
                {isExpanded ? (
                  <Minimize2 className="h-3 w-3" />
                ) : (
                  <Maximize2 className="h-3 w-3" />
                )}
              </button>
            </>
          )}
        </motion.div>
      </div>
    </>
  );
}
