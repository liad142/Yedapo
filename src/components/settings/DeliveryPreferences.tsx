'use client';

import { useState, useEffect, useCallback } from 'react';
import { Bell, Clock, Zap, Moon, Loader2, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

type Frequency = 'immediate' | 'digest_daily' | 'digest_weekly' | 'off';

interface Preferences {
  frequency: Frequency;
  digestHour: number;
  timezone: string;
  dailyCap: number;
}

const FREQUENCY_OPTIONS: Array<{
  value: Frequency;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    value: 'immediate',
    label: 'Immediate',
    description: 'Get each summary as soon as it\'s ready',
    icon: Zap,
  },
  {
    value: 'digest_daily',
    label: 'Daily digest',
    description: 'One batched email per day at your chosen time',
    icon: Clock,
  },
  {
    value: 'digest_weekly',
    label: 'Weekly digest',
    description: 'One summary roundup every Monday morning',
    icon: Bell,
  },
  {
    value: 'off',
    label: 'Pause all',
    description: 'Stop delivering notifications (subscriptions still sync)',
    icon: Moon,
  },
];

function formatHour(hour: number): string {
  const period = hour < 12 ? 'AM' : 'PM';
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${displayHour}:00 ${period}`;
}

function detectBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export function DeliveryPreferences() {
  const [prefs, setPrefs] = useState<Preferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch('/api/settings/delivery-preferences');
        if (!res.ok) throw new Error('Failed to load');
        const data = await res.json();
        if (cancelled) return;

        // If user's timezone is still the DB default UTC, opportunistically
        // replace with detected browser TZ (doesn't persist unless user saves)
        const browserTz = detectBrowserTimezone();
        setPrefs({
          frequency: data.frequency,
          digestHour: data.digestHour,
          timezone: data.timezone === 'UTC' && browserTz !== 'UTC' ? browserTz : data.timezone,
          dailyCap: data.dailyCap,
        });

        // Auto-persist timezone upgrade if we detected a real one
        if (data.timezone === 'UTC' && browserTz !== 'UTC') {
          fetch('/api/settings/delivery-preferences', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ timezone: browserTz }),
          }).catch(() => {});
        }
      } catch {
        if (!cancelled) setError('Failed to load preferences');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const updatePref = useCallback(
    async (field: keyof Preferences, value: Preferences[keyof Preferences]) => {
      if (!prefs) return;
      const prevValue = prefs[field];
      setPrefs({ ...prefs, [field]: value } as Preferences);
      setSaving(field);
      setError(null);

      try {
        const res = await fetch('/api/settings/delivery-preferences', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [field]: value }),
        });
        if (!res.ok) throw new Error('Update failed');
        setSavedKey(field);
        setTimeout(() => setSavedKey(null), 1500);
      } catch {
        // Revert optimistic update on failure
        setPrefs((p) => (p ? ({ ...p, [field]: prevValue } as Preferences) : p));
        setError('Failed to save. Try again.');
      } finally {
        setSaving(null);
      }
    },
    [prefs]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
        Loading preferences...
      </div>
    );
  }

  if (!prefs) {
    return <p className="text-sm text-muted-foreground">Couldn&apos;t load preferences.</p>;
  }

  const showDigestHour = prefs.frequency === 'digest_daily' || prefs.frequency === 'digest_weekly';

  return (
    <div className="space-y-6">
      {/* Frequency selector */}
      <div>
        <label className="text-sm font-medium text-foreground mb-3 block">
          How often to deliver summaries
        </label>
        <div className="grid gap-2 sm:grid-cols-2">
          {FREQUENCY_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const selected = prefs.frequency === opt.value;
            const isSaving = saving === 'frequency' && selected;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => !isSaving && updatePref('frequency', opt.value)}
                className={cn(
                  'flex items-start gap-3 p-3 rounded-xl border text-left transition-colors',
                  selected
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:bg-secondary/50',
                  isSaving && 'opacity-60 cursor-wait'
                )}
              >
                <div
                  className={cn(
                    'h-8 w-8 rounded-lg flex items-center justify-center shrink-0',
                    selected ? 'bg-primary/15 text-primary' : 'bg-secondary text-muted-foreground'
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{opt.label}</span>
                    {selected && savedKey === 'frequency' && (
                      <Check className="h-3.5 w-3.5 text-primary" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{opt.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Digest hour (only if digest mode) */}
      {showDigestHour && (
        <div>
          <label htmlFor="digest-hour" className="text-sm font-medium text-foreground mb-2 block">
            Delivery time ({prefs.timezone})
          </label>
          <div className="flex items-center gap-2">
            <select
              id="digest-hour"
              value={prefs.digestHour}
              onChange={(e) => updatePref('digestHour', parseInt(e.target.value, 10))}
              disabled={saving === 'digestHour'}
              className="h-10 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            >
              {Array.from({ length: 24 }, (_, i) => (
                <option key={i} value={i}>
                  {formatHour(i)}
                </option>
              ))}
            </select>
            {saving === 'digestHour' && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            {savedKey === 'digestHour' && <Check className="h-4 w-4 text-primary" />}
          </div>
        </div>
      )}

      {/* Daily cap */}
      <div>
        <label htmlFor="daily-cap" className="text-sm font-medium text-foreground mb-2 block">
          Maximum notifications per day
        </label>
        <div className="flex items-center gap-2">
          <input
            id="daily-cap"
            type="number"
            min={1}
            max={100}
            value={prefs.dailyCap}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10);
              if (Number.isInteger(val) && val >= 1 && val <= 100) {
                updatePref('dailyCap', val);
              }
            }}
            disabled={saving === 'dailyCap'}
            className="h-10 w-24 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
          <span className="text-sm text-muted-foreground">
            notifications/day {prefs.dailyCap >= 100 ? '(max)' : ''}
          </span>
          {saving === 'dailyCap' && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          {savedKey === 'dailyCap' && <Check className="h-4 w-4 text-primary" />}
        </div>
        <p className="text-xs text-muted-foreground mt-1.5">
          If you hit the cap, extra notifications are batched into a digest.
        </p>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
