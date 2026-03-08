"use client";

import { Play, Sparkles, ArrowUp, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAskAI } from "@/contexts/AskAIContext";
import { useAudioPlayerSafe } from "@/contexts/AudioPlayerContext";
import type { Track } from "@/contexts/AudioPlayerContext";
import { useUsage } from "@/contexts/UsageContext";

/**
 * Ask AI bar with two visual modes:
 * - standalone: floating unified pill at the bottom (when player is NOT active)
 *   Layout: [▶] | [✨ Ask anything... | 💬]
 * - integrated: compact dark row inside the StickyAudioPlayer
 */
export function AskAIBar({ mode, track }: { mode: "standalone" | "integrated"; track?: Track }) {
  const { active, openChat } = useAskAI();
  const player = useAudioPlayerSafe();
  const playerActive = !!(player && player.currentTrack);
  const { usage } = useUsage();

  const askAiRemaining = usage && usage.askAi.limit !== -1
    ? Math.max(0, usage.askAi.limit - usage.askAi.used)
    : null;

  const handlePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (track && player) {
      player.play(track);
    }
  };

  // Standalone: only show when on insights page AND player is NOT active
  if (mode === "standalone") {
    if (!active || playerActive) return null;

    const showPlay = !!(track && player);

    return (
      <div className="fixed bottom-20 lg:bottom-6 left-4 right-4 z-50 pointer-events-none flex justify-center">
        <div className="pointer-events-auto w-full max-w-2xl">
          <div className="bg-card border border-border shadow-[var(--shadow-floating)] rounded-2xl flex items-center overflow-hidden">

            {/* Play section */}
            {showPlay && (
              <>
                <button
                  onClick={handlePlay}
                  className="flex items-center gap-2 px-5 py-3 hover:bg-secondary transition-colors shrink-0 group/play"
                  aria-label="Play episode"
                >
                  <Play className="h-4 w-4 fill-current text-foreground group-hover/play:text-primary transition-colors" />
                  <span className="text-body-sm font-semibold text-foreground group-hover/play:text-primary transition-colors">Play</span>
                </button>
                <div className="w-px h-6 bg-border shrink-0" />
              </>
            )}

            {/* Ask AI section */}
            <div
              className="flex-1 flex items-center gap-2.5 px-4 py-2.5 cursor-text"
              onClick={() => openChat()}
            >
              <Sparkles className="h-5 w-5 text-primary shrink-0" />
              <div className="flex-1 text-muted-foreground text-body-sm truncate">
                Ask about this episode...
              </div>
              {askAiRemaining !== null && (
                <span className="text-[11px] text-muted-foreground/60 shrink-0 tabular-nums">
                  {askAiRemaining} left
                </span>
              )}
              <Button
                size="icon"
                className="rounded-full w-8 h-8 bg-primary text-primary-foreground hover:bg-primary/90 shrink-0"
                onClick={(e) => { e.stopPropagation(); openChat(); }}
              >
                <ArrowUp className="h-4 w-4" />
              </Button>
            </div>

          </div>
        </div>
      </div>
    );
  }

  // Integrated: only show when on insights page AND player IS active
  if (!active) return null;

  return (
    <div
      className="px-4 py-2.5 border-b border-border cursor-text hover:bg-secondary/50 transition-colors"
      onClick={() => openChat()}
    >
      <div className="flex items-center gap-2.5">
        <div className="bg-primary rounded-full p-1 shrink-0">
          <Sparkles className="h-3 w-3 text-white" />
        </div>
        <div className="flex-1 text-muted-foreground text-sm truncate">
          Ask anything...
        </div>
        {askAiRemaining !== null && (
          <span className="text-[10px] text-muted-foreground/50 shrink-0 tabular-nums mr-1">
            {askAiRemaining} left
          </span>
        )}
        <MessageSquare className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
      </div>
    </div>
  );
}
