'use client';

import { useCallback, useEffect } from 'react';
import { Library, BookOpen, Settings, X, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';

type GatedTab = 'my-list' | 'summaries' | 'settings';

const TAB_CONTENT: Record<GatedTab, { icon: typeof Library; title: string; subtitle: string }> = {
  'my-list': {
    icon: Library,
    title: 'Your Podcast Library',
    subtitle: 'Sign up to save podcasts, track new episodes, and build your personal feed.',
  },
  summaries: {
    icon: BookOpen,
    title: 'AI-Powered Summaries',
    subtitle: 'Create an account to generate summaries, key insights, and chapter breakdowns.',
  },
  settings: {
    icon: Settings,
    title: 'Your Account',
    subtitle: 'Sign up to manage preferences, connect services, and personalize your experience.',
  },
};

// Caret horizontal position (%) for each tab in the 4-item bottom nav
const TAB_CARET_POSITION: Record<GatedTab, string> = {
  'my-list': '37.5%',
  summaries: '62.5%',
  settings: '87.5%',
};

export function GuestGatePopup() {
  const { guestGateTab, setGuestGateTab, setShowAuthModal } = useAuth();

  const dismiss = useCallback(() => {
    setGuestGateTab(null);
  }, [setGuestGateTab]);

  const handleSignUp = useCallback(() => {
    setGuestGateTab(null);
    setShowAuthModal(true, 'Create a free account to unlock all features.');
  }, [setGuestGateTab, setShowAuthModal]);

  // Close on Escape
  useEffect(() => {
    if (!guestGateTab) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismiss();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [guestGateTab, dismiss]);

  if (!guestGateTab) return null;

  const content = TAB_CONTENT[guestGateTab];
  const Icon = content.icon;
  const caretLeft = TAB_CARET_POSITION[guestGateTab];

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[49] bg-black/40 animate-in fade-in-0 duration-200"
        onClick={dismiss}
        aria-hidden="true"
      />

      {/* Tooltip bubble — anchored above bottom nav */}
      <div
        className="fixed z-[50] left-1/2 -translate-x-1/2 bottom-[calc(3.5rem+12px)] w-[calc(100%-2rem)] max-w-[320px] animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-2 duration-200 lg:hidden"
        role="dialog"
        aria-modal="true"
        aria-label={content.title}
      >
        <div className="relative rounded-2xl bg-card border border-border shadow-2xl p-6">
          {/* Close button */}
          <button
            onClick={dismiss}
            className="absolute top-3 right-3 p-1 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>

          {/* Icon */}
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
            <Icon className="h-5 w-5 text-primary" />
          </div>

          {/* Text */}
          <h3 className="text-base font-semibold mb-1">{content.title}</h3>
          <p className="text-[13px] text-muted-foreground leading-relaxed mb-5 max-w-[260px]">
            {content.subtitle}
          </p>

          {/* Actions */}
          <div className="flex items-center justify-between">
            <button
              onClick={dismiss}
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Not now
            </button>
            <Button
              onClick={handleSignUp}
              className="rounded-full px-5 h-10 gap-2 shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:scale-[1.02] active:scale-[0.98] transition-all text-sm"
            >
              <UserPlus className="h-4 w-4" />
              Sign Up Free
            </Button>
          </div>

          {/* Caret pointing down to the nav item */}
          <div
            className="absolute -bottom-[7px] w-3 h-3 bg-card border-r border-b border-border"
            style={{ left: caretLeft, transform: 'translateX(-50%) rotate(45deg)' }}
          />
        </div>
      </div>
    </>
  );
}
