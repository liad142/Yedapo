'use client';

import { useState, useRef, useEffect } from 'react';
import { Bell, BellOff, Check, Lock, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useUserPlan } from '@/hooks/useUserPlan';

interface NotifyToggleProps {
  /** Whether notifications are currently enabled */
  enabled: boolean;
  /** Current notification channels */
  channels: string[];
  /** Whether the user has Telegram connected */
  hasTelegram?: boolean;
  /** Called when notification preferences change */
  onUpdate: (enabled: boolean, channels: string[]) => Promise<void>;
  className?: string;
}

const FREE_CHANNEL = { id: 'in_app', label: 'In-app' } as const;

const PRO_CHANNELS: readonly { id: string; label: string; comingSoon?: boolean }[] = [
  { id: 'email', label: 'Email' },
  { id: 'telegram', label: 'Telegram' },
  { id: 'whatsapp', label: 'WhatsApp', comingSoon: true },
];

const ALL_CHANNELS: readonly { id: string; label: string; comingSoon?: boolean }[] = [
  FREE_CHANNEL,
  ...PRO_CHANNELS,
];

export function NotifyToggle({
  enabled,
  channels,
  hasTelegram = false,
  onUpdate,
  className,
}: NotifyToggleProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [localChannels, setLocalChannels] = useState<string[]>(channels);
  const [isSaving, setIsSaving] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const { isFree } = useUserPlan();

  useEffect(() => {
    setLocalChannels(channels);
  }, [channels]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

  const handleToggleChannel = async (channelId: string) => {
    const newChannels = localChannels.includes(channelId)
      ? localChannels.filter(c => c !== channelId)
      : [...localChannels, channelId];

    setLocalChannels(newChannels);
    setIsSaving(true);

    try {
      const newEnabled = newChannels.length > 0;
      await onUpdate(newEnabled, newChannels);
    } catch {
      // Revert on error
      setLocalChannels(channels);
    } finally {
      setIsSaving(false);
    }
  };

  const handleBellClick = async () => {
    if (enabled) {
      // If enabled, open popover to manage channels
      setIsOpen(!isOpen);
    } else {
      // If disabled, enable with in_app as default and open popover
      const defaultChannels = ['in_app'];
      setLocalChannels(defaultChannels);
      setIsSaving(true);
      try {
        await onUpdate(true, defaultChannels);
        setIsOpen(true);
      } finally {
        setIsSaving(false);
      }
    }
  };

  const isEnabled = localChannels.length > 0;

  return (
    <div className={cn('relative', className)} ref={popoverRef}>
      <Button
        variant="ghost"
        size="icon"
        onClick={handleBellClick}
        disabled={isSaving}
        className={cn(
          'rounded-full',
          isEnabled && 'text-primary'
        )}
        aria-label={isEnabled ? 'Manage notifications' : 'Enable notifications'}
      >
        {isEnabled ? (
          <Bell className="h-5 w-5" />
        ) : (
          <BellOff className="h-5 w-5" />
        )}
      </Button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-56 rounded-xl border border-border bg-card shadow-lg z-50 py-2">
          <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Notify via
          </div>

          {/* In-app — always available */}
          {isFree ? (
            <>
              <ChannelRow
                channelId={FREE_CHANNEL.id}
                label={FREE_CHANNEL.label}
                isActive={localChannels.includes(FREE_CHANNEL.id)}
                isDisabled={isSaving}
                onToggle={handleToggleChannel}
              />

              {/* Divider */}
              <div className="mx-3 my-2 border-t border-border" />

              {/* Pro upgrade section */}
              <div className="px-3 pb-1">
                {/* Locked channels preview */}
                <div className="space-y-0.5">
                  {PRO_CHANNELS.map((option) => (
                    <div
                      key={option.id}
                      className="flex items-center gap-3 py-1.5 text-sm"
                    >
                      <div className="w-4 h-4 rounded border border-border/60 flex items-center justify-center">
                        <Lock className="h-2.5 w-2.5 text-muted-foreground/50" />
                      </div>
                      <span className="text-muted-foreground/60">{option.label}</span>
                      {option.comingSoon && (
                        <span className="text-[10px] text-muted-foreground/40 ml-auto">soon</span>
                      )}
                    </div>
                  ))}
                </div>

                {/* Upgrade CTA */}
                <div className="mt-2.5 mb-1 rounded-lg bg-primary/[0.06] dark:bg-primary/[0.1] border border-primary/15 p-2.5">
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    Get summaries delivered to your inbox, Telegram, or WhatsApp
                  </p>
                  <Button
                    size="sm"
                    variant="ghost"
                    asChild
                    className="mt-1.5 h-7 w-full gap-1.5 text-xs font-semibold text-primary hover:text-primary hover:bg-primary/10"
                  >
                    <Link href="/pricing">
                      <Sparkles className="h-3 w-3" />
                      Upgrade to Pro
                    </Link>
                  </Button>
                </div>
              </div>
            </>
          ) : (
            /* Pro users see all channels as normal toggleable rows */
            ALL_CHANNELS.map((option) => (
              <ChannelRow
                key={option.id}
                channelId={option.id}
                label={option.label}
                isActive={localChannels.includes(option.id)}
                isDisabled={isSaving || !!option.comingSoon}
                comingSoon={option.comingSoon}
                onToggle={handleToggleChannel}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Extracted row component to avoid duplication between free/pro paths */
/* ------------------------------------------------------------------ */
function ChannelRow({
  channelId,
  label,
  isActive,
  isDisabled,
  comingSoon,
  onToggle,
}: {
  channelId: string;
  label: string;
  isActive: boolean;
  isDisabled: boolean;
  comingSoon?: boolean;
  onToggle: (id: string) => void;
}) {
  return (
    <button
      onClick={() => !comingSoon && onToggle(channelId)}
      disabled={isDisabled}
      className={cn(
        'w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-secondary transition-colors cursor-pointer',
        comingSoon && 'opacity-50 cursor-not-allowed'
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
      <span className="text-foreground">{label}</span>
      {comingSoon && (
        <span className="text-[10px] text-muted-foreground ml-auto">soon</span>
      )}
    </button>
  );
}
