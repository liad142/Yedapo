'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Loader2,
  Search,
  Bell,
  BellOff,
  Youtube,
  Headphones,
  Check,
  Pencil,
  Mail,
  Smartphone,
} from 'lucide-react';
import {
  TelegramIcon,
  WhatsAppIcon,
  YouTubeIcon,
} from '@/components/icons/BrandIcons';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { FieldLabel } from './SectionLabel';

interface NotificationSub {
  podcastId: string;
  podcastTitle: string;
  podcastArtwork: string | null;
  type?: 'podcast' | 'youtube';
  notifyEnabled: boolean;
  notifyChannels: string[];
}

interface NotifConnections {
  email: { address: string | null; verified: boolean };
  telegram: { connected: boolean; username: string | null };
}

interface ChannelOption {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  comingSoon?: boolean;
}

const CHANNEL_OPTIONS: readonly ChannelOption[] = [
  { id: 'in_app', label: 'In-app', icon: Smartphone },
  { id: 'email', label: 'Email', icon: Mail },
  { id: 'telegram', label: 'Telegram', icon: TelegramIcon },
  { id: 'whatsapp', label: 'WhatsApp', icon: WhatsAppIcon, comingSoon: true },
];

interface NotificationSubscriptionsSectionProps {
  onError?: (message: string) => void;
}

/**
 * Rich per-podcast/channel notification subscription UI with:
 * - Podcast/YouTube tabs
 * - Search
 * - Bulk enable/disable
 * - Per-item channel override popover
 * - "Apply to all" default channel chips
 */
