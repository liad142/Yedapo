'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Moon, Sun, Monitor, LogIn, LogOut, Loader2, Pencil, Check, X, Shield, ChevronDown, Search,
  Palette, Briefcase, Smile, GraduationCap, BookOpen, Landmark, Clock, Heart,
  Users, Music, Newspaper, Church, FlaskConical, Globe, Trophy, Cpu, Film,
  Youtube, RefreshCw, Mail, Send, Bell, BellOff, Trash2, Unplug, AlertTriangle, Headphones, MessageCircle, Smartphone,
} from 'lucide-react';
import { Search as SearchIcon } from 'lucide-react';
import Link from 'next/link';
import posthog from 'posthog-js';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useCountry } from '@/contexts/CountryContext';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { APPLE_PODCAST_GENRES, APPLE_PODCAST_COUNTRIES } from '@/types/apple-podcasts';
import { Toast } from '@/components/ui/toast';
import { useUsage } from '@/contexts/UsageContext';
import { UsageMeter } from '@/components/UsageMeter';
import { PLAN_META } from '@/lib/plans';
import type { UserPlan } from '@/lib/plans';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { YouTubeChannelCard } from '@/components/onboarding/YouTubeChannelCard';
import { YouTubeImportModal } from '@/components/YouTubeImportModal';
import { TelegramConnectFlow } from '@/components/insights/TelegramConnectFlow';
import { DeliveryPreferences } from '@/components/settings/DeliveryPreferences';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog';

// ── Compact genre icon map ──
const GENRE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  '1301': Palette, '1321': Briefcase, '1303': Smile, '1304': GraduationCap,
  '1483': BookOpen, '1511': Landmark, '1512': Clock, '1305': Heart,
  '1307': Users, '1309': Music, '1489': Newspaper, '1314': Church,
  '1533': FlaskConical, '1324': Globe, '1545': Trophy, '1318': Cpu,
  '1481': Search, '1310': Film,
};

// ── Flag image via flagcdn.com (works on Windows, no emoji needed) ──
// flagcdn.com supported sizes: 16x12, 20x15, 24x18, 28x21, 32x24, 40x30, 48x36, 56x42, 64x48, 80x60
const FLAG_SIZES = [
  [16,12],[20,15],[24,18],[28,21],[32,24],[40,30],[48,36],[56,42],[64,48],[80,60],
] as const;

function flagUrl(code: string, targetW: number) {
  const match = FLAG_SIZES.find(([w]) => w >= targetW) || FLAG_SIZES[FLAG_SIZES.length - 1];
  return { url: `https://flagcdn.com/${match[0]}x${match[1]}/${code}.png`, w: match[0], h: match[1] };
}

function FlagImg({ code, size = 20 }: { code: string; size?: number }) {
  const x1 = flagUrl(code, size);
  const x2 = flagUrl(code, size * 2);
  return (
    <img
      src={x1.url}
      srcSet={`${x2.url} 2x`}
      width={size}
      height={Math.round(size * 0.75)}
      alt=""
      className="inline-block rounded-sm object-cover"
      style={{ minWidth: size }}
    />
  );
}

