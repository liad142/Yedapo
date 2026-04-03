import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthUser } from '@/lib/auth-helpers';

/**
 * GET /api/stats/new-summaries?since=ISO_DATE
 * Returns the count of ready summaries for the user's subscribed podcasts/channels
 * that became ready AFTER the given timestamp.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const since = searchParams.get('since');

    const admin = createAdminClient();

    // Get user's subscribed podcast IDs
    const { data: podcastSubs } = await admin
      .from('podcast_subscriptions')
      .select('podcast_id')
      .eq('user_id', user.id);

    // Get YouTube channel follows → podcast IDs
    const { data: channelFollows } = await admin
      .from('youtube_channel_follows')
      .select('channel_id')
      .eq('user_id', user.id);

    let channelPodcastIds: string[] = [];
    if (channelFollows && channelFollows.length > 0) {
      const channelDbIds = channelFollows.map((f: any) => f.channel_id);
      // Get YouTube channel_id strings from youtube_channels table
      const { data: ytChannels } = await admin
        .from('youtube_channels')
        .select('channel_id')
        .in('id', channelDbIds);

      if (ytChannels && ytChannels.length > 0) {
        const feedUrls = ytChannels.map((ch: any) => `youtube:channel:${ch.channel_id}`);
        const { data: channelPodcasts } = await admin
          .from('podcasts')
          .select('id')
          .in('rss_feed_url', feedUrls);
        channelPodcastIds = (channelPodcasts || []).map((p: any) => p.id);
      }
    }

    // Also get user's directly triggered episode IDs
    const { data: userSummaries } = await admin
      .from('user_summaries')
      .select('episode_id')
      .eq('user_id', user.id);

    const subscribedPodcastIds = (podcastSubs || []).map((s: any) => s.podcast_id);
    const allPodcastIds = [...new Set([...subscribedPodcastIds, ...channelPodcastIds])];
    const userEpisodeIds = [...new Set((userSummaries || []).map((us: any) => us.episode_id))];

    if (allPodcastIds.length === 0 && userEpisodeIds.length === 0) {
      return NextResponse.json({ count: 0 });
    }

    // Count ready summaries after `since` timestamp
    // We need to count distinct episodes, not individual summary rows
    // Strategy: get episode_ids with ready summaries, then count unique ones

    const queries: PromiseLike<any>[] = [];

    if (allPodcastIds.length > 0) {
      // Get episode IDs for subscribed podcasts (limit to recent 90 days)
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
      const { data: subEpisodes } = await admin
        .from('episodes')
        .select('id')
        .in('podcast_id', allPodcastIds)
        .gte('published_at', ninetyDaysAgo)
        .limit(500);

      const subEpisodeIds = (subEpisodes || []).map((e: any) => e.id);

      if (subEpisodeIds.length > 0) {
        let q = admin
          .from('summaries')
          .select('episode_id, updated_at')
          .in('episode_id', subEpisodeIds)
          .eq('status', 'ready')
          .in('level', ['deep', 'quick']);

        if (since) {
          q = q.gt('updated_at', since);
        }
        queries.push(q);
      }
    }

    if (userEpisodeIds.length > 0) {
      let q = admin
        .from('summaries')
        .select('episode_id, updated_at')
        .in('episode_id', userEpisodeIds)
        .eq('status', 'ready')
        .in('level', ['deep', 'quick']);

      if (since) {
        q = q.gt('updated_at', since);
      }
      queries.push(q);
    }

    const results = await Promise.all(queries);
    const allEpisodeIds = new Set<string>();
    for (const result of results) {
      for (const row of result.data || []) {
        allEpisodeIds.add(row.episode_id);
      }
    }

    return NextResponse.json({ count: allEpisodeIds.size }, {
      headers: { 'Cache-Control': 'private, max-age=30' },
    });
  } catch (error) {
    console.error('Error in new-summaries count:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
