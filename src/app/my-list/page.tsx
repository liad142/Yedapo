'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Library, Youtube, Radio, RefreshCw, X, UserMinus, Undo2 } from 'lucide-react';
import { YouTubeLogoStatic } from '@/components/YouTubeLogo';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PodcastCard } from '@/components/PodcastCard';
import { EmptyState } from '@/components/EmptyState';
import { SignInPrompt } from '@/components/auth/SignInPrompt';
import { Toast } from '@/components/ui/toast';
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
  apple_id: string | null;
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
  return (
    <Suspense fallback={null}>
      <MyListContent />
    </Suspense>
  );
}

function MyListContent() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Persist active tab in URL
  const tabFromUrl = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<ListTab>(
    tabFromUrl === 'youtube' ? 'youtube' : 'podcasts'
  );

  const handleSetTab = (tab: ListTab) => {
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', tab);
    router.replace(`?${params.toString()}`, { scroll: false });
  };

  // Podcasts state
  const [podcasts, setPodcasts] = useState<PodcastWithStatus[]>([]);
  const [podcastsLoading, setPodcastsLoading] = useState(true);
  const [podcastsError, setPodcastsError] = useState<string | null>(null);

  // YouTube channels state
  const [channels, setChannels] = useState<FollowedChannel[]>([]);
  const [channelsLoading, setChannelsLoading] = useState(true);
  const [channelsError, setChannelsError] = useState<string | null>(null);

  // Undo state for soft-delete
  const [pendingPodcastRemoval, setPendingPodcastRemoval] = useState<{ id: string; item: PodcastWithStatus } | null>(null);
  const [pendingChannelRemoval, setPendingChannelRemoval] = useState<{ id: string; item: FollowedChannel } | null>(null);
  const podcastUndoTimerRef = useRef<NodeJS.Timeout | null>(null);
  const channelUndoTimerRef = useRef<NodeJS.Timeout | null>(null);

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

  const handleUnsubscribe = (podcastId: string) => {
    const item = podcasts.find(p => p.id === podcastId);
    if (!item) return;

    // Clear any existing timer
    if (podcastUndoTimerRef.current) clearTimeout(podcastUndoTimerRef.current);

    // Optimistically remove from list
    setPodcasts(prev => prev.filter(p => p.id !== podcastId));
    setPendingPodcastRemoval({ id: podcastId, item });

    // After 5 seconds, actually perform the deletion
    podcastUndoTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/subscriptions/${podcastId}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Failed to unsubscribe');
      } catch (err) {
        console.error('Error unsubscribing:', err);
        // Restore on failure
        setPodcasts(prev => [...prev, item]);
      }
      setPendingPodcastRemoval(null);
    }, 5000);
  };

  const undoPodcastRemoval = () => {
    if (!pendingPodcastRemoval) return;
    if (podcastUndoTimerRef.current) clearTimeout(podcastUndoTimerRef.current);
    setPodcasts(prev => [...prev, pendingPodcastRemoval.item]);
    setPendingPodcastRemoval(null);
  };

  const handleUnfollow = (channel: FollowedChannel) => {
    // Clear any existing timer
    if (channelUndoTimerRef.current) clearTimeout(channelUndoTimerRef.current);

    // Optimistically remove from list
    setChannels(prev => prev.filter(c => c.id !== channel.id));
    setPendingChannelRemoval({ id: channel.id, item: channel });

    // After 5 seconds, actually perform the deletion
    channelUndoTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/youtube/channels/${channel.id}/unfollow`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Failed to unfollow');
      } catch (err) {
        console.error('Error unfollowing:', err);
        // Restore on failure
        setChannels(prev => [...prev, channel]);
      }
      setPendingChannelRemoval(null);
    }, 5000);
  };

  const undoChannelRemoval = () => {
    if (!pendingChannelRemoval) return;
    if (channelUndoTimerRef.current) clearTimeout(channelUndoTimerRef.current);
    setChannels(prev => [...prev, pendingChannelRemoval.item]);
    setPendingChannelRemoval(null);
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
              <h1 className="text-h1 md:text-display">My List</h1>
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
            <h1 className="text-h1 md:text-display">My List</h1>
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
              onClick={() => handleSetTab('podcasts')}
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
              onClick={() => handleSetTab('youtube')}
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

      {/* Undo Toast for podcast removal */}
      <Toast open={!!pendingPodcastRemoval} onOpenChange={() => setPendingPodcastRemoval(null)} position="bottom">
        <div className="flex items-center gap-3 pr-6">
          <p className="text-sm font-medium text-foreground">
            Removed &ldquo;{pendingPodcastRemoval?.item.title}&rdquo;
          </p>
          <Button variant="outline" size="sm" onClick={undoPodcastRemoval} className="gap-1.5 shrink-0">
            <Undo2 className="h-3.5 w-3.5" />
            Undo
          </Button>
        </div>
      </Toast>

      {/* Undo Toast for channel removal */}
      <Toast open={!!pendingChannelRemoval} onOpenChange={() => setPendingChannelRemoval(null)} position="bottom">
        <div className="flex items-center gap-3 pr-6">
          <p className="text-sm font-medium text-foreground">
            Removed &ldquo;{pendingChannelRemoval?.item.channel_name}&rdquo;
          </p>
          <Button variant="outline" size="sm" onClick={undoChannelRemoval} className="gap-1.5 shrink-0">
            <Undo2 className="h-3.5 w-3.5" />
            Undo
          </Button>
        </div>
      </Toast>
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
      <div className="group h-full bg-card dark:border dark:border-white/5 rounded-2xl overflow-hidden transition-all duration-300 shadow-sm hover:shadow-md dark:shadow-none dark:hover:shadow-none hover:scale-[1.02]">
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

          {/* YouTube logo */}
          <div className="absolute top-3 left-3 bg-white/80 dark:bg-black/60 backdrop-blur-sm rounded-md px-1.5 py-0.5 z-10">
            <YouTubeLogoStatic size="xs" />
          </div>

          {/* Unfollow Button */}
          <button
            onClick={handleUnfollow}
            disabled={isUnfollowing}
            className={cn(
              'absolute top-3 right-3 p-1.5 rounded-full transition-all duration-200 z-20',
              'bg-black/60 backdrop-blur-sm text-white',
              'md:opacity-0 md:group-hover:opacity-100',
              'hover:bg-black/80',
              isUnfollowing && '!opacity-100 cursor-wait'
            )}
            aria-label="Unfollow channel"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="p-5">
          <h3 className="text-h4 leading-tight tracking-tight text-foreground line-clamp-1 mb-1 group-hover:text-primary transition-colors">
            {channel.channel_name}
          </h3>

          {channel.channel_handle && (
            <p className="text-xs text-muted-foreground line-clamp-1 mb-4">
              {channel.channel_handle}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}