interface UserProfile {
  display_name: string | null;
  preferred_genres: string[];
  preferred_country: string;
  onboarding_completed: boolean;
}

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { user, isLoading: authLoading, signOut, setShowAuthModal } = useAuth();
  const { setCountry } = useCountry();
  const { usage } = useUsage();
  const isAdmin = useIsAdmin();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [isSavingName, setIsSavingName] = useState(false);
  const [isSavingGenres, setIsSavingGenres] = useState(false);

  const [selectedGenres, setSelectedGenres] = useState<Set<string>>(new Set());
  const [genresDirty, setGenresDirty] = useState(false);

  const [countryOpen, setCountryOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const countryRef = useRef<HTMLDivElement>(null);
  const [errorToast, setErrorToast] = useState<string | null>(null);

  // YouTube import state
  const [ytChannels, setYtChannels] = useState<{ channelId: string; title: string; description: string; thumbnailUrl: string }[]>([]);
  const [selectedYtChannels, setSelectedYtChannels] = useState<Set<string>>(new Set());
  const [isLoadingYt, setIsLoadingYt] = useState(false);
  const [ytFetched, setYtFetched] = useState(false);
  const [isImportingYt, setIsImportingYt] = useState(false);
  const [ytImportDone, setYtImportDone] = useState(false);
  const [ytNeedsPermission, setYtNeedsPermission] = useState(false);
  const [showYtConnectDialog, setShowYtConnectDialog] = useState(false);
  const [showYtImportModal, setShowYtImportModal] = useState(false);
  const [followedChannels, setFollowedChannels] = useState<{ id: string; channelId: string; channelName: string; thumbnailUrl: string }[]>([]);
  const [isLoadingFollowed, setIsLoadingFollowed] = useState(false);
  const [unfollowingId, setUnfollowingId] = useState<string | null>(null);
  const isGoogleUser = user?.app_metadata?.provider === 'google';

  // Connected apps & notifications state
  interface NotificationSub {
    podcastId: string;
    podcastTitle: string;
    podcastArtwork: string | null;
    type?: 'podcast' | 'youtube';
    notifyEnabled: boolean;
    notifyChannels: string[];
  }
  const [notifConnections, setNotifConnections] = useState<{
    email: { address: string | null; verified: boolean };
    telegram: { connected: boolean; username: string | null };
  } | null>(null);
  const [notifSubs, setNotifSubs] = useState<NotificationSub[]>([]);
  const [isLoadingNotifs, setIsLoadingNotifs] = useState(false);
  const [showTelegramDialog, setShowTelegramDialog] = useState(false);
  const [togglingNotif, setTogglingNotif] = useState<string | null>(null);
  const [notifTab, setNotifTab] = useState<'podcasts' | 'youtube'>('podcasts');
  const [notifSearch, setNotifSearch] = useState('');
  const [isBulkToggling, setIsBulkToggling] = useState(false);
  const [channelOverrideOpen, setChannelOverrideOpen] = useState<string | null>(null);
  const channelPopoverRef = useRef<HTMLDivElement>(null);
  const [sendingTestEmail, setSendingTestEmail] = useState(false);
  const [testEmailResult, setTestEmailResult] = useState<'sent' | 'error' | null>(null);

  // Account deletion & YouTube disconnect state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [isDisconnectingYt, setIsDisconnectingYt] = useState(false);
  const [showDisconnectYtDialog, setShowDisconnectYtDialog] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    setIsLoadingNotifs(true);
    try {
      const res = await fetch('/api/settings/notifications');
      if (res.ok) {
        const data = await res.json();
        setNotifConnections(data.connections);
        setNotifSubs(data.subscriptions || []);
      }
    } catch {
      // silent
    } finally {
      setIsLoadingNotifs(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) fetchNotifications();
  }, [user, fetchNotifications]);

  const handleToggleNotification = async (sub: NotificationSub) => {
    setTogglingNotif(sub.podcastId);
    try {
      const url = sub.type === 'youtube'
        ? `/api/youtube/channels/${sub.podcastId}/notifications`
        : `/api/subscriptions/${sub.podcastId}`;
      const body = sub.type === 'youtube'
        ? { notifyEnabled: !sub.notifyEnabled }
        : { notifyEnabled: !sub.notifyEnabled, updateLastViewed: false };
      await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      // Refresh the full list to reflect the change
      await fetchNotifications();
    } catch {
      setErrorToast('Failed to update notification preference.');
    } finally {
      setTogglingNotif(null);
    }
  };

  const podcastSubs = notifSubs.filter(s => s.type !== 'youtube');
  const youtubeSubs = notifSubs.filter(s => s.type === 'youtube');
  const activeTabSubs = notifTab === 'youtube' ? youtubeSubs : podcastSubs;
  const filteredNotifSubs = notifSearch
    ? activeTabSubs.filter(s => s.podcastTitle.toLowerCase().includes(notifSearch.toLowerCase()))
    : activeTabSubs;
  const allEnabledInTab = activeTabSubs.length > 0 && activeTabSubs.every(s => s.notifyEnabled);

  const handleBulkToggle = async () => {
    const newEnabled = !allEnabledInTab;
    setIsBulkToggling(true);
    try {
      await Promise.allSettled(
        activeTabSubs
          .filter(s => s.notifyEnabled !== newEnabled)
          .map(sub => {
            const url = sub.type === 'youtube'
              ? `/api/youtube/channels/${sub.podcastId}/notifications`
              : `/api/subscriptions/${sub.podcastId}`;
            const body = sub.type === 'youtube'
              ? { notifyEnabled: newEnabled }
              : { notifyEnabled: newEnabled, updateLastViewed: false };
            return fetch(url, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body),
            });
          })
      );
      await fetchNotifications();
    } catch {
      setErrorToast('Failed to update notification preferences.');
    } finally {
      setIsBulkToggling(false);
    }
  };

  const handleSendTestEmail = async () => {
    setSendingTestEmail(true);
    setTestEmailResult(null);
    try {
      // Find a recent episode with a ready summary
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

  const CHANNEL_OPTIONS: readonly { id: string; label: string; icon: typeof Smartphone; comingSoon?: boolean }[] = [
    { id: 'in_app', label: 'In-app', icon: Smartphone },
    { id: 'email', label: 'Email', icon: Mail },
    { id: 'telegram', label: 'Telegram', icon: Send },
    { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, comingSoon: true },
  ];

  const hasTelegram = notifConnections?.telegram.connected ?? false;

  const handleToggleSubChannel = async (sub: NotificationSub, channelId: string) => {
    const currentChannels = sub.notifyChannels.length > 0 ? sub.notifyChannels : ['in_app'];
    const newChannels = currentChannels.includes(channelId)
      ? currentChannels.filter(c => c !== channelId)
      : [...currentChannels, channelId];

    // Don't allow empty channels — at least in_app must stay
    if (newChannels.length === 0) return;

    // Optimistic update
    setNotifSubs(prev => prev.map(s =>
      s.podcastId === sub.podcastId
        ? { ...s, notifyChannels: newChannels, notifyEnabled: true }
        : s
    ));

    try {
      const url = sub.type === 'youtube'
        ? `/api/youtube/channels/${sub.podcastId}/notifications`
        : `/api/subscriptions/${sub.podcastId}`;
      const body = sub.type === 'youtube'
        ? { notifyEnabled: true, notifyChannels: newChannels }
        : { notifyEnabled: true, notifyChannels: newChannels, updateLastViewed: false };
      await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch {
      // Revert on error
      await fetchNotifications();
      setErrorToast('Failed to update notification channels.');
    }
  };

  const handleSetDefaultChannels = async (channels: string[]) => {
    if (channels.length === 0) return;
    setIsBulkToggling(true);
    try {
      await Promise.allSettled(
        activeTabSubs.map(sub => {
          const url = sub.type === 'youtube'
            ? `/api/youtube/channels/${sub.podcastId}/notifications`
            : `/api/subscriptions/${sub.podcastId}`;
          const body = sub.type === 'youtube'
            ? { notifyEnabled: true, notifyChannels: channels }
            : { notifyEnabled: true, notifyChannels: channels, updateLastViewed: false };
          return fetch(url, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });
        })
      );
      await fetchNotifications();
    } catch {
      setErrorToast('Failed to apply default channels.');
    } finally {
      setIsBulkToggling(false);
    }
  };

  // Close channel popover on outside click
  useEffect(() => {
    if (!channelOverrideOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (channelPopoverRef.current && !channelPopoverRef.current.contains(e.target as Node)) {
        setChannelOverrideOpen(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [channelOverrideOpen]);

  // Compute most common channels in tab (for "default" chips)
  const tabDefaultChannels = (() => {
    const enabledSubs = activeTabSubs.filter(s => s.notifyEnabled && s.notifyChannels.length > 0);
    if (enabledSubs.length === 0) return ['in_app'];
    const counts: Record<string, number> = {};
    enabledSubs.forEach(s => s.notifyChannels.forEach(ch => { counts[ch] = (counts[ch] || 0) + 1; }));
    // Channels used by majority of enabled subs
    const threshold = enabledSubs.length / 2;
    const common = Object.entries(counts).filter(([, c]) => c > threshold).map(([ch]) => ch);
    return common.length > 0 ? common : ['in_app'];
  })();

  const handleTelegramConnected = () => {
    setShowTelegramDialog(false);
    setNotifConnections(prev => prev ? { ...prev, telegram: { connected: true, username: null } } : prev);
    fetchNotifications(); // Refresh to get username
  };

  const themeOptions = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'System', icon: Monitor },
  ] as const;

  useEffect(() => {
    if (!user) { setProfile(null); return; }
    const fetch_ = async () => {
      setIsLoadingProfile(true);
      try {
        const res = await fetch('/api/user/profile');
        if (!res.ok) throw new Error('Failed to load profile');
        const data = await res.json();
        setProfile(data.profile);
        setSelectedGenres(new Set(data.profile?.preferred_genres || []));
      } catch {
        setErrorToast('Failed to load profile.');
      } finally { setIsLoadingProfile(false); }
    };
    fetch_();
  }, [user]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (countryRef.current && !countryRef.current.contains(e.target as Node)) {
        setCountryOpen(false);
        setCountrySearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSaveName = async () => {
    if (!nameInput.trim()) return;
    setIsSavingName(true);
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ display_name: nameInput.trim() }),
      });
      if (res.ok) { const d = await res.json(); setProfile(d.profile); setEditingName(false); posthog.capture('profile_updated', { field: 'display_name' }); }
    } finally { setIsSavingName(false); }
  };

  const handleSaveGenres = async () => {
    setIsSavingGenres(true);
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferred_genres: Array.from(selectedGenres) }),
      });
      if (res.ok) { const d = await res.json(); setProfile(d.profile); setGenresDirty(false); posthog.capture('profile_updated', { field: 'genres', genre_count: selectedGenres.size }); }
    } finally { setIsSavingGenres(false); }
  };

  const toggleGenre = (id: string) => {
    setSelectedGenres(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    setGenresDirty(true);
  };

  const handleSaveCountry = async (code: string) => {
    setCountryOpen(false);
    setCountrySearch('');
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferred_country: code }),
      });
      if (res.ok) {
        const d = await res.json();
        setProfile(d.profile);
        setCountry(code.toUpperCase());
        posthog.capture('profile_updated', { field: 'country', country_code: code });
      }
    } catch {
      setErrorToast('Failed to save country preference. Please try again.');
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
      setErrorToast('Could not start YouTube connection.');
    }
  };

  // Auto-fetch YouTube channels after returning from OAuth
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('yt') === 'connected') {
      // Clean up the URL
      window.history.replaceState({}, '', '/settings');
      fetchYouTubeChannels();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchYouTubeChannels = async (): Promise<'ok' | 'needsPermission' | 'empty' | 'error'> => {
    setIsLoadingYt(true);
    setYtFetched(false);
    setYtImportDone(false);
    setYtNeedsPermission(false);
    try {
      const res = await fetch('/api/youtube/subscriptions');
      if (!res.ok) throw new Error('Failed to fetch YouTube subscriptions');
      const data = await res.json();

      if (data.needsPermission) {
        setYtNeedsPermission(true);
        setIsLoadingYt(false);
        setYtFetched(true);
        return 'needsPermission';
      }

      const subs: { channelId: string; title: string; description: string; thumbnailUrl: string }[] = data.subscriptions || [];
      setYtChannels(subs);
      setSelectedYtChannels(new Set(subs.map(ch => ch.channelId)));
      if (subs.length > 0) {
        setShowYtImportModal(true);
        return 'ok';
      }
      return 'empty';
    } catch {
      setErrorToast('Could not load YouTube subscriptions.');
      return 'error';
    } finally {
      setIsLoadingYt(false);
      setYtFetched(true);
    }
  };

  const handleModalImport = async (selectedChannelIds: string[]) => {
    setIsImportingYt(true);
    try {
      const channelsToImport = ytChannels.filter(ch => selectedChannelIds.includes(ch.channelId));
      const res = await fetch('/api/youtube/subscriptions/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channels: channelsToImport }),
      });
      if (!res.ok) throw new Error('Failed to import YouTube channels');
      posthog.capture('settings_youtube_imported', { count: channelsToImport.length });
      setYtImportDone(true);
      setShowYtImportModal(false);
      fetchFollowedChannels();
    } catch {
      setErrorToast('Failed to import YouTube channels. Please try again.');
    } finally {
      setIsImportingYt(false);
    }
  };

  const handleImportYouTube = async () => {
    setIsImportingYt(true);
    try {
      const channelsToImport = ytChannels.filter(ch => selectedYtChannels.has(ch.channelId));
      const res = await fetch('/api/youtube/subscriptions/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channels: channelsToImport }),
      });
      if (!res.ok) throw new Error('Failed to import YouTube channels');
      posthog.capture('settings_youtube_imported', { count: channelsToImport.length });
      setYtImportDone(true);
    } catch {
      setErrorToast('Failed to import YouTube channels. Please try again.');
    } finally {
      setIsImportingYt(false);
    }
  };

  const toggleYtChannel = (channelId: string) => {
    setSelectedYtChannels(prev => {
      const next = new Set(prev);
      if (next.has(channelId)) next.delete(channelId); else next.add(channelId);
      return next;
    });
  };

  const fetchFollowedChannels = useCallback(async () => {
    setIsLoadingFollowed(true);
    try {
      const res = await fetch('/api/youtube/channels');
      if (!res.ok) return;
      const data = await res.json();
      const channels = (data.channels || [])
        .map((ch: any) => ({
          id: ch.id,
          channelId: ch.channel_id || ch.channelId,
          channelName: ch.channel_name || ch.channelName || '',
          thumbnailUrl: ch.thumbnail_url || ch.thumbnailUrl || '',
        }))
        .sort((a: any, b: any) => a.channelName.localeCompare(b.channelName));
      setFollowedChannels(channels);
    } catch { /* ignore */ }
    finally { setIsLoadingFollowed(false); }
  }, []);

  // Fetch followed channels on mount
  useEffect(() => {
    if (user) fetchFollowedChannels();
  }, [user, fetchFollowedChannels]);

  const handleUnfollow = async (dbId: string) => {
    setUnfollowingId(dbId);
    try {
      const res = await fetch(`/api/youtube/channels/${dbId}/unfollow`, { method: 'DELETE' });
      if (res.ok) {
        setFollowedChannels(prev => prev.filter(ch => ch.id !== dbId));
      }
    } catch { /* ignore */ }
    finally { setUnfollowingId(null); }
  };

  const handleAddMore = async () => {
    const result = await fetchYouTubeChannels();
    if (result === 'needsPermission') {
      setShowYtConnectDialog(true);
    } else if (result === 'empty') {
      setErrorToast('No new YouTube subscriptions found. All channels may already be imported.');
    }
  };

  const handleDisconnectYouTube = async () => {
    setIsDisconnectingYt(true);
    try {
      const res = await fetch('/api/youtube/disconnect', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to disconnect YouTube');
      posthog.capture('youtube_disconnected');
      setFollowedChannels([]);
      setYtChannels([]);
      setYtFetched(false);
      setYtImportDone(false);
      setYtNeedsPermission(false);
      setShowDisconnectYtDialog(false);
    } catch {
      setErrorToast('Failed to disconnect YouTube. Please try again.');
    } finally {
      setIsDisconnectingYt(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') return;
    setIsDeletingAccount(true);
    try {
      const res = await fetch('/api/user/account', { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to delete account');
      }
      posthog.capture('account_deleted');
      await signOut();
    } catch (err: any) {
      setErrorToast(err.message || 'Failed to delete account. Please try again.');
    } finally {
      setIsDeletingAccount(false);
      setShowDeleteDialog(false);
      setDeleteConfirmText('');
    }
  };

  const displayName = profile?.display_name
    || user?.user_metadata?.display_name
    || user?.user_metadata?.full_name
    || user?.email?.split('@')[0]
    || '';

  const currentCountry = APPLE_PODCAST_COUNTRIES.find(
    c => c.code === (profile?.preferred_country || 'us')
  );

  const filteredCountries = APPLE_PODCAST_COUNTRIES.filter(c =>
    c.name.toLowerCase().includes(countrySearch.toLowerCase())
  );

  const initials = (displayName || '?').slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="max-w-2xl mx-auto px-3 sm:px-4 pt-6 sm:pt-8 space-y-6 sm:space-y-8">

        <div>
          <h1 className="text-h2 sm:text-h1 text-foreground tracking-tight">Settings</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-0.5 sm:mt-1">Manage your account and preferences</p>
        </div>

        {/* ── APPEARANCE ── */}
        <section>
          <SectionLabel>Appearance</SectionLabel>
          <div className="grid grid-cols-3 gap-3 mt-3">
            {themeOptions.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => { setTheme(value); posthog.capture('theme_changed', { theme: value }); }}
                className={cn(
                  'relative flex flex-col items-center gap-2.5 p-4 rounded-2xl border-2 transition-all duration-200',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
                  theme === value
                    ? 'border-primary bg-primary/8 shadow-sm'
                    : 'border-border bg-card hover:border-border/80 hover:bg-accent/50'
                )}
              >
                {theme === value && (
                  <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-primary" />
                )}
                <div className={cn(
                  'w-10 h-10 rounded-xl flex items-center justify-center',
                  theme === value ? 'bg-primary/15' : 'bg-muted'
                )}>
                  <Icon className={cn('h-5 w-5', theme === value ? 'text-primary' : 'text-muted-foreground')} />
                </div>
                <span className={cn(
                  'text-sm font-semibold',
                  theme === value ? 'text-primary' : 'text-muted-foreground'
                )}>
                  {label}
                </span>
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2.5">Choose your preferred color scheme.</p>
        </section>

        {/* ── ACCOUNT ── */}
        <section>
          <SectionLabel>Account</SectionLabel>

          {authLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground mt-3">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading...
            </div>
          ) : !user ? (
            <div className="mt-3 rounded-2xl border border-border bg-card p-6 text-center">
              <p className="text-muted-foreground text-sm mb-4">
                Sign up to manage your account and personalize your experience.
              </p>
              <Button onClick={() => setShowAuthModal(true)} className="gap-2">
                <LogIn className="h-4 w-4" /> Sign Up
              </Button>
            </div>
          ) : (
            <div className="mt-3 space-y-6">

              {/* Profile card */}
              <div className="flex items-center gap-4 p-4 rounded-2xl bg-card border border-border">
                <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-lg shrink-0 select-none">
                  {initials}
                </div>
                <div className="min-w-0">
                  {editingName ? (
                    <div className="flex items-center gap-2">
                      <Input
                        value={nameInput}
                        onChange={e => setNameInput(e.target.value)}
                        placeholder="Display name"
                        className="h-8 text-sm max-w-[180px]"
                        autoFocus
                        onKeyDown={e => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') setEditingName(false); }}
                      />
                      <button onClick={handleSaveName} disabled={isSavingName} className="p-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary transition-colors">
                        {isSavingName ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                      </button>
                      <button onClick={() => setEditingName(false)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground truncate">{displayName}</span>
                      <button
                        onClick={() => { setNameInput(displayName); setEditingName(true); }}
                        className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                  <p className="text-sm text-muted-foreground truncate mt-0.5">{user.email}</p>
                </div>
              </div>

              {/* ── Plan & Usage ── */}
              {usage && (
                <div>
                  <FieldLabel>Your Plan</FieldLabel>
                  <div className="mt-2 p-4 rounded-2xl bg-card border border-border space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-foreground">{(PLAN_META[usage.plan as UserPlan] || PLAN_META.free).label} Plan</span>
                      {usage.resetsAt && (
                        <span className="text-[11px] text-muted-foreground">
                          Resets {new Date(usage.resetsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                    <UsageMeter label="Summaries" used={usage.summary.used} limit={usage.summary.limit} variant="sidebar" />
                    <UsageMeter label="Questions" used={usage.askAi.used} limit={usage.askAi.limit} variant="sidebar" />
                  </div>
                </div>
              )}

              {/* ── Genres (compact chips) ── */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <FieldLabel>Your Interests</FieldLabel>
                  <AnimatePresence>
                    {genresDirty && (
                      <motion.button
                        initial={{ opacity: 0, scale: 0.85 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.85 }}
                        onClick={handleSaveGenres}
                        disabled={isSavingGenres}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-xs font-semibold shadow-sm hover:bg-primary/90 transition-colors"
                      >
                        {isSavingGenres
                          ? <Loader2 className="h-3 w-3 animate-spin" />
                          : <Check className="h-3 w-3" />
                        }
                        Save
                      </motion.button>
                    )}
                  </AnimatePresence>
                </div>
                {isLoadingProfile ? (
                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading...
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {APPLE_PODCAST_GENRES.map(genre => {
                      const Icon = GENRE_ICONS[genre.id] || Palette;
                      const selected = selectedGenres.has(genre.id);
                      return (
                        <button
                          key={genre.id}
                          onClick={() => toggleGenre(genre.id)}
                          className={cn(
                            'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all duration-150',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1',
                            selected
                              ? 'border-primary bg-primary/10 text-primary'
                              : 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground'
                          )}
                        >
                          <Icon className="h-3 w-3 shrink-0" />
                          {genre.name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* ── YouTube Channels ── */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/youtube-logo.svg" alt="YouTube" className="h-4 w-auto" />
                    <FieldLabel>YouTube Channels</FieldLabel>
                    {followedChannels.length > 0 && (
                      <span className="text-xs text-muted-foreground bg-secondary px-1.5 py-0.5 rounded-full">{followedChannels.length}</span>
                    )}
                  </div>
                  {followedChannels.length > 0 && (
                    <Button onClick={handleAddMore} variant="ghost" size="sm" className="text-xs text-primary h-7 px-2">
                      + Add More
                    </Button>
                  )}
                </div>

                {/* Has followed channels — show compact list */}
                {followedChannels.length > 0 && (
                  <div className="rounded-2xl bg-card border border-border overflow-hidden">
                    <div className="max-h-[280px] overflow-y-auto divide-y divide-border">
                      {followedChannels.map(ch => (
                        <div key={ch.id} className="flex items-center gap-3 px-4 py-2.5 group">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={ch.thumbnailUrl ? ch.thumbnailUrl.replace(/=s\d+/, '=s176') : undefined}
                            alt=""
                            referrerPolicy="no-referrer"
                            className="w-7 h-7 rounded-full object-cover shrink-0 bg-secondary"
                          />
                          <span className="text-sm text-foreground truncate flex-1">{ch.channelName}</span>
                          <button
                            onClick={() => handleUnfollow(ch.id)}
                            disabled={unfollowingId === ch.id}
                            className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all shrink-0"
                            title={`Unfollow ${ch.channelName}`}
                          >
                            {unfollowingId === ch.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Loading followed channels */}
                {isLoadingFollowed && followedChannels.length === 0 && (
                  <div className="flex items-center gap-2 text-muted-foreground text-sm p-4 rounded-2xl bg-card border border-border">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading channels...
                  </div>
                )}

                {/* No followed channels — show connect/import prompt */}
                {!isLoadingFollowed && followedChannels.length === 0 && (
                  <div className="p-4 rounded-2xl bg-card border border-border">
                    <p className="text-sm text-muted-foreground mb-3">
                      {ytNeedsPermission || !isGoogleUser
                        ? 'Connect your Google account to import YouTube subscriptions and get insights from videos.'
                        : 'Import your YouTube subscriptions to follow channels and get insights from their videos.'}
                    </p>
                    <Button
                      onClick={ytNeedsPermission || !isGoogleUser ? () => setShowYtConnectDialog(true) : handleAddMore}
                      variant="outline"
                      className="gap-2"
                      disabled={isLoadingYt}
                    >
                      {isLoadingYt ? (
                        <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading...</>
                      ) : (
                        <>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src="/youtube-logo.svg" alt="" className="h-3.5 w-auto" />
                          {ytNeedsPermission || !isGoogleUser ? 'Connect YouTube' : 'Import from YouTube'}
                        </>
                      )}
                    </Button>
                  </div>
                )}
                </div>

              {/* ── Country ── */}
              <div>
                <FieldLabel>Region</FieldLabel>
                <div ref={countryRef} className="relative mt-2">
                  <button
                    onClick={() => setCountryOpen(v => !v)}
                    className={cn(
                      'w-full sm:w-72 flex items-center gap-3 px-4 py-3 rounded-2xl border-2 bg-card text-left transition-all',
                      countryOpen ? 'border-primary shadow-sm' : 'border-border hover:border-border/80'
                    )}
                  >
                    {currentCountry && <FlagImg code={currentCountry.code} size={24} />}
                    <span className="flex-1 font-medium text-foreground text-sm truncate">{currentCountry?.name}</span>
                    <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform shrink-0', countryOpen && 'rotate-180')} />
                  </button>

                  <AnimatePresence>
                    {countryOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -8, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.97 }}
                        transition={{ duration: 0.15 }}
                        className="absolute z-50 mt-2 w-full sm:w-72 rounded-2xl border border-border bg-card shadow-xl overflow-hidden"
                      >
                        <div className="p-2 border-b border-border">
                          <div className="relative">
                            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                            <input
                              autoFocus
                              value={countrySearch}
                              onChange={e => setCountrySearch(e.target.value)}
                              placeholder="Search country..."
                              className="w-full pl-8 pr-3 py-1.5 text-sm bg-muted/50 rounded-lg outline-none focus:bg-muted placeholder:text-muted-foreground"
                            />
                          </div>
                        </div>
                        <div className="max-h-56 overflow-y-auto py-1">
                          {filteredCountries.map(c => (
                            <button
                              key={c.code}
                              onClick={() => handleSaveCountry(c.code)}
                              className={cn(
                                'w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-accent transition-colors text-left',
                                profile?.preferred_country === c.code && 'bg-primary/8 text-primary font-medium'
                              )}
                            >
                              <FlagImg code={c.code} size={18} />
                              <span className="truncate">{c.name}</span>
                              {profile?.preferred_country === c.code && (
                                <Check className="h-3.5 w-3.5 ml-auto shrink-0 text-primary" />
                              )}
                            </button>
                          ))}
                          {filteredCountries.length === 0 && (
                            <p className="text-sm text-muted-foreground text-center py-4">No results</p>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* ── Sign out ── */}
              <div className="pt-2 border-t border-border">
                <Button
                  variant="ghost"
                  onClick={signOut}
                  className="gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive px-0"
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </Button>
              </div>

              {/* ── Disconnect YouTube ── */}
              {followedChannels.length > 0 && (
                <div className="pt-2 border-t border-border">
                  <FieldLabel>YouTube Connection</FieldLabel>
                  <p className="text-sm text-muted-foreground mt-1 mb-3">
                    Disconnect your Google account from Yedapo. This will remove all followed YouTube channels and revoke access.
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => setShowDisconnectYtDialog(true)}
                    className="gap-2 border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Unplug className="h-4 w-4" />
                    Disconnect YouTube
                  </Button>
                </div>
              )}

              {/* ── Delete Account ── */}
              <div className="pt-2 border-t border-border">
                <FieldLabel>Danger Zone</FieldLabel>
                <p className="text-sm text-muted-foreground mt-1 mb-3">
                  Permanently delete your account and all associated data. This action cannot be undone.
                </p>
                <Button
                  variant="outline"
                  onClick={() => setShowDeleteDialog(true)}
                  className="gap-2 border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete My Account
                </Button>
              </div>
            </div>
          )}
        </section>

        {/* ── ADMIN ── */}
        {isAdmin && (
          <section>
            <SectionLabel>Administration</SectionLabel>
            <div className="mt-3 rounded-2xl border border-border bg-card p-5">
              <p className="text-muted-foreground text-sm mb-4">
                Access analytics, queue management, and platform controls.
              </p>
              <Button asChild variant="outline" className="gap-2">
                <Link href="/admin/overview">
                  <Shield className="h-4 w-4" />
                  Open Admin Panel
                </Link>
              </Button>
            </div>
          </section>
        )}

        {/* ── NOTIFICATION DELIVERY ── */}
        {user && (
          <section>
            <SectionLabel>Notification Delivery</SectionLabel>
            <div className="mt-3 rounded-2xl border border-border bg-card p-5">
              <DeliveryPreferences />
            </div>
          </section>
        )}

        {/* ── CONNECTED APPS & NOTIFICATIONS ── */}
        {user && (
          <section>
            <SectionLabel>Connected Apps</SectionLabel>
            <div className="mt-3 space-y-3">
              {/* Email */}
              <div className="flex items-center gap-4 p-4 rounded-2xl bg-card border border-border">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
                  <Mail className="h-5 w-5 text-blue-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">Email</p>
                  <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
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
                      <span className="flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Sending...</span>
                    ) : testEmailResult === 'sent' ? (
                      <span className="flex items-center gap-1"><Check className="h-3 w-3" /> Sent!</span>
                    ) : testEmailResult === 'error' ? (
                      'Failed'
                    ) : (
                      'Send Test'
                    )}
                  </button>
                  <span className="text-xs font-medium text-green-600 dark:text-green-400 bg-green-500/10 px-2 py-1 rounded-full">
                    Verified
                  </span>
                </div>
              </div>

              {/* Telegram */}
              <div className="flex items-center gap-4 p-4 rounded-2xl bg-card border border-border">
                <div className="w-10 h-10 rounded-xl bg-sky-500/10 flex items-center justify-center shrink-0">
                  <Send className="h-5 w-5 text-sky-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">Telegram</p>
                  {isLoadingNotifs ? (
                    <p className="text-xs text-muted-foreground">Loading...</p>
                  ) : notifConnections?.telegram.connected ? (
                    <p className="text-xs text-muted-foreground">
                      {notifConnections.telegram.username ? `@${notifConnections.telegram.username}` : 'Connected'}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">Not connected</p>
                  )}
                </div>
                {notifConnections?.telegram.connected ? (
                  <span className="text-xs font-medium text-green-600 dark:text-green-400 bg-green-500/10 px-2 py-1 rounded-full shrink-0">
                    Connected
                  </span>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowTelegramDialog(true)}
                    className="shrink-0"
                  >
                    Connect
                  </Button>
                )}
              </div>
            </div>

            {/* Notification Subscriptions */}
            <div className="mt-6">
              <div className="flex items-center justify-between">
                <FieldLabel>
                  Notification Subscriptions
                  {notifSubs.length > 0 && (
                    <span className="text-sm font-normal text-muted-foreground ml-1.5">
                      ({notifSubs.length})
                    </span>
                  )}
                </FieldLabel>
                {activeTabSubs.length > 0 && (
                  <button
                    onClick={handleBulkToggle}
                    disabled={isBulkToggling}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors',
                      allEnabledInTab
                        ? 'bg-muted text-muted-foreground hover:bg-muted/80'
                        : 'bg-primary/10 text-primary hover:bg-primary/15'
                    )}
                  >
                    {isBulkToggling ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : allEnabledInTab ? (
                      <BellOff className="h-3 w-3" />
                    ) : (
                      <Bell className="h-3 w-3" />
                    )}
                    {allEnabledInTab ? 'Disable All' : 'Enable All'}
                  </button>
                )}
              </div>

              {isLoadingNotifs ? (
                <div className="flex items-center gap-2 text-muted-foreground text-sm mt-3">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading...
                </div>
              ) : notifSubs.length === 0 ? (
                <div className="mt-3 p-5 rounded-2xl border border-dashed border-border bg-card/50 text-center">
                  <BellOff className="h-6 w-6 text-muted-foreground/50 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No notification subscriptions yet.</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Follow a podcast or YouTube channel and tap the bell to get started.
                  </p>
                </div>
              ) : (
                <>
                  {/* Segmented tabs */}
                  <div className="flex gap-1 p-1 rounded-xl bg-muted/50 mt-3">
                    {([
                      { key: 'podcasts' as const, label: 'Podcasts', icon: Headphones, count: podcastSubs.length },
                      { key: 'youtube' as const, label: 'YouTube', icon: Youtube, count: youtubeSubs.length },
                    ]).map(tab => (
                      <button
                        key={tab.key}
                        onClick={() => { setNotifTab(tab.key); setNotifSearch(''); }}
                        className={cn(
                          'flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                          notifTab === tab.key
                            ? 'bg-card text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                        )}
                      >
                        <tab.icon className="h-4 w-4" />
                        {tab.label}
                        <span className={cn(
                          'text-xs px-1.5 py-0.5 rounded-full',
                          notifTab === tab.key
                            ? 'bg-primary/10 text-primary'
                            : 'bg-muted text-muted-foreground'
                        )}>
                          {tab.count}
                        </span>
                      </button>
                    ))}
                  </div>

                  {/* Default channel chips */}
                  {activeTabSubs.length > 0 && (
                    <div className="flex items-center gap-2 mt-2.5 px-1">
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        Apply to all:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {CHANNEL_OPTIONS.map(ch => {
                          const isActive = tabDefaultChannels.includes(ch.id);
                          const isDisabled = ch.comingSoon || (ch.id === 'telegram' && !hasTelegram) || isBulkToggling;
                          return (
                            <button
                              key={ch.id}
                              onClick={() => {
                                if (ch.comingSoon || isDisabled) return;
                                const newDefaults = isActive
                                  ? tabDefaultChannels.filter(c => c !== ch.id)
                                  : [...tabDefaultChannels, ch.id];
                                if (newDefaults.length === 0) return;
                                handleSetDefaultChannels(newDefaults);
                              }}
                              disabled={isDisabled}
                              className={cn(
                                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all',
                                isActive
                                  ? 'bg-primary/15 text-primary ring-1 ring-primary/30'
                                  : 'bg-muted/60 text-muted-foreground hover:bg-muted',
                                isDisabled && 'opacity-40 cursor-not-allowed'
                              )}
                            >
                              <ch.icon className="h-3 w-3" />
                              {ch.label}
                              {ch.comingSoon && (
                                <span className="text-[10px] opacity-60">soon</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Search (shown when 8+ items in active tab) */}
                  {activeTabSubs.length >= 8 && (
                    <div className="relative mt-2">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <input
                        type="text"
                        placeholder={`Search ${notifTab === 'youtube' ? 'channels' : 'podcasts'}...`}
                        value={notifSearch}
                        onChange={e => setNotifSearch(e.target.value)}
                        className="w-full h-9 pl-9 pr-3 rounded-lg border border-border bg-background text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      />
                    </div>
                  )}

                  {/* Scrollable list */}
                  {activeTabSubs.length === 0 ? (
                    <div className="mt-2 py-8 text-center rounded-2xl border border-dashed border-border bg-card/50">
                      <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center mx-auto mb-3">
                        {notifTab === 'youtube'
                          ? <Youtube className="h-5 w-5 text-muted-foreground/50" />
                          : <BellOff className="h-5 w-5 text-muted-foreground/50" />}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {notifTab === 'youtube'
                          ? 'No YouTube channels followed yet.'
                          : 'No podcast subscriptions yet.'}
                      </p>
                    </div>
                  ) : (
                    <div className="mt-2 rounded-2xl border border-border bg-card overflow-hidden relative">
                      <div className="max-h-[320px] sm:max-h-[400px] overflow-y-auto overscroll-contain divide-y divide-border">
                        <AnimatePresence mode="wait">
                          <motion.div
                            key={notifTab}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.15 }}
                          >
                            {filteredNotifSubs.length === 0 ? (
                              <div className="py-6 text-center">
                                <Search className="h-5 w-5 text-muted-foreground/40 mx-auto mb-2" />
                                <p className="text-sm text-muted-foreground">
                                  No matches for &ldquo;{notifSearch}&rdquo;
                                </p>
                              </div>
                            ) : (
                              filteredNotifSubs.map(sub => (
                                <div key={sub.podcastId} className="flex items-center gap-3 px-3 sm:px-4 py-2.5 sm:py-3 hover:bg-accent/50 transition-colors">
                                  {/* Avatar with type indicator */}
                                  <div className="relative shrink-0">
                                    {sub.podcastArtwork ? (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img
                                        src={sub.podcastArtwork}
                                        alt=""
                                        className={cn(
                                          'w-9 h-9 object-cover shrink-0',
                                          sub.type === 'youtube' ? 'rounded-full' : 'rounded-lg'
                                        )}
                                      />
                                    ) : (
                                      <div className={cn(
                                        'w-9 h-9 bg-muted flex items-center justify-center shrink-0',
                                        sub.type === 'youtube' ? 'rounded-full' : 'rounded-lg'
                                      )}>
                                        {sub.type === 'youtube'
                                          ? <Youtube className="h-4 w-4 text-muted-foreground" />
                                          : <Headphones className="h-4 w-4 text-muted-foreground" />}
                                      </div>
                                    )}
                                    {sub.type === 'youtube' && (
                                      <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 flex items-center justify-center ring-2 ring-card">
                                        <Youtube className="h-2.5 w-2.5 text-white" />
                                      </div>
                                    )}
                                  </div>

                                  {/* Text content with clickable channel badges */}
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-foreground truncate">{sub.podcastTitle}</p>
                                    <div className="relative">
                                      <button
                                        onClick={() => setChannelOverrideOpen(
                                          channelOverrideOpen === sub.podcastId ? null : sub.podcastId
                                        )}
                                        className="flex items-center gap-1.5 mt-0.5 group"
                                      >
                                        {(sub.notifyChannels.length > 0 ? sub.notifyChannels : ['in_app']).map(ch => {
                                          const opt = CHANNEL_OPTIONS.find(o => o.id === ch);
                                          return (
                                            <span
                                              key={ch}
                                              className="inline-flex items-center gap-1 text-[11px] text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded"
                                            >
                                              {opt && <opt.icon className="h-2.5 w-2.5" />}
                                              {ch.replace(/_/g, '-')}
                                            </span>
                                          );
                                        })}
                                        <Pencil className="h-2.5 w-2.5 text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity" />
                                      </button>

                                      {/* Channel override popover */}
                                      {channelOverrideOpen === sub.podcastId && (
                                        <div
                                          ref={channelPopoverRef}
                                          className="absolute top-full left-0 mt-1.5 w-48 rounded-xl border border-border bg-card shadow-lg z-50 py-2"
                                        >
                                          <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                            Notify via
                                          </div>
                                          {CHANNEL_OPTIONS.map(option => {
                                            const currentChannels = sub.notifyChannels.length > 0 ? sub.notifyChannels : ['in_app'];
                                            const isActive = currentChannels.includes(option.id);
                                            const isDisabled = option.comingSoon || (option.id === 'telegram' && !hasTelegram);
                                            return (
                                              <button
                                                key={option.id}
                                                onClick={() => {
                                                  if (!isDisabled) handleToggleSubChannel(sub, option.id);
                                                }}
                                                disabled={isDisabled}
                                                className={cn(
                                                  'w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-secondary transition-colors',
                                                  isDisabled && 'opacity-40 cursor-not-allowed'
                                                )}
                                              >
                                                <div className={cn(
                                                  'w-4 h-4 rounded border flex items-center justify-center transition-colors',
                                                  isActive
                                                    ? 'bg-primary border-primary text-primary-foreground'
                                                    : 'border-border'
                                                )}>
                                                  {isActive && <Check className="h-3 w-3" />}
                                                </div>
                                                <option.icon className="h-3.5 w-3.5 text-muted-foreground" />
                                                <span className="text-foreground">{option.label}</span>
                                                {option.comingSoon && (
                                                  <span className="text-[10px] text-muted-foreground ml-auto">soon</span>
                                                )}
                                              </button>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {/* Bell toggle */}
                                  <button
                                    onClick={() => handleToggleNotification(sub)}
                                    disabled={togglingNotif === sub.podcastId || isBulkToggling}
                                    className={cn(
                                      'p-2 rounded-lg transition-colors shrink-0',
                                      sub.notifyEnabled
                                        ? 'text-primary hover:bg-primary/10'
                                        : 'text-muted-foreground hover:bg-muted'
                                    )}
                                  >
                                    {togglingNotif === sub.podcastId ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : sub.notifyEnabled ? (
                                      <Bell className="h-4 w-4" />
                                    ) : (
                                      <BellOff className="h-4 w-4" />
                                    )}
                                  </button>
                                </div>
                              ))
                            )}
                          </motion.div>
                        </AnimatePresence>
                      </div>
                      {/* Scroll fade indicator */}
                      {filteredNotifSubs.length > 6 && (
                        <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-card to-transparent pointer-events-none" />
                      )}
                    </div>
                  )}

                  {/* Summary line */}
                  {activeTabSubs.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-2">
                      {activeTabSubs.filter(s => s.notifyEnabled).length} of {activeTabSubs.length}{' '}
                      {notifTab === 'youtube' ? 'channels' : 'podcasts'} have notifications enabled
                    </p>
                  )}
                </>
              )}
            </div>
          </section>
        )}

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
                <img src="/youtube-logo.svg" alt="YouTube" className="h-8 w-auto mx-auto" />
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Connect YouTube</h3>
                  <p className="text-sm text-muted-foreground mt-1.5">
                    A small window will open to grant Yedapo read-only access to your YouTube subscriptions. We only see which channels you follow — nothing else.
                  </p>
                </div>
                <div className="flex flex-col gap-2 pt-1">
                  <Button
                    onClick={() => { setShowYtConnectDialog(false); connectYouTube(); }}
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

      {/* Disconnect YouTube Confirmation Dialog */}
      <Dialog open={showDisconnectYtDialog} onOpenChange={setShowDisconnectYtDialog}>
        <DialogContent className="max-w-sm p-6">
          <DialogClose onClick={() => setShowDisconnectYtDialog(false)} />
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Unplug className="h-5 w-5 text-destructive" />
              Disconnect YouTube
            </DialogTitle>
          </DialogHeader>
          <div className="mt-3 space-y-4">
            <p className="text-sm text-muted-foreground">
              This will remove your Google connection and unfollow all {followedChannels.length} YouTube channel{followedChannels.length !== 1 ? 's' : ''}. Your existing summaries will not be affected.
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
                {isDisconnectingYt ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unplug className="h-4 w-4" />}
                Disconnect
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Account Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={(open) => { setShowDeleteDialog(open); if (!open) setDeleteConfirmText(''); }}>
        <DialogContent className="max-w-sm p-6">
          <DialogClose onClick={() => { setShowDeleteDialog(false); setDeleteConfirmText(''); }} />
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Delete Account
            </DialogTitle>
          </DialogHeader>
          <div className="mt-3 space-y-4">
            <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20">
              <p className="text-sm text-destructive font-medium">
                This will permanently delete your account and all associated data including your profile, subscriptions, summaries, and listening history.
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground block mb-2">
                Type <span className="font-mono font-bold bg-muted px-1.5 py-0.5 rounded text-destructive">DELETE</span> to confirm
              </label>
              <Input
                value={deleteConfirmText}
                onChange={e => setDeleteConfirmText(e.target.value)}
                placeholder="Type DELETE"
                className="font-mono"
                autoComplete="off"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => { setShowDeleteDialog(false); setDeleteConfirmText(''); }}
                className="flex-1"
                disabled={isDeletingAccount}
              >
                Cancel
              </Button>
              <Button
                onClick={handleDeleteAccount}
                disabled={deleteConfirmText !== 'DELETE' || isDeletingAccount}
                className="flex-1 bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-2"
              >
                {isDeletingAccount ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Delete Forever
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Error Toast */}
      <Toast open={!!errorToast} onOpenChange={() => setErrorToast(null)} position="top">
        <p className="text-sm text-destructive font-medium">{errorToast}</p>
      </Toast>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/70">
      {children}
    </p>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-h4 text-foreground">
      {children}
    </p>
  );
}
