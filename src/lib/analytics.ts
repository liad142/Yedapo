'use client';

/**
 * Lightweight analytics event tracker for business model validation.
 * Events are sent via fire-and-forget POST to /api/analytics.
 * Uses navigator.sendBeacon when available, falls back to fetch with keepalive.
 */

type AnalyticsEvent =
  | 'paywall_impression'    // when a PaywallOverlay becomes visible
  | 'paywall_cta_click'     // when user clicks "Unlock with Pro" CTA
  | 'create_summary'        // when user triggers summary generation
  | 'quota_hit'             // when user hits daily limit
  | string;                 // extensible

export function trackEvent(event: AnalyticsEvent, params?: Record<string, unknown>) {
  // Implementation: fire-and-forget via sendBeacon or fetch keepalive
  // Don't block the UI, don't throw errors
  try {
    const payload = JSON.stringify({ event, params: params || {} });

    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      const blob = new Blob([payload], { type: 'application/json' });
      navigator.sendBeacon('/api/analytics', blob);
    } else if (typeof fetch !== 'undefined') {
      fetch('/api/analytics', {
        method: 'POST',
        body: payload,
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
      }).catch(() => {}); // swallow errors
    }
  } catch {
    // Never let analytics break the app
  }
}