export function NotificationSubscriptionsSection({
  onError,
}: NotificationSubscriptionsSectionProps) {
  const { user } = useAuth();

  const [notifConnections, setNotifConnections] = useState<NotifConnections | null>(null);
  const [notifSubs, setNotifSubs] = useState<NotificationSub[]>([]);
  const [isLoadingNotifs, setIsLoadingNotifs] = useState(false);
  const [togglingNotif, setTogglingNotif] = useState<string | null>(null);
  const [notifTab, setNotifTab] = useState<'podcasts' | 'youtube'>('podcasts');
  const [notifSearch, setNotifSearch] = useState('');
  const [isBulkToggling, setIsBulkToggling] = useState(false);
  const [channelOverrideOpen, setChannelOverrideOpen] = useState<string | null>(null);
  const channelPopoverRef = useRef<HTMLDivElement>(null);

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
      /* silent */
    } finally {
      setIsLoadingNotifs(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) fetchNotifications();
  }, [user, fetchNotifications]);

  const podcastSubs = notifSubs.filter((s) => s.type !== 'youtube');
  const youtubeSubs = notifSubs.filter((s) => s.type === 'youtube');
  const activeTabSubs = notifTab === 'youtube' ? youtubeSubs : podcastSubs;
  const filteredNotifSubs = notifSearch
    ? activeTabSubs.filter((s) =>
        s.podcastTitle.toLowerCase().includes(notifSearch.toLowerCase())
      )
    : activeTabSubs;
  const allEnabledInTab =
    activeTabSubs.length > 0 && activeTabSubs.every((s) => s.notifyEnabled);
  const hasTelegram = notifConnections?.telegram.connected ?? false;

  const handleToggleNotification = async (sub: NotificationSub) => {
    setTogglingNotif(sub.podcastId);
    try {
      const url =
        sub.type === 'youtube'
          ? `/api/youtube/channels/${sub.podcastId}/notifications`
          : `/api/subscriptions/${sub.podcastId}`;
      const body =
        sub.type === 'youtube'
          ? { notifyEnabled: !sub.notifyEnabled }
          : { notifyEnabled: !sub.notifyEnabled, updateLastViewed: false };
      await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      await fetchNotifications();
    } catch {
      onError?.('Failed to update notification preference.');
    } finally {
      setTogglingNotif(null);
    }
  };

  const handleBulkToggle = async () => {
    const newEnabled = !allEnabledInTab;
    setIsBulkToggling(true);
    try {
      await Promise.allSettled(
        activeTabSubs
          .filter((s) => s.notifyEnabled !== newEnabled)
          .map((sub) => {
            const url =
              sub.type === 'youtube'
                ? `/api/youtube/channels/${sub.podcastId}/notifications`
                : `/api/subscriptions/${sub.podcastId}`;
            const body =
              sub.type === 'youtube'
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
      onError?.('Failed to update notification preferences.');
    } finally {
      setIsBulkToggling(false);
    }
  };

  const handleToggleSubChannel = async (sub: NotificationSub, channelId: string) => {
    const currentChannels = sub.notifyChannels.length > 0 ? sub.notifyChannels : ['in_app'];
    const newChannels = currentChannels.includes(channelId)
      ? currentChannels.filter((c) => c !== channelId)
      : [...currentChannels, channelId];

    if (newChannels.length === 0) return;

    setNotifSubs((prev) =>
      prev.map((s) =>
        s.podcastId === sub.podcastId
          ? { ...s, notifyChannels: newChannels, notifyEnabled: true }
          : s
      )
    );

    try {
      const url =
        sub.type === 'youtube'
          ? `/api/youtube/channels/${sub.podcastId}/notifications`
          : `/api/subscriptions/${sub.podcastId}`;
      const body =
        sub.type === 'youtube'
          ? { notifyEnabled: true, notifyChannels: newChannels }
          : {
              notifyEnabled: true,
              notifyChannels: newChannels,
              updateLastViewed: false,
            };
      await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch {
      await fetchNotifications();
      onError?.('Failed to update notification channels.');
    }
  };

  const handleSetDefaultChannels = async (channels: string[]) => {
    if (channels.length === 0) return;
    setIsBulkToggling(true);
    try {
      await Promise.allSettled(
        activeTabSubs.map((sub) => {
          const url =
            sub.type === 'youtube'
              ? `/api/youtube/channels/${sub.podcastId}/notifications`
              : `/api/subscriptions/${sub.podcastId}`;
          const body =
            sub.type === 'youtube'
              ? { notifyEnabled: true, notifyChannels: channels }
              : {
                  notifyEnabled: true,
                  notifyChannels: channels,
                  updateLastViewed: false,
                };
          return fetch(url, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });
        })
      );
      await fetchNotifications();
    } catch {
      onError?.('Failed to apply default channels.');
    } finally {
      setIsBulkToggling(false);
    }
  };

  // Close channel popover on outside click
  useEffect(() => {
    if (!channelOverrideOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (
        channelPopoverRef.current &&
        !channelPopoverRef.current.contains(e.target as Node)
      ) {
        setChannelOverrideOpen(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [channelOverrideOpen]);

  // Compute most common channels in active tab
  const tabDefaultChannels = (() => {
    const enabledSubs = activeTabSubs.filter(
      (s) => s.notifyEnabled && s.notifyChannels.length > 0
    );
    if (enabledSubs.length === 0) return ['in_app'];
    const counts: Record<string, number> = {};
    enabledSubs.forEach((s) =>
      s.notifyChannels.forEach((ch) => {
        counts[ch] = (counts[ch] || 0) + 1;
      })
    );
    const threshold = enabledSubs.length / 2;
    const common = Object.entries(counts)
      .filter(([, c]) => c > threshold)
      .map(([ch]) => ch);
    return common.length > 0 ? common : ['in_app'];
  })();

  return (
    <div>
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
            {(
              [
                {
                  key: 'podcasts' as const,
                  label: 'Podcasts',
                  icon: Headphones,
                  count: podcastSubs.length,
                },
                {
                  key: 'youtube' as const,
                  label: 'YouTube',
                  icon: Youtube,
                  count: youtubeSubs.length,
                },
              ]
            ).map((tab) => (
              <button
                key={tab.key}
                onClick={() => {
                  setNotifTab(tab.key);
                  setNotifSearch('');
                }}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  notifTab === tab.key
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
                <span
                  className={cn(
                    'text-xs px-1.5 py-0.5 rounded-full',
                    notifTab === tab.key
                      ? 'bg-primary/10 text-primary'
                      : 'bg-muted text-muted-foreground'
                  )}
                >
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
                {CHANNEL_OPTIONS.map((ch) => {
                  const isActive = tabDefaultChannels.includes(ch.id);
                  const isDisabled =
                    ch.comingSoon ||
                    (ch.id === 'telegram' && !hasTelegram) ||
                    isBulkToggling;
                  return (
                    <button
                      key={ch.id}
                      onClick={() => {
                        if (ch.comingSoon || isDisabled) return;
                        const newDefaults = isActive
                          ? tabDefaultChannels.filter((c) => c !== ch.id)
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
                onChange={(e) => setNotifSearch(e.target.value)}
                className="w-full h-9 pl-9 pr-3 rounded-lg border border-border bg-background text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
          )}

          {/* Scrollable list */}
          {activeTabSubs.length === 0 ? (
            <div className="mt-2 py-8 text-center rounded-2xl border border-dashed border-border bg-card/50">
              <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center mx-auto mb-3">
                {notifTab === 'youtube' ? (
                  <YouTubeIcon className="h-5 w-5 opacity-50" />
                ) : (
                  <BellOff className="h-5 w-5 text-muted-foreground/50" />
                )}
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
                      filteredNotifSubs.map((sub) => (
                        <div
                          key={sub.podcastId}
                          className="flex items-center gap-3 px-3 sm:px-4 py-2.5 sm:py-3 hover:bg-accent/50 transition-colors"
                        >
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
                              <div
                                className={cn(
                                  'w-9 h-9 bg-muted flex items-center justify-center shrink-0',
                                  sub.type === 'youtube' ? 'rounded-full' : 'rounded-lg'
                                )}
                              >
                                {sub.type === 'youtube' ? (
                                  <YouTubeIcon className="h-5 w-5" />
                                ) : (
                                  <Headphones className="h-4 w-4 text-muted-foreground" />
                                )}
                              </div>
                            )}
                            {sub.type === 'youtube' && (
                              <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 flex items-center justify-center ring-2 ring-card">
                                <Youtube className="h-2.5 w-2.5 text-white" />
                              </div>
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">
                              {sub.podcastTitle}
                            </p>
                            <div className="relative">
                              <button
                                onClick={() =>
                                  setChannelOverrideOpen(
                                    channelOverrideOpen === sub.podcastId ? null : sub.podcastId
                                  )
                                }
                                className="flex items-center gap-1.5 mt-0.5 group"
                              >
                                {(sub.notifyChannels.length > 0
                                  ? sub.notifyChannels
                                  : ['in_app']
                                ).map((ch) => {
                                  const opt = CHANNEL_OPTIONS.find((o) => o.id === ch);
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

                              {channelOverrideOpen === sub.podcastId && (
                                <div
                                  ref={channelPopoverRef}
                                  className="absolute top-full left-0 mt-1.5 w-48 rounded-xl border border-border bg-card shadow-lg z-50 py-2"
                                >
                                  <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                    Notify via
                                  </div>
                                  {CHANNEL_OPTIONS.map((option) => {
                                    const currentChannels =
                                      sub.notifyChannels.length > 0
                                        ? sub.notifyChannels
                                        : ['in_app'];
                                    const isActive = currentChannels.includes(option.id);
                                    const isDisabled =
                                      option.comingSoon ||
                                      (option.id === 'telegram' && !hasTelegram);
                                    return (
                                      <button
                                        key={option.id}
                                        onClick={() => {
                                          if (!isDisabled)
                                            handleToggleSubChannel(sub, option.id);
                                        }}
                                        disabled={isDisabled}
                                        className={cn(
                                          'w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-secondary transition-colors',
                                          isDisabled && 'opacity-40 cursor-not-allowed'
                                        )}
                                      >
                                        <div
                                          className={cn(
                                            'w-4 h-4 rounded border flex items-center justify-center transition-colors',
                                            isActive
                                              ? 'bg-primary border-primary text-primary-foreground'
                                              : 'border-border'
                                          )}
                                        >
                                          {isActive && <Check className="h-3 w-3" />}
                                        </div>
                                        <option.icon className="h-3.5 w-3.5 text-muted-foreground" />
                                        <span className="text-foreground">{option.label}</span>
                                        {option.comingSoon && (
                                          <span className="text-[10px] text-muted-foreground ml-auto">
                                            soon
                                          </span>
                                        )}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </div>

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
              {filteredNotifSubs.length > 6 && (
                <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-card to-transparent pointer-events-none" />
              )}
            </div>
          )}

          {activeTabSubs.length > 0 && (
            <p className="text-xs text-muted-foreground mt-2">
              {activeTabSubs.filter((s) => s.notifyEnabled).length} of {activeTabSubs.length}{' '}
              {notifTab === 'youtube' ? 'channels' : 'podcasts'} have notifications enabled
            </p>
          )}
        </>
      )}
    </div>
  );
}
