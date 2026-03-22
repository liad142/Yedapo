'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { YouTubeLogo } from '@/components/YouTubeLogo';
import { Calendar, Clock, Sparkles, Loader2, ExternalLink } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { formatDuration } from '@/lib/formatters';
import type { VideoItem } from '@/components/VideoCard';

interface VideoListProps {
  videos: VideoItem[];
}

export function VideoList({ videos }: VideoListProps) {
  if (videos.length === 0) {
    return (
      <div className="text-center py-12 rounded-2xl bg-secondary/30 border border-border">
        <p className="text-muted-foreground">No videos found for this channel</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {videos.map((video) => (
        <VideoListItem key={video.videoId} video={video} />
      ))}
    </div>
  );
}

const VideoListItem = React.memo(function VideoListItem({ video }: { video: VideoItem }) {
  const router = useRouter();
  const { user } = useAuth();
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [episodeId, setEpisodeId] = useState<string | null>(null);
  const [hasSummary, setHasSummary] = useState(false);

  // Check if this video already has an episode/summary in the DB
  useEffect(() => {
    let cancelled = false;
    async function checkExisting() {
      try {
        const res = await fetch(`/api/youtube/${video.videoId}/status`);
        if (res.ok) {
          const data = await res.json();
          if (!cancelled && data.episodeId) {
            setEpisodeId(data.episodeId);
            setHasSummary(data.hasSummary || false);
          }
        }
      } catch {
        // Ignore - will show Summarize by default
      }
    }
    checkExisting();
    return () => { cancelled = true; };
  }, [video.videoId]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
    return date.toLocaleDateString();
  };

  const handleSummarize = async () => {
    if (episodeId) {
      router.push(`/episode/${episodeId}/insights`);
      return;
    }
    if (!user || isSummarizing) return;

    setIsSummarizing(true);
    try {
      const res = await fetch(`/api/youtube/${video.videoId}/summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          level: 'quick',
          title: video.title,
          description: video.description,
          channelId: video.channelId || '',
          channelTitle: video.channelName || '',
          thumbnailUrl: video.thumbnailUrl,
          publishedAt: video.publishedAt,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setEpisodeId(data.episodeId);
        router.push(`/episode/${data.episodeId}/insights`);
      }
    } catch {
      // Silently fail
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleWatch = () => {
    window.open(video.url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="group relative rounded-2xl hover:bg-secondary/50 transition-colors duration-200">
      <div className="flex gap-4 p-4 items-start">
        {/* Left: Text content */}
        <div className="flex-1 min-w-0 space-y-1.5">
          {/* Meta line */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap">
            <span>{formatDate(video.publishedAt)}</span>
            {video.duration && video.duration > 0 && (
              <>
                <span className="text-border">·</span>
                <span>{formatDuration(video.duration)}</span>
              </>
            )}
          </div>

          {/* Title */}
          <h3
            className="text-[15px] font-semibold text-foreground leading-snug group-hover:text-primary transition-colors line-clamp-2 cursor-pointer"
            onClick={handleSummarize}
          >
            {video.title}
          </h3>

          {/* Description */}
          {video.description && (
            <ExpandableDescription text={video.description} />
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 pt-1.5">
            <Button
              className={cn(
                "gap-2 rounded-full px-5 transition-all shadow-sm",
                hasSummary
                  ? "bg-secondary text-foreground hover:bg-secondary/80"
                  : "bg-primary text-primary-foreground hover:bg-primary/90"
              )}
              size="sm"
              onClick={handleSummarize}
              disabled={isSummarizing}
            >
              {isSummarizing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              {isSummarizing ? 'Importing...' : hasSummary ? 'View Summary' : 'Summarize'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 rounded-full px-5"
              onClick={handleWatch}
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Watch
            </Button>
          </div>
        </div>

        {/* Right: Video thumbnail */}
        <div className="shrink-0 self-center">
          <div className="relative w-28 h-20 sm:w-32 sm:h-[72px] rounded-xl overflow-hidden bg-secondary shadow-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={video.thumbnailUrl}
              alt={video.title}
              className="w-full h-full object-cover"
            />
            {/* YouTube badge */}
            <div className="absolute top-1.5 left-1.5">
              <YouTubeLogo videoId={video.videoId} size="xs" />
            </div>
            {/* Duration overlay */}
            {video.duration && video.duration > 0 && (
              <div className="absolute bottom-1 right-1 bg-black/80 text-white text-[10px] px-1.5 py-0.5 rounded flex items-center gap-0.5">
                <Clock className="w-2.5 h-2.5" />
                {formatDuration(video.duration)}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Subtle bottom separator */}
      <div className="mx-4 border-b border-border/60" />
    </div>
  );
});

function ExpandableDescription({ text }: { text: string }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isClamped, setIsClamped] = useState(false);
  const ref = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (el) {
      setIsClamped(el.scrollHeight > el.clientHeight + 1);
    }
  }, [text]);

  if (!text) return null;

  return (
    <div>
      <p
        ref={ref}
        className={cn(
          'text-sm text-muted-foreground leading-relaxed',
          !isExpanded && 'line-clamp-2'
        )}
      >
        {text}
      </p>
      {isClamped && (
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsExpanded(!isExpanded); }}
          className="text-xs text-primary/70 hover:text-primary transition-colors duration-150 mt-0.5"
          aria-expanded={isExpanded}
        >
          {isExpanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  );
}
