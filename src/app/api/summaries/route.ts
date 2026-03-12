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
        .eq('level', 'deep')
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
        .eq('level', 'deep')
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

    // Deduplicate by episode_id (keep the first/most recent due to order above)
    const seen = new Set<string>();
    const NON_TERMINAL = ['queued', 'transcribing', 'summarizing'];
    const statusOrder: Record<string, number> = {
      queued: 0, transcribing: 0, summarizing: 0, ready: 1, failed: 2,
    };

    const result = summaries
      .filter((s: any) => {
        if (seen.has(s.episode_id)) return false;
        seen.add(s.episode_id);
        return true;
      })
      .map((s: any) => {
        const ep = s.episodes;
        return {
          id: ep.id,
          title: ep.title,
          description: ep.description,
          published_at: ep.published_at,
          duration_seconds: ep.duration_seconds,
          summary_updated_at: s.updated_at,
          status: s.status as string,
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

    return NextResponse.json({ episodes: result }, {
      headers: {
        'Cache-Control': hasNonTerminal
          ? 'no-store'
          : 'private, s-maxage=300, stale-while-revalidate=600',
      },
    });
  } catch (error) {
    console.error('Error in summaries API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
