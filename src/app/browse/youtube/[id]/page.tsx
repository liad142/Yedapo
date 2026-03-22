'use client';

import { useState, useEffect, use } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, Loader2, Heart, Users } from 'lucide-react';
import { YouTubeLogoStatic } from '@/components/YouTubeLogo';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { VideoCard, type VideoItem } from '@/components/VideoCard';
import { useAuth } from '@/contexts/AuthContext';
import { NotifyToggle } from '@/components/NotifyToggle';
import { motion } from 'framer-motion';
import { springBouncy } from '@/lib/motion';

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
  const [notifyEnabled, setNotifyEnabled] = useState(false);
  const [notifyChannels, setNotifyChannels] = useState<string[]>([]);

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
        if (data.notifyEnabled !== undefined) setNotifyEnabled(data.notifyEnabled);
        if (data.notifyChannels) setNotifyChannels(data.notifyChannels);
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

  const handleUpdateNotifyPrefs = async (enabled: boolean, channels: string[]) => {
    if (!channelDbId) return;
    setNotifyEnabled(enabled);
    setNotifyChannels(channels);
    try {
      await fetch(`/api/youtube/channels/${channelDbId}/notifications`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notifyEnabled: enabled, notifyChannels: channels }),
      });
    } catch {
      setNotifyEnabled(!enabled);
      setNotifyChannels([]);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <div className="relative overflow-hidden rounded-3xl bg-secondary h-72 animate-pulse" />
        </div>
      </div>
    );
  }

  if (error || !channel) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <Link href="/discover" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Back to Discover
          </Link>
          <div className="text-center py-12">
            <p className="text-muted-foreground">{error || 'Channel not found'}</p>
          </div>
        </div>
      </div>
    );
  }

  const thumbnailUrl = channel.thumbnailUrl || '/placeholder-podcast.png';

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="space-y-8">
          {/* Immersive Header — matching podcast browse page style */}
          <div className="relative z-10 rounded-3xl bg-slate-900 border border-white/10 shadow-2xl">
            {/* Blurred Background Backdrop */}
            <div className="absolute inset-0 z-0 overflow-hidden rounded-3xl">
              <Image
                src={thumbnailUrl}
                alt=""
                fill
                className="object-cover blur-3xl scale-110 opacity-60"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent" />
            </div>

            {/* Content Overlay */}
            <div className="relative z-10 p-8 md:p-12 flex flex-col md:flex-row gap-8 items-center md:items-start text-center md:text-left">
              <div className="w-32 h-32 md:w-40 md:h-40 shrink-0 rounded-full overflow-hidden shadow-2xl border-2 border-white/10">
                <Image
                  src={thumbnailUrl}
                  alt={channel.title}
                  width={160}
                  height={160}
                  className="w-full h-full object-cover"
                  priority
                />
              </div>

              <div className="flex-1 space-y-4 min-w-0">
                <div>
                  <div className="flex items-center justify-center md:justify-start gap-3 mb-3">
                    <h1 className="text-2xl md:text-4xl font-bold text-white tracking-tight leading-tight drop-shadow-sm truncate">
                      {channel.title}
                    </h1>
                    <YouTubeLogoStatic size="md" />
                  </div>
                  {channel.subscriberCount && (
                    <p className="text-sm text-slate-400 flex items-center justify-center md:justify-start gap-1.5">
                      <Users className="h-3.5 w-3.5" />
                      {channel.subscriberCount} subscribers
                    </p>
                  )}
                </div>

                {/* Badges */}
                <div className="flex flex-wrap justify-center md:justify-start gap-2">
                  {videos.length > 0 && (
                    <span className="px-3 py-1 rounded-full bg-white/10 backdrop-blur-sm border border-white/10 text-xs font-semibold text-white/90">
                      {videos.length} videos
                    </span>
                  )}
                </div>

                {/* Description */}
                {channel.description && (
                  <p className="text-slate-300 leading-relaxed max-w-2xl line-clamp-3 text-sm md:text-base border-l-2 border-white/20 pl-4">
                    {channel.description}
                  </p>
                )}

                {/* Action Buttons */}
                <div className="flex items-center gap-1 pt-2 justify-center md:justify-start">
                  <motion.div
                    whileTap={{ scale: 1.3 }}
                    transition={isFollowing ? { duration: 0.4, ease: 'easeInOut' } : springBouncy}
                    animate={isFollowing ? { scale: [1, 1.25, 1] } : undefined}
                  >
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleFollowToggle}
                      disabled={isTogglingFollow}
                      className={cn(
                        'rounded-full text-white hover:bg-white/10',
                        isFollowing && 'text-red-500 hover:text-red-600'
                      )}
                      aria-label={isFollowing ? 'Remove from library' : 'Save to library'}
                    >
                      {isTogglingFollow ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <Heart className={cn('h-5 w-5', isFollowing && 'fill-current')} />
                      )}
                    </Button>
                  </motion.div>

                  {isFollowing && channelDbId && (
                    <NotifyToggle
                      enabled={notifyEnabled}
                      channels={notifyChannels}
                      onUpdate={handleUpdateNotifyPrefs}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Videos Section */}
          <section className="bg-secondary/50 md:bg-transparent -mx-4 px-4 py-8 md:px-0 md:mx-0 md:py-0">
            <h2 className="text-xl md:text-2xl font-bold tracking-tight text-foreground mb-6 flex items-center gap-3">
              Recent Videos
              {videos.length > 0 && (
                <Badge variant="secondary">{videos.length}</Badge>
              )}
            </h2>

            {videos.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {videos.map((video) => (
                  <VideoCard key={video.videoId} video={video} />
                ))}
              </div>
            ) : (
              <div className="text-center py-12 rounded-2xl bg-secondary/30 border border-border">
                <p className="text-muted-foreground">No videos found for this channel</p>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
