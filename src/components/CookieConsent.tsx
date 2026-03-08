'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import posthog from 'posthog-js';
import { Button } from '@/components/ui/button';
import { Cookie } from 'lucide-react';

const CONSENT_KEY = 'podcatch_cookie_consent';

type ConsentValue = 'accepted' | 'declined';

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem(CONSENT_KEY);
    if (!consent) {
      setVisible(true);
    } else if (consent === 'declined') {
      // Opt out of PostHog if previously declined
      try { posthog.opt_out_capturing(); } catch {}
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem(CONSENT_KEY, 'accepted' satisfies ConsentValue);
    try { posthog.opt_in_capturing(); } catch {}
    setVisible(false);
  };

  const handleDecline = () => {
    localStorage.setItem(CONSENT_KEY, 'declined' satisfies ConsentValue);
    try { posthog.opt_out_capturing(); } catch {}
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-16 lg:bottom-4 left-4 right-4 lg:left-auto lg:right-4 lg:max-w-md z-50 animate-in slide-in-from-bottom-4 duration-300">
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
        <div className="flex gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={handleDecline}>
            Decline
          </Button>
          <Button size="sm" onClick={handleAccept}>
            Accept
          </Button>
        </div>
      </div>
    </div>
  );
}
