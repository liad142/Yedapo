'use client';

import posthog from 'posthog-js';
import { PostHogProvider as PHProvider } from 'posthog-js/react';
import { useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';

// Initialize PostHog once
if (typeof window !== 'undefined' && POSTHOG_KEY) {
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    capture_pageview: true,
    capture_pageleave: true,
    persistence: 'localStorage+cookie',
    opt_out_capturing_by_default: true,
  });
}

function PostHogIdentifier() {
  const { user } = useAuth();
  const prevUserId = useRef<string | null>(null);

  useEffect(() => {
    if (!POSTHOG_KEY) return;

    if (user) {
      if (prevUserId.current !== user.id) {
        posthog.identify(user.id, {
          email: user.email,
          name: user.user_metadata?.display_name,
        });
        prevUserId.current = user.id;
      }
    } else if (prevUserId.current) {
      posthog.reset();
      prevUserId.current = null;
    }
  }, [user]);

  return null;
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  if (!POSTHOG_KEY) {
    return <>{children}</>;
  }

  return (
    <PHProvider client={posthog}>
      <PostHogIdentifier />
      {children}
    </PHProvider>
  );
}
