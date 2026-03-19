import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { acquireLock, releaseLock } from '@/lib/cache';
import { createLogger } from '@/lib/logger';
import { sendAdminAlert } from '@/lib/notifications/send-admin-alert';

const log = createLogger('cron');
const MAX_PER_RUN = 5;
const STALE_THRESHOLD_MS = 25 * 60 * 1000; // 25 minutes

export const maxDuration = 300; // 5 min — needs time for HTTP retriggers

/**
 * Safety net: picks up summaries stuck in 'queued' or 'transcribing' status
 * and re-triggers them via HTTP POST (separate function invocation).
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
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    // Find summaries stuck in 'queued' or 'transcribing' for more than 10 minutes
    const { data: stuckSummaries, error } = await supabase
      .from('summaries')
      .select('id, episode_id, level')
      .in('status', ['queued', 'transcribing'])
      .lt('updated_at', staleThreshold)
      .order('created_at', { ascending: true })
      .limit(MAX_PER_RUN);

    if (error) {
      log.error('Failed to query stuck summaries', { error: error.message });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!stuckSummaries || stuckSummaries.length === 0) {
      return NextResponse.json({ processed: 0, message: 'No stuck summaries' });
    }

    log.info('Found stuck summaries', { count: stuckSummaries.length });

    // Reset stuck summaries to 'queued' so the POST endpoint re-processes them
    await Promise.allSettled(
      stuckSummaries.map((summary) =>
        supabase
          .from('summaries')
          .update({ status: 'queued', updated_at: new Date().toISOString() })
          .eq('id', summary.id)
      )
    );

    // Trigger each via HTTP POST in parallel (separate function invocation per summary)
    const triggerResults = await Promise.allSettled(
      stuckSummaries.map(async (summary) => {
        const res = await fetch(`${appUrl}/api/episodes/${summary.episode_id}/summaries`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-cron-secret': cronSecret,
          },
          body: JSON.stringify({ level: summary.level }),
        });

        if (!res.ok) {
          log.error('Failed to re-trigger summary', { summaryId: summary.id, status: res.status });
          throw new Error(`HTTP ${res.status}`);
        }
      })
    );

    const processed = triggerResults.filter((r) => r.status === 'fulfilled').length;
    for (let i = 0; i < triggerResults.length; i++) {
      const r = triggerResults[i];
      if (r.status === 'rejected') {
        log.error('Error re-triggering summary', { summaryId: stuckSummaries[i].id, error: String(r.reason) });
      }
    }

    log.success('Processed stuck summaries', { processed, total: stuckSummaries.length });
    return NextResponse.json({ processed, total: stuckSummaries.length });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    log.error('Cron job failed', { error: msg });
    await sendAdminAlert('process-queued-summaries cron failed', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  } finally {
    await releaseLock(lockKey);
  }
}
