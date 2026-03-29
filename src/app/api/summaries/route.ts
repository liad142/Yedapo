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

    if (!userSummaries || userSummaries.length === 0) {
      return NextResponse.json({ episodes: [] });
    }

    const summaryIds = userSummaries.map(us => us.summary_id);
    const episodeIds = [...new Set(userSummaries.map(us => us.episode_id))];

    // Query by both summary_id (direct match) and episode_id (catches cases where
    // the summary row was recreated but the junction still points to the old ID)
    const [{ data: byId }, { data: byEpisode }] = await Promise.all([
      admin
        .from('summaries')
        .select(`
          id, episode_id, status, updated_at,
          episodes!inner (
            id, title, description, published_at, duration_seconds, podcast_id,
            podcasts ( id, title, image_url, author )
          )
        `)
        .in('id', summaryIds)
        .in('level', ['deep', 'quick'])
        .order('updated_at', { ascending: false }),
      admin
        .from('summaries')
        .select(`
          id, episode_id, status, updated_at,
          episodes!inner (
            id, title, description, published_at, duration_seconds, podcast_id,
            podcasts ( id, title, image_url, author )
          )
        `)
        .in('episode_id', episodeIds)
        .in('level', ['deep', 'quick'])
        .in('status', ['queued', 'transcribing', 'summarizing'])
        .order('updated_at', { ascending: false }),
    ]);

    // Merge and deduplicate by summary id
    const seenIds = new Set<string>();
    const summaries = [...(byId ?? []), ...(byEpisode ?? [])].filter((s: any) => {
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
