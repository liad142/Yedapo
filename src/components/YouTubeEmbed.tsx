"use client";

import { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from "react";
import { cn } from "@/lib/utils";
import { getYouTubeThumbnail } from "@/lib/youtube/utils";
import { Play, AlertTriangle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

// YouTube IFrame API types
declare global {
  interface Window {
    YT: {
      Player: new (
        element: HTMLElement | string,
        config: {
          videoId: string;
          playerVars?: Record<string, string | number>;
          events?: {
            onReady?: (event: { target: YTPlayer }) => void;
            onStateChange?: (event: { data: number; target: YTPlayer }) => void;
            onError?: (event: { data: number }) => void;
          };
        }
      ) => YTPlayer;
      PlayerState: {
        PLAYING: number;
        PAUSED: number;
        ENDED: number;
        BUFFERING: number;
      };
    };
    onYouTubeIframeAPIReady: (() => void) | undefined;
  }
}

interface YTPlayer {
  seekTo: (seconds: number, allowSeekAhead?: boolean) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlayerState: () => number;
  playVideo: () => void;
  pauseVideo: () => void;
  destroy: () => void;
}

export interface YouTubeEmbedRef {
  seekTo: (seconds: number) => void;
  play: () => void;
  pause: () => void;
  togglePlayback: () => void;
  isPlaying: () => boolean;
  getCurrentTime: () => number;
  getDuration: () => number;
}

interface YouTubeEmbedProps {
  videoId: string;
  title?: string;
  className?: string;
  onReady?: () => void;
  onTimeUpdate?: (seconds: number) => void;
  onPlayingChange?: (playing: boolean) => void;
  onError?: (errorCode: number) => void;
}

// Load YouTube IFrame API script (singleton)
let apiLoadPromise: Promise<void> | null = null;
function loadYouTubeAPI(): Promise<void> {
  if (apiLoadPromise) return apiLoadPromise;
  if (typeof window !== "undefined" && window.YT?.Player) {
    return Promise.resolve();
  }

  apiLoadPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.onerror = () => {
      apiLoadPromise = null; // allow retry
      reject(new Error("Failed to load YouTube IFrame API"));
    };
    window.onYouTubeIframeAPIReady = () => resolve();
    document.head.appendChild(script);
  });

  return apiLoadPromise;
}

