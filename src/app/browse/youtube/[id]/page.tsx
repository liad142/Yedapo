'use client';

import { useState, useEffect, use } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, Loader2, Heart, Share2 } from 'lucide-react';
import { YouTubeLogoStatic } from '@/components/YouTubeLogo';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { VideoCard, type VideoItem } from '@/components/VideoCard';
import { useAuth } from '@/contexts/AuthContext';

interface ChannelInfo {
  title: string;
  description: string;
  thumbnailUrl: string;
  subscriberCount?: string;
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function YouTubeChannelPage({ params }: PageProps) {
  const { id: channelId } = use(params);
  const { user, setShowAuthModal } = useAuth();

  const [channel, setChannel] = useState<ChannelInfo | null>(null);
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [channelDbId, setChannelDbId] = useState<string | null>(null);
  const [isTogglingFollow, setIsTogglingFollow] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/youtube/channels/${channelId}`);
        if (!res.ok) throw new Error('Failed to load channel');
        const data = await res.json();
        setChannel(data.channel);
        setVideos(data.videos || []);
        setIsFollowing(data.isFollowing || false);
        if (data.channelDbId) setChannelDbId(data.channelDbId);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load channel');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [channelId]);

  const handleFollowToggle = async () => {
    if (isTogglingFollow || !channel) return;
    if (!user) {
      setShowAuthModal(true, 'Sign up to follow your favourite channels and never miss a video.');
      return;
    }
    setIsTogglingFollow(true);
    try {
      if (isFollowing && channelDbId) {
        const res = await fetch(`/api/youtube/channels/${channelDbId}/unfollow`, { method: 'DELETE' });
        if (res.ok) {
          setIsFollowing(false);
          setChannelDbId(null);
        }
      } else {
        const res = await fetch('/api/youtube/channels/follow', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            channelId,
            title: channel.title,
            thumbnailUrl: channel.thumbnailUrl,
            description: channel.description,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          setIsFollowing(true);
          if (data.channel?.id) setChannelDbId(data.channel.id);
        }
      }
    } catch {
      // Silently fail
    } finally {
      setIsTogglingFollow(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !channel) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Link href="/browse" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-4 w-4" />
          Back to Browse
        </Link>
        <div className="text-center py-12">
          <p className="text-muted-foreground">{error || 'Channel not found'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Back link */}
      <Link href="/browse" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="h-4 w-4" />
        Back to Browse
      </Link>

      {/* Channel header */}
      <div className="flex items-start gap-6 mb-8">
        <div className="relative w-24 h-24 rounded-full overflow-hidden flex-shrink-0 bg-muted">
          <Image
            src={channel.thumbnailUrl || '/placeholder-podcast.png'}
            alt={channel.title}
            fill
            className="object-cover"
            sizes="96px"
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold text-foreground truncate">{channel.title}</h1>
            <YouTubeLogoStatic size="md" />
          </div>
          {channel.description && (
            <p className="text-muted-foreground line-clamp-3 mb-4">{channel.description}</p>
          )}
          <div className="flex items-center gap-3 pt-2">
            <Button
              size="lg"
              onClick={handleFollowToggle}
              disabled={isTogglingFollow}
              className={cn(
                'rounded-full px-8 font-semibold transition-all',
                isFollowing
                  ? 'bg-secondary text-foreground hover:bg-secondary/80'
                  : 'bg-primary text-primary-foreground hover:bg-primary/90'
              )}
            >
              {isTogglingFollow ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Heart className={cn('h-5 w-5 mr-2', isFollowing && 'fill-current')} />
              )}
              {isFollowing ? 'Saved to Library' : 'Follow Channel'}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={async () => {
                if (typeof navigator.share === 'function') {
                  try { await navigator.share({ title: channel.title, url: window.location.href }); } catch {}
                } else {
                  await navigator.clipboard.writeText(window.location.href);
                }
              }}
              className="rounded-full"
              aria-label="Share channel"
            >
              <Share2 className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Videos grid */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-4">Recent Videos</h2>
        {videos.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {videos.map((video) => (
              <VideoCard key={video.videoId} video={video} />
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-center py-8">No videos found</p>
        )}
      </div>
    </div>
  );
}
