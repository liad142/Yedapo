'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Loader2,
  Unplug,
  Check,
  AlertTriangle,
} from 'lucide-react';
import {
  YouTubeIcon,
  TelegramIcon,
  NotionIcon,
  WhatsAppIcon,
  GmailIcon,
} from '@/components/icons/BrandIcons';
import posthog from 'posthog-js';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Toast } from '@/components/ui/toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog';
import { TelegramConnectFlow } from '@/components/insights/TelegramConnectFlow';
import { ConnectedAppCard } from '@/components/settings/sections/ConnectedAppCard';
import { cn } from '@/lib/utils';

interface NotionStatus {
  connected: boolean;
  workspaceName?: string | null;
  hasDatabase?: boolean;
}

interface ConnectionStatus {
  youtube: { connected: boolean; channelCount: number };
  telegram: { connected: boolean; username?: string };
  notion: NotionStatus;
}

export default function ConnectionsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-muted-foreground">Loading...</div>}>
      <ConnectionsPageContent />
    </Suspense>
  );
}

function ConnectionsPageContent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Action states
  const [isConnectingNotion, setIsConnectingNotion] = useState(false);
  const [isDisconnectingNotion, setIsDisconnectingNotion] = useState(false);
  const [isDisconnectingYt, setIsDisconnectingYt] = useState(false);
  const [showTelegramDialog, setShowTelegramDialog] = useState(false);
  const [showDisconnectYtDialog, setShowDisconnectYtDialog] = useState(false);

  // Email test
  const [sendingTestEmail, setSendingTestEmail] = useState(false);
  const [testEmailResult, setTestEmailResult] = useState<'sent' | 'error' | null>(null);

  // Toast
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const showToast = useCallback((message: string, durationMs: number = 3500) => {
    setToastMessage(message);
    setToastOpen(true);
    setTimeout(() => setToastOpen(false), durationMs);
  }, []);

  const fetchStatus = useCallback(async () => {
    if (!user) return;
    try {
      const [ytRes, notifRes, notionRes] = await Promise.all([
        fetch('/api/youtube/channels').then((r) => (r.ok ? r.json() : null)),
        fetch('/api/settings/notifications').then((r) => (r.ok ? r.json() : null)),
        fetch('/api/integrations/notion/status').then((r) => (r.ok ? r.json() : null)),
      ]);
      setStatus({
        youtube: {
          connected: (ytRes?.total ?? 0) > 0,
          channelCount: ytRes?.total ?? 0,
        },
        telegram: {
          connected: notifRes?.connections?.telegram?.connected ?? false,
          username: notifRes?.connections?.telegram?.username,
        },
        notion: {
          connected: notionRes?.connected ?? false,
          workspaceName:
            notionRes?.workspaceName ?? notionRes?.workspace_name ?? null,
          hasDatabase: notionRes?.hasDatabase ?? notionRes?.has_database ?? false,
        },
      });
    } catch {
      /* silent */
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) fetchStatus();
  }, [user, fetchStatus]);

  // Handle OAuth callback query params (?notion=connected | ?notion=needs_share | ?yt=connected)
  useEffect(() => {
    const notionParam = searchParams.get('notion');
    const ytParam = searchParams.get('yt');
    if (!notionParam && !ytParam) return;

    if (notionParam === 'connected') {
      showToast('Connected to Notion \u2713');
    } else if (notionParam === 'needs_share') {
      showToast('Share a Notion page with Yedapo to enable exports', 5000);
    } else if (notionParam === 'error') {
      showToast('Failed to connect Notion. Please try again.');
    }
    if (ytParam === 'connected') {
      showToast('YouTube connected. Manage channels in Notifications.');
      fetchStatus();
    }

    const url = new URL(window.location.href);
    url.searchParams.delete('notion');
    url.searchParams.delete('yt');
    router.replace(url.pathname + (url.search ? url.search : ''), { scroll: false });
  }, [searchParams, router, showToast, fetchStatus]);

  // ─── Notion handlers ───
  const handleConnectNotion = async () => {
    setIsConnectingNotion(true);
    try {
      const res = await fetch('/api/integrations/notion/authorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || 'Failed to start Notion auth');
      }
      const data = (await res.json()) as { url?: string };
      if (!data.url) throw new Error('Missing authorize URL');
      window.location.href = data.url;
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to connect Notion');
      setIsConnectingNotion(false);
    }
  };

  const handleDisconnectNotion = async () => {
    setIsDisconnectingNotion(true);
    try {
      const res = await fetch('/api/integrations/notion/disconnect', { method: 'POST' });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || 'Failed to disconnect');
      }
      showToast('Disconnected from Notion');
      await fetchStatus();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to disconnect Notion');
    } finally {
      setIsDisconnectingNotion(false);
    }
  };

  // ─── YouTube handlers ───
  const connectYouTube = async () => {
    try {
      const email = user?.email || '';
      const res = await fetch(
        `/api/youtube/connect?login_hint=${encodeURIComponent(email)}`
      );
      if (!res.ok) throw new Error('Failed to get OAuth URL');
      const { url } = await res.json();
      window.location.href = url;
    } catch {
      showToast('Could not start YouTube connection.');
    }
  };

  const handleDisconnectYouTube = async () => {
    setIsDisconnectingYt(true);
    try {
      const res = await fetch('/api/youtube/disconnect', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to disconnect YouTube');
      posthog.capture('youtube_disconnected');
      setShowDisconnectYtDialog(false);
      await fetchStatus();
      showToast('YouTube disconnected.');
    } catch {
      showToast('Failed to disconnect YouTube. Please try again.');
    } finally {
      setIsDisconnectingYt(false);
    }
  };

  // ─── Telegram handler ───
  const handleTelegramConnected = () => {
    setShowTelegramDialog(false);
    fetchStatus();
    showToast('Telegram connected \u2713');
  };

  // ─── Email test handler ───
  const handleSendTestEmail = async () => {
    setSendingTestEmail(true);
    setTestEmailResult(null);
    try {
      const res = await fetch('/api/summaries');
      if (!res.ok) throw new Error('Failed to fetch summaries');
      const data = await res.json();
      const readyEp = data.episodes?.find((e: { status: string }) => e.status === 'ready');
      const episodeId = readyEp?.id;
      if (!episodeId) throw new Error('No episodes with ready summaries found');

      const sendRes = await fetch('/api/notifications/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          episodeId,
          channel: 'email',
          recipient: user?.email,
        }),
      });
      if (!sendRes.ok) {
        const err = await sendRes.json();
        throw new Error(err.error || 'Send failed');
      }
      setTestEmailResult('sent');
    } catch {
      setTestEmailResult('error');
    } finally {
      setSendingTestEmail(false);
      setTimeout(() => setTestEmailResult(null), 5000);
    }
  };

  if (!user) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Sign in to manage connections.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {/* Email */}
        <ConnectedAppCard
          icon={<GmailIcon className="h-7 w-7" />}
          iconBgClass="bg-white dark:bg-white/95 ring-1 ring-black/5"
          title="Email"
          subtitle={user.email}
          badge={
            <span className="text-xs font-medium text-green-600 dark:text-green-400 bg-green-500/10 px-2 py-1 rounded-full">
              Verified
            </span>
          }
          action={
            <button
              onClick={handleSendTestEmail}
              disabled={sendingTestEmail}
              className={cn(
                'text-xs font-medium px-2.5 py-1 rounded-full transition-colors',
                testEmailResult === 'sent'
                  ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                  : testEmailResult === 'error'
                  ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                  : 'bg-primary/10 text-primary hover:bg-primary/15'
              )}
            >
              {sendingTestEmail ? (
                <span className="flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" /> Sending...
                </span>
              ) : testEmailResult === 'sent' ? (
                <span className="flex items-center gap-1">
                  <Check className="h-3 w-3" /> Sent!
                </span>
              ) : testEmailResult === 'error' ? (
                'Failed'
              ) : (
                'Send Test'
              )}
            </button>
          }
        />

        {/* YouTube */}
        <ConnectedAppCard
          icon={<YouTubeIcon className="h-7 w-7" />}
          iconBgClass="bg-white dark:bg-white/95 ring-1 ring-black/5"
          title="YouTube"
          statusDot={status?.youtube.connected}
          subtitle={
            status?.youtube.connected
              ? `${status.youtube.channelCount} channel${
                  status.youtube.channelCount === 1 ? '' : 's'
                } followed`
              : 'Connect your Google account to follow YouTube channels'
          }
          action={
            status?.youtube.connected ? (
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/settings/notifications">Manage</Link>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDisconnectYtDialog(true)}
                  className="gap-2 border-destructive/50 text-destructive hover:bg-destructive/10"
                >
                  <Unplug className="h-3.5 w-3.5" />
                  Disconnect
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={connectYouTube}
              >
                <YouTubeIcon className="h-4 w-4" />
                Connect
              </Button>
            )
          }
        />

        {/* Telegram */}
        <ConnectedAppCard
          icon={<TelegramIcon className="h-8 w-8" />}
          iconBgClass="bg-transparent"
          title="Telegram"
          statusDot={status?.telegram.connected}
          subtitle={
            status?.telegram.connected
              ? `Connected as ${
                  status.telegram.username
                    ? `@${status.telegram.username}`
                    : 'Telegram user'
                }`
              : 'Connect your Telegram account to receive summaries via bot'
          }
          action={
            status?.telegram.connected ? (
              <span className="text-xs font-medium text-green-600 dark:text-green-400 bg-green-500/10 px-2 py-1 rounded-full">
                Connected
              </span>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => setShowTelegramDialog(true)}
              >
                <TelegramIcon className="h-4 w-4" />
                Connect
              </Button>
            )
          }
        />

        {/* Notion */}
        <ConnectedAppCard
          icon={<NotionIcon className="h-7 w-7 text-foreground" />}
          iconBgClass="bg-white dark:bg-white/95 ring-1 ring-black/5 text-black"
          title="Notion"
          statusDot={status?.notion.connected}
          subtitle={
            status?.notion.connected
              ? status.notion.hasDatabase
                ? `Connected to ${status.notion.workspaceName || 'your workspace'}`
                : `Connected to ${
                    status.notion.workspaceName || 'workspace'
                  } \u2014 share a page to finish setup`
              : 'Connect to export summaries to Notion'
          }
          action={
            status?.notion.connected ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleDisconnectNotion}
                disabled={isDisconnectingNotion}
                className="gap-2 border-destructive/50 text-destructive hover:bg-destructive/10"
              >
                {isDisconnectingNotion ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Unplug className="h-3.5 w-3.5" />
                )}
                Disconnect
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={handleConnectNotion}
                disabled={isConnectingNotion}
                className="gap-2"
              >
                {isConnectingNotion ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <NotionIcon className="h-4 w-4 text-foreground" />
                )}
                Connect
              </Button>
            )
          }
        />

        {/* WhatsApp — coming soon */}
        <ConnectedAppCard
          icon={<WhatsAppIcon className="h-7 w-7" />}
          iconBgClass="bg-white dark:bg-white/95 ring-1 ring-black/5"
          title="WhatsApp"
          subtitle="Receive summaries via WhatsApp messages"
          disabled
          badge={
            <Badge variant="secondary" className="text-xs">
              Coming Soon
            </Badge>
          }
        />
      </div>

      {/* Telegram Connect Dialog */}
      <Dialog open={showTelegramDialog} onOpenChange={setShowTelegramDialog}>
        <DialogContent className="max-w-sm p-6">
          <DialogClose onClick={() => setShowTelegramDialog(false)} />
          <DialogHeader>
            <DialogTitle>Connect Telegram</DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            <TelegramConnectFlow onConnected={handleTelegramConnected} />
          </div>
        </DialogContent>
      </Dialog>

      {/* Disconnect YouTube Confirmation Dialog */}
      <Dialog open={showDisconnectYtDialog} onOpenChange={setShowDisconnectYtDialog}>
        <DialogContent className="max-w-sm p-6">
          <DialogClose onClick={() => setShowDisconnectYtDialog(false)} />
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Disconnect YouTube
            </DialogTitle>
          </DialogHeader>
          <div className="mt-3 space-y-4">
            <p className="text-sm text-muted-foreground">
              This will remove your Google connection and unfollow all{' '}
              {status?.youtube.channelCount ?? 0} YouTube channel
              {status?.youtube.channelCount === 1 ? '' : 's'}. Your existing summaries will
              not be affected.
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowDisconnectYtDialog(false)}
                className="flex-1"
                disabled={isDisconnectingYt}
              >
                Cancel
              </Button>
              <Button
                onClick={handleDisconnectYouTube}
                disabled={isDisconnectingYt}
                className="flex-1 bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-2"
              >
                {isDisconnectingYt ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Unplug className="h-4 w-4" />
                )}
                Disconnect
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Toast feedback */}
      <Toast open={toastOpen} onOpenChange={setToastOpen}>
        <p className="text-sm font-medium pr-6">{toastMessage}</p>
      </Toast>
    </>
  );
}
