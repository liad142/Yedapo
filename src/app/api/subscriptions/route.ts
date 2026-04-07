import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthUser } from '@/lib/auth-helpers';
import { checkRateLimit } from '@/lib/cache';
import { refreshSinglePodcastFeed } from '@/lib/rsshub-db';
import { getUserPlan } from '@/lib/user-plan';
import { PLAN_LIMITS } from '@/lib/plans';

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

    // Get new episode counts per podcast (episodes published after last_viewed_at)
    const admin = createAdminClient();
    const podcastIds = (subscriptions || []).map((sub: any) => sub.podcasts?.id).filter(Boolean);
    const newEpisodeCounts = new Map<string, number>();
    const totalEpisodeCounts = new Map<string, number>();

    if (podcastIds.length > 0) {
      // Limit to recent 90 days to avoid unbounded queries for podcasts with thousands of episodes
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
      const { data: episodeRows } = await admin
        .from('episodes')
        .select('podcast_id, published_at')
        .in('podcast_id', podcastIds)
        .gte('published_at', ninetyDaysAgo);

      if (episodeRows) {
        // Build a last_viewed_at lookup per podcast
        const lastViewedMap = new Map<string, string | null>();
        for (const sub of subscriptions || []) {
          const s = sub as any;
          lastViewedMap.set(s.podcasts?.id, s.last_viewed_at);
        }

        for (const row of episodeRows) {
          totalEpisodeCounts.set(row.podcast_id, (totalEpisodeCounts.get(row.podcast_id) || 0) + 1);

          const lastViewed = lastViewedMap.get(row.podcast_id);
          if (lastViewed && row.published_at && new Date(row.published_at) > new Date(lastViewed)) {
            newEpisodeCounts.set(row.podcast_id, (newEpisodeCounts.get(row.podcast_id) || 0) + 1);
          } else if (!lastViewed) {
            // Never viewed — all episodes are "new"
            newEpisodeCounts.set(row.podcast_id, (newEpisodeCounts.get(row.podcast_id) || 0) + 1);
          }
        }
      }
    }

    const podcastsWithStatus = (subscriptions || []).map((sub: any) => {
      const podcast = sub.podcasts;
      const newCount = newEpisodeCounts.get(podcast.id) ?? 0;

      return {
        ...podcast,
        episode_count: totalEpisodeCounts.get(podcast.id) ?? 0,
        new_episode_count: newCount,
        subscription: {
          id: sub.id,
          created_at: sub.created_at,
          last_viewed_at: sub.last_viewed_at,
          notify_enabled: sub.notify_enabled ?? false,
          notify_channels: sub.notify_channels ?? [],
        },
        has_new_episodes: newCount > 0,
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

// PATCH: Mark all subscriptions as viewed (clears "new episode" badges)
export async function PATCH() {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await createAdminClient()
      .from('podcast_subscriptions')
      .update({ last_viewed_at: new Date().toISOString() })
      .eq('user_id', user.id);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error marking subscriptions as viewed:', error);
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
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
    // --- Subscription limit check (Free plan) ---
    const plan = await getUserPlan(user.id, user.email);
    const limit = PLAN_LIMITS[plan].maxPodcastSubs;
    if (limit !== Infinity) {
      const { count, error: countErr } = await createAdminClient()
        .from('podcast_subscriptions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id);

      if (!countErr && (count ?? 0) >= limit) {
        return NextResponse.json(
          { error: 'Subscription limit reached', limit, used: count, upgrade_url: '/pricing' },
          { status: 429 }
        );
      }
    }

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
    if (Array.isArray(notifyChannels)) {
      const VALID_CHANNELS = ['email', 'telegram', 'in_app', 'in-app', 'whatsapp'];
      if (!notifyChannels.every((c: string) => VALID_CHANNELS.includes(c))) {
        return NextResponse.json({ error: 'Invalid notification channel' }, { status: 400 });
      }
      insertData.notify_channels = notifyChannels;
    }

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