export const YouTubeEmbed = forwardRef<YouTubeEmbedRef, YouTubeEmbedProps>(
  function YouTubeEmbed({ videoId, title, className, onReady, onTimeUpdate, onPlayingChange, onError }, ref) {
    const [isActivated, setIsActivated] = useState(false);
    const [hasError, setHasError] = useState(false);
    const [imgError, setImgError] = useState(false);
    const playerRef = useRef<YTPlayer | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const instanceId = useRef(`yt-player-${videoId}-${Math.random().toString(36).slice(2, 8)}`);

    // Stable callback refs to avoid effect re-runs when parent re-renders
    const onTimeUpdateRef = useRef(onTimeUpdate);
    onTimeUpdateRef.current = onTimeUpdate;
    const onReadyRef = useRef(onReady);
    onReadyRef.current = onReady;
    const onPlayingChangeRef = useRef(onPlayingChange);
    onPlayingChangeRef.current = onPlayingChange;
    const onErrorRef = useRef(onError);
    onErrorRef.current = onError;

    useImperativeHandle(ref, () => ({
      seekTo: (seconds: number) => {
        if (playerRef.current) {
          playerRef.current.seekTo(seconds, true);
          playerRef.current.playVideo();
        } else {
          setIsActivated(true);
          pendingSeekRef.current = seconds;
        }
      },
      play: () => { playerRef.current?.playVideo(); },
      pause: () => { playerRef.current?.pauseVideo(); },
      togglePlayback: () => {
        const player = playerRef.current;
        if (!player) return;
        try {
          const state = player.getPlayerState();
          if (state === 1) { player.pauseVideo(); } // 1 = PLAYING
          else { player.playVideo(); }
        } catch { player.playVideo(); }
      },
      isPlaying: () => {
        try { return playerRef.current?.getPlayerState() === 1; }
        catch { return false; }
      },
      getCurrentTime: () => {
        try { return playerRef.current?.getCurrentTime() ?? 0; }
        catch { return 0; }
      },
      getDuration: () => {
        try { return playerRef.current?.getDuration() ?? 0; }
        catch { return 0; }
      },
    }));

    const pendingSeekRef = useRef<number | null>(null);

    // Start/stop polling for time updates
    const startPolling = useCallback(() => {
      if (pollingRef.current) return;
      pollingRef.current = setInterval(() => {
        if (playerRef.current && onTimeUpdateRef.current) {
          try {
            onTimeUpdateRef.current(playerRef.current.getCurrentTime());
          } catch {
            // Player might be destroyed
          }
        }
      }, 1000);
    }, []);

    const stopPolling = useCallback(() => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    }, []);

    // Initialize YouTube player when activated
    useEffect(() => {
      if (!isActivated || !containerRef.current) return;

      let player: YTPlayer | null = null;
      let destroyed = false;

      const initPlayer = async () => {
        try {
          await loadYouTubeAPI();
        } catch {
          if (!destroyed) setHasError(true);
          return;
        }
        if (destroyed || !containerRef.current) return;

        // Create a div for the player inside the container
        const playerDiv = document.createElement("div");
        playerDiv.id = instanceId.current;
        containerRef.current.appendChild(playerDiv);

        player = new window.YT.Player(playerDiv.id, {
          videoId,
          playerVars: {
            autoplay: 1,
            modestbranding: 1,
            rel: 0,
            playsinline: 1,
          },
          events: {
            onReady: (event) => {
              if (destroyed) return;
              playerRef.current = event.target;
              onReadyRef.current?.();

              // Handle pending seek
              if (pendingSeekRef.current !== null) {
                event.target.seekTo(pendingSeekRef.current, true);
                event.target.playVideo();
                pendingSeekRef.current = null;
              }
            },
            onStateChange: (event) => {
              if (destroyed) return;
              const playing = event.data === window.YT.PlayerState.PLAYING;
              onPlayingChangeRef.current?.(playing);
              if (playing) {
                startPolling();
              } else {
                stopPolling();
                // Send one final time update when paused
                if (onTimeUpdateRef.current && playerRef.current) {
                  try {
                    onTimeUpdateRef.current(playerRef.current.getCurrentTime());
                  } catch {
                    // ignore
                  }
                }
              }
            },
            onError: (event) => {
              if (destroyed) return;
              setHasError(true);
              onErrorRef.current?.(event.data);
            },
          },
        });
      };

      initPlayer();

      return () => {
        destroyed = true;
        stopPolling();
        if (player) {
          try {
            player.destroy();
          } catch {
            // ignore
          }
        }
        playerRef.current = null;
      };
    }, [isActivated, videoId, startPolling, stopPolling]);

    // Cleanup polling on unmount
    useEffect(() => {
      return () => stopPolling();
    }, [stopPolling]);

    const thumbnailUrl = imgError
      ? getYouTubeThumbnail(videoId, "hqdefault")
      : getYouTubeThumbnail(videoId, "maxresdefault");

    // Error fallback
    if (hasError) {
      return (
        <div
          className={cn(
            "aspect-video rounded-2xl overflow-hidden bg-muted flex flex-col items-center justify-center gap-3 p-6",
            className
          )}
        >
          <AlertTriangle className="h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground text-center">
            Video unavailable
          </p>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() =>
              window.open(
                `https://www.youtube.com/watch?v=${videoId}`,
                "_blank",
                "noopener,noreferrer"
              )
            }
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Open on YouTube
          </Button>
        </div>
      );
    }

    // Thumbnail placeholder (before activation)
    if (!isActivated) {
      return (
        <button
          onClick={() => setIsActivated(true)}
          className={cn(
            "aspect-video rounded-2xl overflow-hidden relative group cursor-pointer w-full",
            className
          )}
          aria-label={`Play ${title || "video"}`}
        >
          {/* Thumbnail */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={thumbnailUrl}
            alt={title || "YouTube video thumbnail"}
            className="w-full h-full object-cover"
            onError={() => {
              if (!imgError) setImgError(true);
            }}
          />

          {/* Dark overlay on hover */}
          <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors" />

          {/* YouTube-style play button */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-[68px] h-[48px] bg-red-600 rounded-xl flex items-center justify-center group-hover:bg-red-500 transition-colors shadow-lg">
              <Play className="h-6 w-6 text-white fill-white ml-1" />
            </div>
          </div>
        </button>
      );
    }

    // Active player
    return (
      <div
        ref={containerRef}
        className={cn(
          "aspect-video rounded-2xl overflow-hidden bg-black [&_iframe]:w-full [&_iframe]:h-full",
          className
        )}
        title={title}
      />
    );
  }
);
