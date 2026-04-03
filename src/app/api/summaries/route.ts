import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthUser } from '@/lib/auth-helpers';

// GET: List episodes with summaries for the authenticated user
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = createAdminClient();

    // Get this user's summary IDs and episode IDs from the junction table
    const { data: userSummaries, error: userSummariesError } = await admin
      .from('user_summaries')
      .select('summary_id, episode_id')
      .eq('user_id', user.id);

    if (userSummariesError) {
      console.error('Error fetching user_summaries:', userSummariesError);
      return NextResponse.json({ error: 'Failed to fetch summaries' }, { status: 500 });
    }

    const summaryIds = (userSummaries || []).map(us => us.summary_id);
    const episodeIds = [...new Set((userSummaries || []).map(us => us.episode_id))];

    // --- Also get summaries for subscribed podcasts and followed YouTube channels ---
    // 1. Podcast subscriptions
    const { data: podcastSubs } = await admin
      .from('podcast_subscriptions')
      .select('podcast_id')
      .eq('user_id', user.id);

    const subscribedPodcastIds = (podcastSubs || []).map((s: any) => s.podcast_id);

    // 2. YouTube channel follows → get podcast_ids for those channels
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
        // YouTube channels stored as podcasts with rss_feed_url = 'youtube:channel:{channelId}'
        const feedUrls = ytChannels.map((ch: any) => `youtube:channel:${ch.channel_id}`);
        const { data: channelPodcasts } = await admin
          .from('podcasts')
          .select('id')
          .in('rss_feed_url', feedUrls);
        channelPodcastIds = (channelPodcasts || []).map((p: any) => p.id);
      }
    }

    const allSubscribedPodcastIds = [...new Set([...subscribedPodcastIds, ...channelPodcastIds])];

    // Build queries (Supabase query builders are PromiseLike, cast to Promise)
    const queries: PromiseLike<any>[] = [];

    // Query 1: User's directly triggered summaries by summary ID
    if (summaryIds.length > 0) {
      queries.push(
        admin
          .from('summaries')
          .select(`
            id, episode_id, status, updated_at,
            episodes!inner (
              id, title, description, published_at, duration_seconds, podcast_id,
              podcasts ( id, title, image_url, author, rss_feed_url )
            )
          `)
          .in('id', summaryIds)
          .in('level', ['deep', 'quick'])
          .order('updated_at', { ascending: false })
      );
    }

    // Query 2: In-progress summaries for user's episodes
    if (episodeIds.length > 0) {
      queries.push(
        admin
          .from('summaries')
          .select(`
            id, episode_id, status, updated_at,
            episodes!inner (
              id, title, description, published_at, duration_seconds, podcast_id,
              podcasts ( id, title, image_url, author, rss_feed_url )
            )
          `)
          .in('episode_id', episodeIds)
          .in('level', ['deep', 'quick'])
          .in('status', ['queued', 'transcribing', 'summarizing'])
          .order('updated_at', { ascending: false })
      );
    }

    // Query 3: Ready summaries for episodes from subscribed podcasts/channels (cron-generated)
    if (allSubscribedPodcastIds.length > 0) {
      // Get episode IDs for subscribed podcasts (limit to recent 90 days to avoid unbounded queries)
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
      const { data: subEpisodes } = await admin
        .from('episodes')
        .select('id')
        .in('podcast_id', allSubscribedPodcastIds)
        .gte('published_at', ninetyDaysAgo)
        .limit(500);

      const subEpisodeIds = (subEpisodes || []).map((e: any) => e.id);

      if (subEpisodeIds.length > 0) {
        queries.push(
          admin
            .from('summaries')
            .select(`
              id, episode_id, status, updated_at,
              episodes!inner (
                id, title, description, published_at, duration_seconds, podcast_id,
                podcasts ( id, title, image_url, author, rss_feed_url )
              )
            `)
            .in('episode_id', subEpisodeIds)
            .in('level', ['deep', 'quick'])
            .eq('status', 'ready')
            .order('updated_at', { ascending: false })
            .limit(200)
        );
      }
    }

    const results = await Promise.all(queries);

    // Merge and deduplicate by summary id
    const seenIds = new Set<string>();
    const summaries = results.flatMap(r => r.data ?? []).filter((s: any) => {
      if (seenIds.has(s.id)) return false;
      seenIds.add(s.id);
      return true;
    });

    if (!summaries || summaries.length === 0) {
      return NextResponse.json({ episodes: [] });
    }

    // Deduplicate by episode_id — group all summaries per episode,
    // then determine the overall status: if deep is still processing, show that.
    // Only show "ready" when the deep summary is done.
    const seen = new Set<string>();
    const NON_TERMINAL = ['queued', 'transcribing', 'summarizing'];
    const statusOrder: Record<string, number> = {
      queued: 0, transcribing: 0, summarizing: 0, ready: 1, failed: 2,
    };

    // Group summaries by episode_id
    const episodeSummaries = new Map<string, any[]>();
    for (const s of summaries) {
      const epId = (s as any).episode_id;
      if (!episodeSummaries.has(epId)) {
        episodeSummaries.set(epId, []);
      }
      episodeSummaries.get(epId)!.push(s);
    }

    const result = Array.from(episodeSummaries.entries())
      .map(([_epId, sums]) => {
        // Pick the most representative summary for display
        const mostRecent = sums[0]; // already sorted by updated_at desc
        const ep = (mostRecent as any).episodes;

        // Determine overall status: prioritize non-terminal statuses
        // If ANY summary for this episode is still processing, show that status
        const nonTerminal = sums.find((s: any) => NON_TERMINAL.includes(s.status));
        const deepReady = sums.find((s: any) => s.status === 'ready');
        const anyFailed = sums.find((s: any) => s.status === 'failed');

        let overallStatus: string;
        if (nonTerminal) {
          overallStatus = (nonTerminal as any).status;
        } else if (deepReady) {
          overallStatus = 'ready';
        } else if (anyFailed) {
          overallStatus = 'failed';
        } else {
          overallStatus = (mostRecent as any).status;
        }

        return {
          id: ep.id,
          title: ep.title,
          description: ep.description,
          published_at: ep.published_at,
          duration_seconds: ep.duration_seconds,
          summary_updated_at: (mostRecent as any).updated_at,
          status: overallStatus,
          podcast: Array.isArray(ep.podcasts) ? ep.podcasts[0] : ep.podcasts,
        };
      })
      // Sort: in-progress first, then ready by date, failed last
      .sort((a, b) => {
        const aOrder = statusOrder[a.status] ?? 1;
        const bOrder = statusOrder[b.status] ?? 1;
        if (aOrder !== bOrder) return aOrder - bOrder;
        return new Date(b.summary_updated_at || 0).getTime() - new Date(a.summary_updated_at || 0).getTime();
      });

    // Backfill YouTube channel thumbnails for episodes missing image_url
    const ytChannelIds = result
      .filter(r => !r.podcast?.image_url && r.podcast?.rss_feed_url?.startsWith('youtube:channel:'))
      .map(r => r.podcast!.rss_feed_url!.replace('youtube:channel:', ''));

    if (ytChannelIds.length > 0) {
      const { data: ytChannels } = await admin
        .from('youtube_channels')
        .select('channel_id, thumbnail_url')
        .in('channel_id', ytChannelIds);

      if (ytChannels?.length) {
        const thumbMap = new Map(ytChannels.map((ch: any) => [ch.channel_id, ch.thumbnail_url]));
        for (const ep of result) {
          if (!ep.podcast?.image_url && ep.podcast?.rss_feed_url?.startsWith('youtube:channel:')) {
            const chId = ep.podcast.rss_feed_url.replace('youtube:channel:', '');
            const thumb = thumbMap.get(chId);
            if (thumb) ep.podcast.image_url = thumb;
          }
        }
      }
    }

    // Strip rss_feed_url from response (not needed by client)
    for (const ep of result) {
      if (ep.podcast) delete (ep.podcast as any).rss_feed_url;
    }

    const hasNonTerminal = result.some(r => NON_TERMINAL.includes(r.status));
    const activeCount = result.filter(r => NON_TERMINAL.includes(r.status)).length;

    return NextResponse.json({ episodes: result, activeCount }, {
      headers: {
        'Cache-Control': hasNonTerminal
          ? 'no-store'
          : 'private, s-maxage=60, stale-while-revalidate=120',
      },
    });
  } catch (error) {
    console.error('Error in summaries API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
