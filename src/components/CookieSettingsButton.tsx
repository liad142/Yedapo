'use client';

import { SHOW_COOKIE_CONSENT_EVENT } from '@/components/CookieConsent';

export function CookieSettingsButton() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(SHOW_COOKIE_CONSENT_EVENT))}
      className="hover:text-foreground transition-colors"
    >
      Cookie Settings
    </button>
  );
}
