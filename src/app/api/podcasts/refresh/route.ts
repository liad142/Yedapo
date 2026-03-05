/**
 * POST /api/podcasts/refresh
 * Refresh all subscribed podcasts and populate feed_items with recent episodes
 */

import { NextRequest, NextResponse } from 'next/server';
import { refreshPodcastFeed } from '@/lib/rsshub-db';
import { checkRateLimit } from '@/lib/cache';
import { getAuthUser } from '@/lib/auth-helpers';

export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Rate limiting: 5 req/min per user
    if (!(await checkRateLimit(`podcast-refresh:${user.id}`, 5, 60))) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again in a minute.' },
        { status: 429 }
      );
    }

    const result = await refreshPodcastFeed(user.id);

    return NextResponse.json({
      success: true,
      podcastsRefreshed: result.podcastsRefreshed,
      episodesAdded: result.episodesAdded,
      errors: result.errors.length > 0 ? result.errors : undefined,
    });
  } catch (error) {
    console.error('Refresh podcasts error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to refresh podcasts',
      },
      { status: 500 }
    );
  }
}
