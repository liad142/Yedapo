'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Library, Youtube, Radio, RefreshCw, X, UserMinus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PodcastCard } from '@/components/PodcastCard';
import { EmptyState } from '@/components/EmptyState';
import { SignInPrompt } from '@/components/auth/SignInPrompt';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

type ListTab = 'podcasts' | 'youtube';

interface PodcastWithStatus {
  id: string;
  title: string;
  author: string | null;
  description: string | null;
  image_url: string | null;
  rss_feed_url: string;
  language: string;
  created_at: string;
  latest_episode_date: string | null;
  subscription: {
    id: string;
    created_at: string;
    last_viewed_at: string;
  };
  has_new_episodes: boolean;
}

interface FollowedChannel {
  id: string;
  channel_id: string;
  channel_name: string;
  channel_url: string;
  channel_handle?: string;
  thumbnail_url?: string;
  description?: string;
}

export default function MyListPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<ListTab>('podcasts');

  // Podcasts state
  const [podcasts, setPodcasts] = useState<PodcastWithStatus[]>([]);
  const [podcastsLoading, setPodcastsLoading] = useState(true);
  const [podcastsError, setPodcastsError] = useState<string | null>(null);

  // YouTube channels state
  const [channels, setChannels] = useState<FollowedChannel[]>([]);
  const [channelsLoading, setChannelsLoading] = useState(true);
  const [channelsError, setChannelsError] = useState<string | null>(null);

  const fetchPodcasts = useCallback(async () => {
    if (!user) return;
    setPodcastsLoading(true);
    setPodcastsError(null);
    try {
      const res = await fetch('/api/subscriptions');
      if (!res.ok) throw new Error('Failed to fetch subscriptions');
      const data = await res.json();
      setPodcasts(data.podcasts || []);
    } catch (err) {
      console.error('Error fetching subscriptions:', err);
      setPodcastsError('Failed to load your podcasts');
    } finally {
      setPodcastsLoading(false);
    }
  }, [user]);

  const fetchChannels = useCallback(async () => {
    if (!user) return;
    setChannelsLoading(true);
    setChannelsError(null);
    try {
      const res = await fetch('/api/my-list/channels');
      if (!res.ok) throw new Error('Failed to fetch channels');
      const data = await res.json();
      setChannels(data.channels || []);
    } catch (err) {
      console.error('Error fetching channels:', err);
      setChannelsError('Failed to load your channels');
    } finally {
      setChannelsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setPodcastsLoading(false);
      setChannelsLoading(false);
      return;
    }
    if (activeTab === 'podcasts') {
      fetchPodcasts();
    } else {
      fetchChannels();
    }
  }, [activeTab, user, fetchPodcasts, fetchChannels]);

  const handleUnsubscribe = async (podcastId: string) => {
    try {
      const res = await fetch(`/api/subscriptions/${podcastId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to unsubscribe');
      setPodcasts(prev => prev.filter(p => p.id !== podcastId));
    } catch (err) {
      console.error('Error unsubscribing:', err);
    }
  };

  const handleUnfollow = async (channel: FollowedChannel) => {
    try {
      const res = await fetch(`/api/youtube/channels/${channel.id}/unfollow`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to unfollow');
      setChannels(prev => prev.filter(c => c.id !== channel.id));
    } catch (err) {
      console.error('Error unfollowing:', err);
    }
  };

  if (authLoading) {
    return (
      <div className="px-4 py-8 min-h-screen bg-background">
        <div className="max-w-5xl mx-auto">
          <Skeleton className="h-10 w-48 mb-4 bg-secondary" />
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square rounded-xl bg-secondary" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="px-4 py-8 min-h-screen bg-background">
        <div className="max-w-5xl mx-auto mb-8">
          <div className="flex items-center gap-4 mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-card shadow-sm border border-border">
              <Library className="h-7 w-7 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold">My List</h1>
              <p className="text-muted-foreground mt-1">Your podcasts and YouTube channels</p>
            </div>
          </div>
        </div>
        <SignInPrompt message="Sign up to see your subscriptions" />
      </div>
    );
  }

  return (
    <div className="px-4 py-8 min-h-screen bg-background">
      {/* Header */}
      <div className="max-w-5xl mx-auto mb-8">
        <div className="flex items-center gap-4 mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-card shadow-sm border border-border">
            <Library className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-bold">My List</h1>
            <p className="text-muted-foreground mt-1">
              Your podcasts and YouTube channels
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-4">
          <div className="flex items-center rounded-lg bg-card p-1 border border-border">
            <Button
              variant={activeTab === 'podcasts' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('podcasts')}
              className={cn(
                'rounded-md gap-2',
                activeTab !== 'podcasts' && 'hover:bg-secondary'
              )}
            >
              <Radio className="w-4 h-4" />
              Podcasts
              {podcasts.length > 0 && activeTab === 'podcasts' && (
                <span className="text-xs opacity-70">({podcasts.length})</span>
              )}
            </Button>
            <Button
              variant={activeTab === 'youtube' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('youtube')}
              className={cn(
                'rounded-md gap-2',
                activeTab !== 'youtube' && 'hover:bg-secondary'
              )}
            >
              <Youtube className="w-4 h-4" />
              YouTube
              {channels.length > 0 && activeTab === 'youtube' && (
                <span className="text-xs opacity-70">({channels.length})</span>
              )}
            </Button>
          </div>

          <Button
            variant="outline"
            size="icon"
            onClick={activeTab === 'podcasts' ? fetchPodcasts : fetchChannels}
            disabled={activeTab === 'podcasts' ? podcastsLoading : channelsLoading}
            className="bg-card border-border"
            aria-label="Refresh"
          >
            <RefreshCw className={cn(
              'w-4 h-4',
              (activeTab === 'podcasts' ? podcastsLoading : channelsLoading) && 'animate-spin'
            )} />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto">
        {activeTab === 'podcasts' ? (
          <PodcastsTab
            podcasts={podcasts}
            isLoading={podcastsLoading}
            error={podcastsError}
            onUnsubscribe={handleUnsubscribe}
            onRetry={fetchPodcasts}
          />
        ) : (
          <YouTubeTab
            channels={channels}
            isLoading={channelsLoading}
            error={channelsError}
            onUnfollow={handleUnfollow}
            onRetry={fetchChannels}
          />
        )}
      </div>
    </div>
  );
}

/* --- Podcasts Tab --- */
function PodcastsTab({
  podcasts,
  isLoading,
  error,
  onUnsubscribe,
  onRetry,
}: {
  podcasts: PodcastWithStatus[];
  isLoading: boolean;
  error: string | null;
  onUnsubscribe: (id: string) => void;
  onRetry: () => void;
}) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="aspect-square rounded-xl bg-secondary" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        type="podcasts"
        title="Error Loading Podcasts"
        description={error}
        secondaryActionLabel="Retry"
        onSecondaryAction={onRetry}
      />
    );
  }

  if (podcasts.length === 0) {
    return (
      <EmptyState
        type="podcasts"
        title="No subscribed podcasts"
        description="Click the heart icon on any podcast to add it to your collection."
        actionLabel="Discover Podcasts"
        onAction={() => window.location.href = '/discover'}
      />
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
      {podcasts.map((podcast) => (
        <PodcastCard
          key={podcast.id}
          podcast={podcast}
          onRemove={() => onUnsubscribe(podcast.id)}
          hasNewEpisodes={podcast.has_new_episodes}
        />
      ))}
    </div>
  );
}

/* --- YouTube Tab --- */
function YouTubeTab({
  channels,
  isLoading,
  error,
  onUnfollow,
  onRetry,
}: {
  channels: FollowedChannel[];
  isLoading: boolean;
  error: string | null;
  onUnfollow: (channel: FollowedChannel) => void;
  onRetry: () => void;
}) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="space-y-3">
            <Skeleton className="aspect-square rounded-xl bg-secondary" />
            <Skeleton className="h-4 w-3/4 bg-secondary" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        type="podcasts"
        title="Error Loading Channels"
        description={error}
        secondaryActionLabel="Retry"
        onSecondaryAction={onRetry}
      />
    );
  }

  if (channels.length === 0) {
    return (
      <EmptyState
        type="podcasts"
        title="No followed channels"
        description="Search for YouTube channels in Discover and follow them to see them here."
        actionLabel="Discover Channels"
        onAction={() => window.location.href = '/discover'}
      />
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
      {channels.map((channel) => (
        <YouTubeChannelCard
          key={channel.id}
          channel={channel}
          onUnfollow={() => onUnfollow(channel)}
        />
      ))}
    </div>
  );
}

/* --- YouTube Channel Card --- */
function YouTubeChannelCard({
  channel,
  onUnfollow,
}: {
  channel: FollowedChannel;
  onUnfollow: () => void;
}) {
  const [isUnfollowing, setIsUnfollowing] = useState(false);

  const handleUnfollow = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isUnfollowing) return;
    setIsUnfollowing(true);
    try {
      onUnfollow();
    } finally {
      setIsUnfollowing(false);
    }
  };

  return (
    <Link href={`/browse/youtube/${channel.channel_id}`} className="block h-full">
      <div className="group h-full bg-white dark:bg-[#1e202e] dark:border dark:border-white/5 rounded-2xl overflow-hidden transition-all duration-300 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] dark:shadow-none dark:hover:shadow-none hover:scale-[1.02]">
        <div className="relative aspect-square w-full bg-secondary flex items-center justify-center">
          {channel.thumbnail_url ? (
            <Image
              src={channel.thumbnail_url}
              alt={channel.channel_name}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 20vw"
            />
          ) : (
            <Youtube className="h-12 w-12 text-red-500/40" />
          )}

          {/* YouTube badge */}
          <div className="absolute top-3 left-3 bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm z-10">
            YouTube
          </div>

          {/* Unfollow Button */}
          <button
            onClick={handleUnfollow}
            disabled={isUnfollowing}
            className={cn(
              'absolute top-3 right-3 p-2 rounded-full transition-all duration-200 z-20',
              'bg-white/30 backdrop-blur-md border border-white/20 text-white shadow-sm',
              'hover:bg-white/50 hover:scale-105',
              isUnfollowing && 'opacity-50 cursor-wait'
            )}
            aria-label="Unfollow channel"
          >
            <X className="h-3.5 w-3.5 drop-shadow-sm" />
          </button>
        </div>

        <div className="p-5">
          <h3 className="font-bold text-base leading-tight tracking-tight text-foreground line-clamp-1 mb-1 group-hover:text-primary transition-colors">
            {channel.channel_name}
          </h3>

          {channel.channel_handle && (
            <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 mb-4">
              {channel.channel_handle}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}
