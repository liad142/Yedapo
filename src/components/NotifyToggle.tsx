'use client';

import { useState, useRef, useEffect } from 'react';
import { Bell, BellOff, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

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

const CHANNEL_OPTIONS: readonly { id: string; label: string; comingSoon?: boolean }[] = [
  { id: 'in_app', label: 'In-app' },
  { id: 'email', label: 'Email' },
  { id: 'telegram', label: 'Telegram' },
  { id: 'whatsapp', label: 'WhatsApp', comingSoon: true },
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
        <div className="absolute top-full right-0 mt-2 w-52 rounded-xl border border-border bg-card shadow-lg z-50 py-2">
          <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Notify via
          </div>
          {CHANNEL_OPTIONS.map((option) => {
            const isActive = localChannels.includes(option.id);
            const isDisabled = isSaving || !!option.comingSoon;
            return (
              <button
                key={option.id}
                onClick={() => !option.comingSoon && handleToggleChannel(option.id)}
                disabled={isDisabled}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-secondary transition-colors cursor-pointer",
                  option.comingSoon && "opacity-50 cursor-not-allowed"
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
  );
}
