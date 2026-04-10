'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import posthog from 'posthog-js';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { YouTubeImportModal } from '@/components/YouTubeImportModal';
import { FieldLabel } from './SectionLabel';

interface FollowedChannel {
  id: string;
  channelId: string;
  channelName: string;
  thumbnailUrl: string;
}

interface ImportChannel {
  channelId: string;
  title: string;
  description: string;
  thumbnailUrl: string;
}

interface YouTubeChannelsSectionProps {
  onError?: (message: string) => void;
}

/**
 * Followed YouTube channels list with import/add-more flow.
 * Lives in /settings/notifications (alongside podcast notification subscriptions).
 * NOTE: Disconnect is handled in /settings/connections (single source of truth).
 */
export function YouTubeChannelsSection({ onError }: YouTubeChannelsSectionProps) {
  const { user } = useAuth();
  const isGoogleUser = user?.app_metadata?.provider === 'google';

  const [followedChannels, setFollowedChannels] = useState<FollowedChannel[]>([]);
  const [isLoadingFollowed, setIsLoadingFollowed] = useState(false);
  const [unfollowingId, setUnfollowingId] = useState<string | null>(null);

  const [ytChannels, setYtChannels] = useState<ImportChannel[]>([]);
  const [isLoadingYt, setIsLoadingYt] = useState(false);
  const [ytNeedsPermission, setYtNeedsPermission] = useState(false);
  const [isImportingYt, setIsImportingYt] = useState(false);
  const [showYtImportModal, setShowYtImportModal] = useState(false);
  const [showYtConnectDialog, setShowYtConnectDialog] = useState(false);

  const fetchFollowedChannels = useCallback(async () => {
    setIsLoadingFollowed(true);
    try {
      const res = await fetch('/api/youtube/channels');
      if (!res.ok) return;
      const data = await res.json();
      const channels: FollowedChannel[] = (data.channels || [])
        .map((ch: Record<string, unknown>) => ({
          id: String(ch.id ?? ''),
          channelId: String(ch.channel_id ?? ch.channelId ?? ''),
          channelName: String(ch.channel_name ?? ch.channelName ?? ''),
          thumbnailUrl: String(ch.thumbnail_url ?? ch.thumbnailUrl ?? ''),
        }))
        .sort((a: FollowedChannel, b: FollowedChannel) =>
          a.channelName.localeCompare(b.channelName)
        );
      setFollowedChannels(channels);
    } catch {
      /* ignore */
    } finally {
      setIsLoadingFollowed(false);
    }
  }, []);

  useEffect(() => {
    if (user) fetchFollowedChannels();
  }, [user, fetchFollowedChannels]);

  const fetchYouTubeChannels = async (): Promise<
    'ok' | 'needsPermission' | 'empty' | 'error'
  > => {
    setIsLoadingYt(true);
    setYtNeedsPermission(false);
    try {
      const res = await fetch('/api/youtube/subscriptions');
      if (!res.ok) throw new Error('Failed to fetch YouTube subscriptions');
      const data = await res.json();

      if (data.needsPermission) {
        setYtNeedsPermission(true);
        return 'needsPermission';
      }

      const subs: ImportChannel[] = data.subscriptions || [];
      setYtChannels(subs);
      if (subs.length > 0) {
        setShowYtImportModal(true);
        return 'ok';
      }
      return 'empty';
    } catch {
      onError?.('Could not load YouTube subscriptions.');
      return 'error';
    } finally {
      setIsLoadingYt(false);
    }
  };

  const connectYouTube = async () => {
    try {
      const email = user?.email || '';
      const res = await fetch(`/api/youtube/connect?login_hint=${encodeURIComponent(email)}`);
      if (!res.ok) throw new Error('Failed to get OAuth URL');
      const { url } = await res.json();
      window.location.href = url;
    } catch {
      onError?.('Could not start YouTube connection.');
    }
  };

  // Auto-fetch YouTube channels after returning from OAuth
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('yt') === 'connected') {
      window.history.replaceState({}, '', window.location.pathname);
      fetchYouTubeChannels();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleModalImport = async (selectedChannelIds: string[]) => {
    setIsImportingYt(true);
    try {
      const channelsToImport = ytChannels.filter((ch) =>
        selectedChannelIds.includes(ch.channelId)
      );
      const res = await fetch('/api/youtube/subscriptions/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channels: channelsToImport }),
      });
      if (!res.ok) throw new Error('Failed to import YouTube channels');
      posthog.capture('settings_youtube_imported', { count: channelsToImport.length });
      setShowYtImportModal(false);
      fetchFollowedChannels();
    } catch {
      onError?.('Failed to import YouTube channels. Please try again.');
    } finally {
      setIsImportingYt(false);
    }
  };

  const handleUnfollow = async (dbId: string) => {
    setUnfollowingId(dbId);
    try {
      const res = await fetch(`/api/youtube/channels/${dbId}/unfollow`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setFollowedChannels((prev) => prev.filter((ch) => ch.id !== dbId));
      }
    } catch {
      /* ignore */
    } finally {
      setUnfollowingId(null);
    }
  };

  const handleAddMore = async () => {
    const result = await fetchYouTubeChannels();
    if (result === 'needsPermission') {
      setShowYtConnectDialog(true);
    } else if (result === 'empty') {
      onError?.('No new YouTube subscriptions found. All channels may already be imported.');
    }
  };

  return (
    <>
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/youtube-logo.svg" alt="YouTube" className="h-4 w-auto" />
            <FieldLabel>YouTube Channels</FieldLabel>
            {followedChannels.length > 0 && (
              <span className="text-xs text-muted-foreground bg-secondary px-1.5 py-0.5 rounded-full">
                {followedChannels.length}
              </span>
            )}
          </div>
          {followedChannels.length > 0 && (
            <Button
              onClick={handleAddMore}
              variant="ghost"
              size="sm"
              className="text-xs text-primary h-7 px-2"
            >
              + Add More
            </Button>
          )}
        </div>

        {followedChannels.length > 0 && (
          <div className="rounded-2xl bg-card border border-border overflow-hidden">
            <div className="max-h-[280px] overflow-y-auto divide-y divide-border">
              {followedChannels.map((ch) => (
                <div
                  key={ch.id}
                  className="flex items-center gap-3 px-4 py-2.5 group"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={ch.thumbnailUrl ? ch.thumbnailUrl.replace(/=s\d+/, '=s176') : undefined}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="w-7 h-7 rounded-full object-cover shrink-0 bg-secondary"
                  />
                  <span className="text-sm text-foreground truncate flex-1">
                    {ch.channelName}
                  </span>
                  <button
                    onClick={() => handleUnfollow(ch.id)}
                    disabled={unfollowingId === ch.id}
                    className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all shrink-0"
                    title={`Unfollow ${ch.channelName}`}
                  >
                    {unfollowingId === ch.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <X className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {isLoadingFollowed && followedChannels.length === 0 && (
          <div className="flex items-center gap-2 text-muted-foreground text-sm p-4 rounded-2xl bg-card border border-border">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading channels...
          </div>
        )}

        {!isLoadingFollowed && followedChannels.length === 0 && (
          <div className="p-4 rounded-2xl bg-card border border-border">
            <p className="text-sm text-muted-foreground mb-3">
              {ytNeedsPermission || !isGoogleUser
                ? 'Connect your Google account to import YouTube subscriptions and get insights from videos.'
                : 'Import your YouTube subscriptions to follow channels and get insights from their videos.'}
            </p>
            <Button
              onClick={
                ytNeedsPermission || !isGoogleUser
                  ? () => setShowYtConnectDialog(true)
                  : handleAddMore
              }
              variant="outline"
              className="gap-2"
              disabled={isLoadingYt}
            >
              {isLoadingYt ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading...
                </>
              ) : (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/youtube-logo.svg" alt="" className="h-3.5 w-auto" />
                  {ytNeedsPermission || !isGoogleUser
                    ? 'Connect YouTube'
                    : 'Import from YouTube'}
                </>
              )}
            </Button>
          </div>
        )}
      </div>

      {/* YouTube Import Modal */}
      {showYtImportModal && ytChannels.length > 0 && (
        <YouTubeImportModal
          channels={ytChannels}
          onImport={handleModalImport}
          onClose={() => setShowYtImportModal(false)}
          isImporting={isImportingYt}
        />
      )}

      {/* YouTube Connect Dialog */}
      <AnimatePresence>
        {showYtConnectDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setShowYtConnectDialog(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative z-10 w-full max-w-sm bg-background border border-border rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 text-center space-y-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/youtube-logo.svg"
                  alt="YouTube"
                  className="h-8 w-auto mx-auto"
                />
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Connect YouTube</h3>
                  <p className="text-sm text-muted-foreground mt-1.5">
                    A small window will open to grant Yedapo read-only access to your YouTube
                    subscriptions. We only see which channels you follow — nothing else.
                  </p>
                </div>
                <div className="flex flex-col gap-2 pt-1">
                  <Button
                    onClick={() => {
                      setShowYtConnectDialog(false);
                      connectYouTube();
                    }}
                    className="w-full"
                  >
                    Continue
                  </Button>
                  <button
                    onClick={() => setShowYtConnectDialog(false)}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors py-1.5 cursor-pointer"
                  >
                    Maybe later
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
