import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthUser } from '@/lib/auth-helpers';
import { checkRateLimit } from '@/lib/cache';
import { refreshSinglePodcastFeed } from '@/lib/rsshub-db';

// GET: List all subscribed podcasts for a user
export async function GET(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50', 10) || 50, 1), 200);
  const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10) || 0, 0);

  try {
    const { data: subscriptions, error, count } = await createAdminClient()
      .from('podcast_subscriptions')
      .select(`
        id,
        created_at,
        last_viewed_at,
        notify_enabled,
        notify_channels,
        podcasts (
          id,
          title,
          author,
          description,
          rss_feed_url,
          image_url,
          language,
          created_at,
          latest_episode_date
        )
      `, { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    const podcastsWithStatus = (subscriptions || []).map((sub: any) => {
      const podcast = sub.podcasts;
      const hasNewEpisodes = podcast.latest_episode_date && sub.last_viewed_at
        ? new Date(podcast.latest_episode_date) > new Date(sub.last_viewed_at)
        : false;

      return {
        ...podcast,
        subscription: {
          id: sub.id,
          created_at: sub.created_at,
          last_viewed_at: sub.last_viewed_at,
          notify_enabled: sub.notify_enabled ?? false,
          notify_channels: sub.notify_channels ?? [],
        },
        has_new_episodes: hasNewEpisodes,
      };
    });

    return NextResponse.json({
      podcasts: podcastsWithStatus,
      total: count ?? 0,
      limit,
      offset,
    }, {
      headers: { 'Cache-Control': 'private, no-cache' },
    });
  } catch (error) {
    console.error('Error fetching subscriptions:', error);
    return NextResponse.json({ error: 'Failed to fetch subscriptions' }, { status: 500 });
  }
}

// POST: Subscribe to a podcast
export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Rate limit: 20 req/min per user
  const rlAllowed = await checkRateLimit(`subscribe:${user.id}`, 20, 60);
  if (!rlAllowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  try {
    const { podcastId, notifyEnabled, notifyChannels } = await request.json();

    if (!podcastId) {
      return NextResponse.json(
        { error: 'podcastId is required' },
        { status: 400 }
      );
    }

    const insertData: Record<string, unknown> = {
      user_id: user.id,
      podcast_id: podcastId,
    };
    if (typeof notifyEnabled === 'boolean') insertData.notify_enabled = notifyEnabled;
    if (Array.isArray(notifyChannels)) insertData.notify_channels = notifyChannels;

    const { data: subscription, error } = await createAdminClient()
      .from('podcast_subscriptions')
      .upsert(
        insertData,
        { onConflict: 'user_id,podcast_id', ignoreDuplicates: true }
      )
      .select()
      .single();

    if (error) throw error;

    // Background: populate feed_items with recent episodes from this podcast
    refreshSinglePodcastFeed(user.id, podcastId).catch(err =>
      console.error('Background feed refresh failed:', err)
    );

    return NextResponse.json({ subscription }, { status: 201 });
  } catch (error) {
    console.error('Error creating subscription:', error);
    return NextResponse.json({ error: 'Failed to subscribe' }, { status: 500 });
  }
}
