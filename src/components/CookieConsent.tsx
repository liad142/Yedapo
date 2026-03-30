'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import posthog from 'posthog-js';
import { Button } from '@/components/ui/button';
import { Cookie } from 'lucide-react';

const CONSENT_KEY = 'yedapo_cookie_consent';
const LEGACY_CONSENT_KEY = 'podcatch_cookie_consent';
const ANALYTICS_KEY = 'yedapo_analytics_consent';

type ConsentValue = 'accepted' | 'declined';

export const SHOW_COOKIE_CONSENT_EVENT = 'show-cookie-consent';

export function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [analyticsEnabled, setAnalyticsEnabled] = useState(false);

  const showBanner = useCallback(() => setVisible(true), []);

  useEffect(() => {
    let consent = localStorage.getItem(CONSENT_KEY);
    if (!consent) {
      const legacy = localStorage.getItem(LEGACY_CONSENT_KEY);
      if (legacy) {
        consent = legacy;
        localStorage.setItem(CONSENT_KEY, legacy);
      }
    }
    if (!consent) {
      setVisible(true);
    } else if (consent === 'accepted') {
      const analytics = localStorage.getItem(ANALYTICS_KEY);
      if (analytics === 'true') {
        try { posthog.opt_in_capturing(); } catch {}
      }
      setAnalyticsEnabled(analytics === 'true');
    } else if (consent === 'declined') {
      try { posthog.opt_out_capturing(); } catch {}
    }
  }, []);

  useEffect(() => {
    window.addEventListener(SHOW_COOKIE_CONSENT_EVENT, showBanner);
    return () => window.removeEventListener(SHOW_COOKIE_CONSENT_EVENT, showBanner);
  }, [showBanner]);

  useEffect(() => {
    if (visible) {
      const stored = localStorage.getItem(ANALYTICS_KEY);
      setAnalyticsEnabled(stored === 'true');
    }
  }, [visible]);

  const handleAccept = () => {
    localStorage.setItem(CONSENT_KEY, 'accepted' satisfies ConsentValue);
    localStorage.setItem(ANALYTICS_KEY, String(analyticsEnabled));
    if (analyticsEnabled) {
      try { posthog.opt_in_capturing(); } catch {}
    } else {
      try { posthog.opt_out_capturing(); } catch {}
    }
    setVisible(false);
  };

  const handleDecline = () => {
    localStorage.setItem(CONSENT_KEY, 'declined' satisfies ConsentValue);
    localStorage.setItem(ANALYTICS_KEY, 'false');
    try { posthog.opt_out_capturing(); } catch {}
    setAnalyticsEnabled(false);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-16 lg:bottom-4 left-4 right-4 lg:left-auto lg:right-4 lg:max-w-md z-[60] animate-in slide-in-from-bottom-4 duration-300">
      <div className="rounded-xl border bg-background shadow-lg p-4 space-y-3">
        <div className="flex items-start gap-3">
          <Cookie className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">Cookie Preferences</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              We use cookies for authentication and analytics to improve your experience.
              You can opt out of non-essential cookies.{' '}
              <Link href="/privacy" className="text-primary hover:underline">
                Privacy Policy
              </Link>
            </p>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <button
              type="button"
              role="switch"
              aria-checked={analyticsEnabled}
              onClick={() => setAnalyticsEnabled((v) => !v)}
              className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                analyticsEnabled ? 'bg-primary' : 'bg-muted'
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 rounded-full bg-background shadow-sm transition-transform ${
                  analyticsEnabled ? 'translate-x-4' : 'translate-x-0.5'
                }`}
              />
            </button>
            <span className="text-xs text-muted-foreground">Analytics cookies</span>
          </label>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleDecline}>
              Decline
            </Button>
            <Button size="sm" onClick={handleAccept}>
              Accept
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
