'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Moon, Sun, Monitor, LogIn, LogOut, Loader2, Pencil, Check, X, Shield, ChevronDown, Search,
  Palette, Briefcase, Smile, GraduationCap, BookOpen, Landmark, Clock, Heart,
  Users, Music, Newspaper, Church, FlaskConical, Globe, Trophy, Cpu, Film,
  Youtube, RefreshCw, Mail, Send, Bell, BellOff,
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
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { YouTubeChannelCard } from '@/components/onboarding/YouTubeChannelCard';
import { YouTubeImportModal } from '@/components/YouTubeImportModal';
import { TelegramConnectFlow } from '@/components/insights/TelegramConnectFlow';
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

  const handleToggleNotification = async (podcastId: string, currentEnabled: boolean) => {
    setTogglingNotif(podcastId);
    try {
      await fetch(`/api/subscriptions/${podcastId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notifyEnabled: !currentEnabled, updateLastViewed: false }),
      });
      // Update local state
      if (!currentEnabled) {
        // Was off, now on — refresh the full list to get updated subscription data
        await fetchNotifications();
      } else {
        // Was on, now off — remove from list
        setNotifSubs(prev => prev.filter(s => s.podcastId !== podcastId));
      }
    } catch {
      setErrorToast('Failed to update notification preference.');
    } finally {
      setTogglingNotif(null);
    }
  };

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

  const fetchYouTubeChannels = async () => {
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
        return;
      }

      const subs: { channelId: string; title: string; description: string; thumbnailUrl: string }[] = data.subscriptions || [];
      setYtChannels(subs);
      setSelectedYtChannels(new Set(subs.map(ch => ch.channelId)));
      if (subs.length > 0) setShowYtImportModal(true);
    } catch {
      setErrorToast('Could not load YouTube subscriptions.');
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

  const handleAddMore = () => {
    fetchYouTubeChannels();
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
                      <span className="text-sm font-semibold text-foreground capitalize">{usage.plan} Plan</span>
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
                <span className="text-xs font-medium text-green-600 dark:text-green-400 bg-green-500/10 px-2 py-1 rounded-full shrink-0">
                  Verified
                </span>
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
              <FieldLabel>Notification Subscriptions</FieldLabel>
              {isLoadingNotifs ? (
                <div className="flex items-center gap-2 text-muted-foreground text-sm mt-3">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading...
                </div>
              ) : notifSubs.length === 0 ? (
                <div className="mt-3 p-5 rounded-2xl border border-dashed border-border bg-card/50 text-center">
                  <BellOff className="h-6 w-6 text-muted-foreground/50 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No notification subscriptions yet.</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Follow a podcast and tap the bell to get started.
                  </p>
                </div>
              ) : (
                <div className="mt-3 rounded-2xl border border-border bg-card overflow-hidden divide-y divide-border">
                  {notifSubs.map(sub => (
                    <div key={sub.podcastId} className="flex items-center gap-3 px-4 py-3">
                      {sub.podcastArtwork ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={sub.podcastArtwork}
                          alt=""
                          className="w-9 h-9 rounded-lg object-cover shrink-0"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                          <Bell className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{sub.podcastTitle}</p>
                        <p className="text-xs text-muted-foreground">
                          via: {sub.notifyChannels.length ? sub.notifyChannels.join(', ').replace(/_/g, '-') : 'in-app'}
                        </p>
                      </div>
                      <button
                        onClick={() => handleToggleNotification(sub.podcastId, sub.notifyEnabled)}
                        disabled={togglingNotif === sub.podcastId}
                        className={cn(
                          'p-2 rounded-lg transition-colors shrink-0',
                          sub.notifyEnabled
                            ? 'text-primary hover:bg-primary/10'
                            : 'text-muted-foreground hover:bg-muted'
                        )}
                      >
                        {togglingNotif === sub.podcastId ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Bell className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
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
