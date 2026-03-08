'use client';

import React, { useState } from 'react';
import posthog from 'posthog-js';
import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { YouTubeLogo } from '@/components/YouTubeLogo';
import { Bookmark, Play, Clock, Calendar, ExternalLink, Sparkles, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { formatDuration as formatDurationHuman } from '@/lib/formatters';
import { useRouter } from 'next/navigation';

export interface VideoItem {
  videoId: string;
  title: string;
  description?: string;
  thumbnailUrl: string;
  publishedAt: string;
  channelName?: string;
  channelUrl?: string;
  url: string;
  duration?: number;
  bookmarked?: boolean;
  channelId?: string;
}

type SummaryCardStatus = 'none' | 'loading' | 'ready';

interface VideoCardProps {
  video: VideoItem;
  onSave?: (video: VideoItem, saved: boolean) => void;
  episodeId?: string;
  summaryStatus?: SummaryCardStatus;
  onSummarize?: (video: VideoItem) => void;
  className?: string;
}

export const VideoCard = React.memo(function VideoCard({ video, onSave, episodeId, summaryStatus = 'none', onSummarize, className }: VideoCardProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [isSaved, setIsSaved] = useState(video.bookmarked || false);
  const [isSaving, setIsSaving] = useState(false);
  const [localSummaryStatus, setLocalSummaryStatus] = useState<SummaryCardStatus>(summaryStatus);
  const [localEpisodeId, setLocalEpisodeId] = useState<string | undefined>(episodeId);

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

  const formatDuration = (seconds?: number) => {
    if (!seconds) return null;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins >= 60) {
      const hrs = Math.floor(mins / 60);
      const remainingMins = mins % 60;
      return `${hrs}:${remainingMins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSave = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isSaving || !user) return;

    setIsSaving(true);
    try {
      const response = await fetch('/api/youtube/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId: video.videoId,
          title: video.title,
          description: video.description,
          thumbnailUrl: video.thumbnailUrl,
          publishedAt: video.publishedAt,
          channelName: video.channelName,
          url: video.url,
          action: 'toggle',
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setIsSaved(data.bookmarked);
        posthog.capture(data.bookmarked ? 'video_bookmarked' : 'video_unbookmarked', { video_id: video.videoId, title: video.title });
        onSave?.(video, data.bookmarked);
      }
    } catch (err) {
      console.error('Failed to save video:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSummarize = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (localEpisodeId && localSummaryStatus === 'ready') {
      router.push(`/episode/${localEpisodeId}/insights`);
      return;
    }

    if (!user || localSummaryStatus === 'loading') return;

    if (onSummarize) {
      onSummarize(video);
      return;
    }

    setLocalSummaryStatus('loading');
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
        setLocalEpisodeId(data.episodeId);
        if (data.summary?.status === 'ready') {
          setLocalSummaryStatus('ready');
          router.push(`/episode/${data.episodeId}/insights`);
        } else {
          setLocalSummaryStatus('ready');
          router.push(`/episode/${data.episodeId}/insights`);
        }
      } else {
        setLocalSummaryStatus('none');
      }
    } catch {
      setLocalSummaryStatus('none');
    }
  };

  const [isImporting, setIsImporting] = useState(false);

  const handleNavigate = async () => {
    posthog.capture('video_clicked', { video_id: video.videoId, title: video.title });
    // Navigate to episode page if we have an episodeId
    if (localEpisodeId) {
      router.push(`/episode/${localEpisodeId}/insights`);
      return;
    }

    // Import the video first, then navigate to the episode page
    if (!user || isImporting) return;

    setIsImporting(true);
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
        setLocalEpisodeId(data.episodeId);
        router.push(`/episode/${data.episodeId}/insights`);
      } else {
        // Fallback: open on YouTube if import fails
        window.open(video.url, '_blank', 'noopener,noreferrer');
      }
    } catch {
      window.open(video.url, '_blank', 'noopener,noreferrer');
    } finally {
      setIsImporting(false);
    }
  };

  const handleWatch = () => {
    posthog.capture('video_watch_on_youtube', { video_id: video.videoId, title: video.title });
    window.open(video.url, '_blank', 'noopener,noreferrer');
  };

  return (
    <Card interactive className={cn(
      'group overflow-hidden transition-all duration-300',
      'hover:shadow-lg hover:-translate-y-1',
      className
    )}>
      {/* Thumbnail */}
      <div className="relative aspect-video overflow-hidden bg-muted">
        <Image
          src={video.thumbnailUrl}
          alt={video.title}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="object-cover transition-transform duration-300 group-hover:scale-105"
        />
        
        {/* Play overlay */}
        <div
          className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center cursor-pointer"
          onClick={handleNavigate}
        >
          <div className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
            <Play className="w-6 h-6 text-red-600 ml-1" fill="currentColor" />
          </div>
        </div>

        {/* Duration badge */}
        {video.duration && (
          <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatDuration(video.duration)}
          </div>
        )}

        {/* YouTube logo */}
        <div className="absolute top-2 left-2 bg-black/70 backdrop-blur-sm rounded-md px-1.5 py-0.5 z-10">
          <YouTubeLogo videoId={video.videoId} size="xs" />
        </div>

        {/* Save button */}
        <Button
          size="icon"
          variant="ghost"
          onClick={handleSave}
          disabled={isSaving}
          className={cn(
            'absolute top-2 right-2 h-8 w-8 rounded-full transition-all duration-200',
            'bg-black/50 hover:bg-black/70',
            isSaved && 'bg-primary hover:bg-primary/90'
          )}
          aria-label={isSaved ? 'Remove from Saved' : 'Save video'}
        >
          <Bookmark 
            className={cn(
              'h-4 w-4 text-white',
              isSaved && 'fill-current',
              isSaving && 'animate-pulse'
            )} 
          />
        </Button>
      </div>

      {/* Content */}
      <CardContent className="p-3 space-y-2">
        {/* Title */}
        <h3 
          className="font-medium text-sm line-clamp-2 leading-tight group-hover:text-primary transition-colors cursor-pointer"
          onClick={handleNavigate}
        >
          {video.title}
        </h3>

        {/* Channel name */}
        {video.channelName && (
          <p className="text-xs text-muted-foreground line-clamp-1">
            {video.channelName}
          </p>
        )}

        {/* Metadata row */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {formatDate(video.publishedAt)}
            {video.duration && video.duration > 0 && (
              <>
                <span className="text-border">&#8226;</span>
                {formatDurationHuman(video.duration)}
              </>
            )}
          </span>
          <div className="flex items-center gap-1">
            {user && (
              <Button
                size="sm"
                variant="ghost"
                className={cn(
                  'h-6 px-2 text-xs',
                  localSummaryStatus === 'ready' && 'text-primary'
                )}
                onClick={handleSummarize}
                disabled={localSummaryStatus === 'loading'}
              >
                {localSummaryStatus === 'loading' ? (
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                ) : (
                  <Sparkles className="w-3 h-3 mr-1" />
                )}
                {localSummaryStatus === 'ready' ? 'Insights' : 'Summarize'}
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-xs"
              onClick={handleWatch}
            >
              <ExternalLink className="w-3 h-3 mr-1" />
              Watch
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});
