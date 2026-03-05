'use client';

import React, { useMemo, useRef, useState, useCallback } from 'react';
import { formatTime } from '@/lib/formatters';
import { cn } from '@/lib/utils';

export interface Chapter {
  title: string;
  timestamp: string;
  timestamp_seconds: number;
}

// YouTube-style segmented chapter scrubber for the top progress bar
export function ChapterScrubber({
  chapters,
  currentTime,
  duration,
  onSeek,
}: {
  chapters: Chapter[];
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
}) {
  const barRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hoverInfo, setHoverInfo] = useState<{
    x: number;
    time: number;
    chapterTitle: string;
  } | null>(null);

  const segments = useMemo(() => {
    const raw = chapters.map((ch, i) => {
      const start = ch.timestamp_seconds;
      const end = i < chapters.length - 1 ? chapters[i + 1].timestamp_seconds : duration;
      return { ...ch, start, end, widthPct: duration > 0 ? ((end - start) / duration) * 100 : 0 };
    });
    // Add intro spacer when first chapter doesn't start at 0 — keeps visual aligned with seek math
    if (raw.length > 0 && raw[0].start > 0 && duration > 0) {
      raw.unshift({
        title: 'Intro',
        timestamp: '00:00',
        timestamp_seconds: 0,
        start: 0,
        end: raw[0].start,
        widthPct: (raw[0].start / duration) * 100,
      });
    }
    return raw;
  }, [chapters, duration]);

  const getTimeFromX = useCallback(
    (clientX: number) => {
      if (!barRef.current) return 0;
      const rect = barRef.current.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      return pct * duration;
    },
    [duration]
  );

  const getHoverInfo = useCallback(
    (clientX: number) => {
      if (!barRef.current) return null;
      const rect = barRef.current.getBoundingClientRect();
      const x = clientX - rect.left;
      const time = getTimeFromX(clientX);
      const chapter = segments.findLast((s) => time >= s.start) ?? segments[0];
      return { x, time, chapterTitle: chapter?.title ?? '' };
    },
    [getTimeFromX, segments]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      setIsDragging(true);
      const time = getTimeFromX(e.clientX);
      onSeek(time);
      setHoverInfo(getHoverInfo(e.clientX));
    },
    [getTimeFromX, getHoverInfo, onSeek]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const info = getHoverInfo(e.clientX);
      setHoverInfo(info);
      if (isDragging && info) {
        onSeek(info.time);
      }
    },
    [isDragging, getHoverInfo, onSeek]
  );

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handlePointerLeave = useCallback(() => {
    if (!isDragging) setHoverInfo(null);
  }, [isDragging]);

  // Total gap pixels: 2px per gap
  const gapCount = segments.length - 1;

  return (
    <div
      ref={barRef}
      className="relative w-full h-full"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerLeave}
      style={{ touchAction: 'none' }}
    >
      {/* Segments */}
      <div className="flex h-full items-stretch" style={{ gap: gapCount > 0 ? '3px' : 0 }}>
        {segments.map((seg, i) => {
          let fillPct = 0;
          if (currentTime >= seg.end) fillPct = 100;
          else if (currentTime > seg.start) fillPct = ((currentTime - seg.start) / (seg.end - seg.start)) * 100;

          return (
            <div
              key={i}
              className="relative h-full rounded-[1px] overflow-hidden bg-muted-foreground/15"
              style={{ flex: `${seg.widthPct} 0 0%` }}
            >
              <div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary via-primary to-blue-400 rounded-[1px]"
                style={{ width: `${fillPct}%` }}
              />
            </div>
          );
        })}
      </div>

      {/* Glow effect on progress */}
      <div
        className="absolute top-0 h-full bg-primary/50 blur-sm pointer-events-none"
        style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
      />

      {/* Hover tooltip */}
      {hoverInfo && barRef.current && (
        <div
          className="absolute bottom-full mb-2 pointer-events-none z-10 -translate-x-1/2 whitespace-nowrap"
          style={{
            left: Math.max(60, Math.min(hoverInfo.x, barRef.current.getBoundingClientRect().width - 60)),
          }}
        >
          <div className="bg-popover text-popover-foreground text-xs rounded px-2 py-1 shadow-lg border border-border">
            {hoverInfo.chapterTitle} &middot; {formatTime(hoverInfo.time)}
          </div>
        </div>
      )}
    </div>
  );
}
