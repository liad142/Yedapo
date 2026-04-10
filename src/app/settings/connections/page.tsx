'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Youtube,
  Send,
  Loader2,
  Unplug,
  ExternalLink,
  NotebookPen,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Toast } from '@/components/ui/toast';

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
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnectingNotion, setIsConnectingNotion] = useState(false);
  const [isDisconnectingNotion, setIsDisconnectingNotion] = useState(false);
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
        fetch('/api/integrations/notion/status').then((r) =>
          r.ok ? r.json() : null
        ),
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
          workspaceName: notionRes?.workspaceName ?? null,
          hasDatabase: notionRes?.hasDatabase ?? false,
        },
      });
    } catch {
      // silent
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) fetchStatus();
  }, [user, fetchStatus]);

  // Handle OAuth callback query params (?notion=connected | ?notion=needs_share)
  useEffect(() => {
    const notionParam = searchParams.get('notion');
    if (!notionParam) return;

    if (notionParam === 'connected') {
      showToast('Connected to Notion \u2713');
    } else if (notionParam === 'needs_share') {
      showToast(
        'Share a Notion page with Yedapo to enable exports',
        5000
      );
    } else if (notionParam === 'error') {
      showToast('Failed to connect Notion. Please try again.');
    }

    // Clean up the query param so the toast doesn't re-fire on navigation
    const url = new URL(window.location.href);
    url.searchParams.delete('notion');
    router.replace(url.pathname + (url.search ? url.search : ''), {
      scroll: false,
    });
  }, [searchParams, router, showToast]);

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
      showToast(
        err instanceof Error ? err.message : 'Failed to connect Notion'
      );
      setIsConnectingNotion(false);
    }
  };

  const handleDisconnectNotion = async () => {
    setIsDisconnectingNotion(true);
    try {
      const res = await fetch('/api/integrations/notion/disconnect', {
        method: 'POST',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || 'Failed to disconnect');
      }
      showToast('Disconnected from Notion');
      await fetchStatus();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Failed to disconnect Notion'
      );
    } finally {
      setIsDisconnectingNotion(false);
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
        {/* YouTube */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
              <Youtube className="h-6 w-6 text-red-500" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-foreground">YouTube</p>
                {status?.youtube.connected && (
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {status?.youtube.connected
                  ? `${status.youtube.channelCount} channel${status.youtube.channelCount === 1 ? '' : 's'} followed`
                  : 'Connect your Google account to follow YouTube channels'}
              </p>
            </div>
            {status?.youtube.connected ? (
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" asChild>
                  <a href="/my-list?tab=youtube">
                    Manage <ExternalLink className="h-3 w-3 ml-1" />
                  </a>
                </Button>
              </div>
            ) : (
              <Button variant="outline" size="sm" className="gap-2">
                <Youtube className="h-3.5 w-3.5" />
                Connect YouTube
              </Button>
            )}
          </div>
        </div>

        {/* Telegram */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-sky-500/10 flex items-center justify-center shrink-0">
              <Send className="h-6 w-6 text-sky-500" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-foreground">Telegram</p>
                {status?.telegram.connected && (
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {status?.telegram.connected
                  ? `Connected as ${status.telegram.username ? `@${status.telegram.username}` : 'Telegram user'}`
                  : 'Connect your Telegram account to receive summaries via bot'}
              </p>
            </div>
            {status?.telegram.connected ? (
              <Button
                variant="outline"
                size="sm"
                className="gap-2 border-destructive/50 text-destructive hover:bg-destructive/10"
              >
                <Unplug className="h-3.5 w-3.5" />
                Disconnect
              </Button>
            ) : (
              <Button variant="outline" size="sm" className="gap-2">
                <Send className="h-3.5 w-3.5" />
                Connect
              </Button>
            )}
          </div>
        </div>

        {/* Notion */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-foreground/5 dark:bg-white/10 flex items-center justify-center shrink-0">
              <NotebookPen className="h-6 w-6 text-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-foreground">Notion</p>
                {status?.notion.connected && (
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                )}
              </div>
              <p className="text-xs text-muted-foreground truncate">
                {status?.notion.connected
                  ? status.notion.hasDatabase
                    ? `Connected to ${status.notion.workspaceName || 'your workspace'}`
                    : `Connected to ${status.notion.workspaceName || 'workspace'} \u2014 share a page to finish setup`
                  : 'Connect to export summaries to Notion'}
              </p>
            </div>
            {status?.notion.connected ? (
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
                  <NotebookPen className="h-3.5 w-3.5" />
                )}
                Connect
              </Button>
            )}
          </div>
        </div>

        {/* WhatsApp — coming soon */}
        <div className="rounded-2xl border border-border bg-card p-5 opacity-60">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center shrink-0">
              <svg className="h-6 w-6 text-green-500" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                <path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.955 9.955 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">WhatsApp</p>
              <p className="text-xs text-muted-foreground">Receive summaries via WhatsApp messages</p>
            </div>
            <Badge variant="secondary" className="text-xs shrink-0">Coming Soon</Badge>
          </div>
        </div>
      </div>

      {/* Toast feedback */}
      <Toast open={toastOpen} onOpenChange={setToastOpen}>
        <p className="text-sm font-medium pr-6">{toastMessage}</p>
      </Toast>
    </>
  );
}
