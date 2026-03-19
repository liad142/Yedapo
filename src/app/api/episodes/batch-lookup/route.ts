import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { checkRateLimit } from '@/lib/cache';

// POST: Batch lookup episodes by audio URLs and return their IDs + summary statuses
export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const rlAllowed = await checkRateLimit(`batch-lookup:${ip}`, 30, 60);
  if (!rlAllowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

  try {
    const body = await request.json();
    const { audioUrls } = body as { audioUrls: string[] };

    if (!audioUrls || !Array.isArray(audioUrls) || audioUrls.length === 0) {
      return NextResponse.json({ error: 'audioUrls array is required' }, { status: 400 });
    }

    // Limit batch size
    if (audioUrls.length > 50) {
      return NextResponse.json({ error: 'Maximum 50 URLs per batch' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Single query: fetch episodes with their deep summaries using Supabase relationship
    // This eliminates the N+1 query pattern by using a JOIN under the hood
    const { data: episodes, error: episodesError } = await supabase
      .from('episodes')
      .select(`
        id,
        audio_url,
        summaries!left (
          status,
          level
        )
      `)
      .in('audio_url', audioUrls);

    if (episodesError) {
      console.error('Error looking up episodes:', episodesError);
      return NextResponse.json({ error: 'Failed to lookup episodes' }, { status: 500 });
    }

    // If no episodes found, return empty results
    if (!episodes || episodes.length === 0) {
      return NextResponse.json({ results: {} });
    }

    const { SUMMARY_STATUS_PRIORITY: statusPriority } = await import('@/lib/status-utils');

    // Build results directly from the joined data
    const results: Record<string, { episodeId: string; summaryStatus: string }> = {};

    for (const episode of episodes) {
      // Find the BEST deep summary status from the joined summaries array
      // (prioritize 'ready' over other statuses)
      let bestStatus = 'not_ready';
      let bestPriority = 0;

      if (Array.isArray(episode.summaries)) {
        for (const summary of episode.summaries) {
          // Check both quick and deep summaries — either means the episode has been summarized
          if (summary.level === 'deep' || summary.level === 'quick') {
            const priority = statusPriority[summary.status] || 0;
            if (priority > bestPriority) {
              bestPriority = priority;
              bestStatus = summary.status;
            }
          }
        }
      }

      results[episode.audio_url] = {
        episodeId: episode.id,
        summaryStatus: bestStatus,
      };
    }

    return NextResponse.json({ results });
  } catch (error) {
    console.error('Batch lookup error:', error);
    return NextResponse.json({ error: 'Failed to batch lookup episodes' }, { status: 500 });
  }
}
