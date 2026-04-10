'use client';

import { Sun, Moon, Monitor } from 'lucide-react';
import posthog from 'posthog-js';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';
import { SectionLabel } from './SectionLabel';

const THEME_OPTIONS = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
] as const;

export function AppearanceSection() {
  const { theme, setTheme } = useTheme();

  return (
    <section>
      <SectionLabel>Appearance</SectionLabel>
      <div className="grid grid-cols-3 gap-3 mt-3">
        {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            onClick={() => {
              setTheme(value);
              posthog.capture('theme_changed', { theme: value });
            }}
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
            <div
              className={cn(
                'w-10 h-10 rounded-xl flex items-center justify-center',
                theme === value ? 'bg-primary/15' : 'bg-muted'
              )}
            >
              <Icon
                className={cn(
                  'h-5 w-5',
                  theme === value ? 'text-primary' : 'text-muted-foreground'
                )}
              />
            </div>
            <span
              className={cn(
                'text-sm font-semibold',
                theme === value ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              {label}
            </span>
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground mt-2.5">
        Choose your preferred color scheme.
      </p>
    </section>
  );
}
