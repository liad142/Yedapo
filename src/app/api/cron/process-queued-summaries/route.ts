import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requestSummary } from '@/lib/summary-service';
import { acquireLock, releaseLock } from '@/lib/cache';
import { createLogger } from '@/lib/logger';

const log = createLogger('cron');
const MAX_PER_RUN = 5;
const STALE_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes

export const maxDuration = 60;

/**
 * Safety net: picks up summaries stuck in 'queued' status and processes them.
 * Runs every 30 minutes via Vercel cron.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const lockKey = 'lock:cron:process-queued-summaries';
  const gotLock = await acquireLock(lockKey, 120);
  if (!gotLock) {
    return NextResponse.json({ error: 'Already running' }, { status: 409 });
  }

  try {
    const supabase = createAdminClient();
    const staleThreshold = new Date(Date.now() - STALE_THRESHOLD_MS).toISOString();

    // Find summaries stuck in 'queued' for more than 10 minutes
    const { data: stuckSummaries, error } = await supabase
      .from('summaries')
      .select('id, episode_id, level, language, episodes!inner(audio_url, title, transcript_url, podcasts(title))')
      .eq('status', 'queued')
      .lt('created_at', staleThreshold)
      .order('created_at', { ascending: true })
      .limit(MAX_PER_RUN);

    if (error) {
      log.error('Failed to query stuck summaries', { error: error.message });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!stuckSummaries || stuckSummaries.length === 0) {
      return NextResponse.json({ processed: 0, message: 'No stuck summaries' });
    }

    log.info('Found stuck queued summaries', { count: stuckSummaries.length });

    let processed = 0;
    for (const summary of stuckSummaries) {
      try {
        const ep = summary.episodes as any;
        const podcast = Array.isArray(ep.podcasts) ? ep.podcasts[0] : ep.podcasts;

        await requestSummary(
          summary.episode_id,
          summary.level as any,
          ep.audio_url,
          summary.language || 'en',
          ep.transcript_url || undefined,
          { podcastTitle: podcast?.title || '', episodeTitle: ep.title || '' }
        );
        processed++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown';
        log.error('Failed to process stuck summary', { summaryId: summary.id, error: msg });
      }
    }

    log.success('Processed stuck summaries', { processed, total: stuckSummaries.length });
    return NextResponse.json({ processed, total: stuckSummaries.length });
  } finally {
    await releaseLock(lockKey);
  }
}
