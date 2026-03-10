import { NextRequest, NextResponse } from 'next/server';
import { checkNewPodcastEpisodes, checkNewYouTubeVideos } from '@/lib/subscription-notifications';
import { acquireLock, releaseLock } from '@/lib/cache';
import { createLogger } from '@/lib/logger';

const log = createLogger('cron');

export const maxDuration = 60; // Vercel function timeout

export async function GET(request: NextRequest) {
  // Validate cron secret
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Distributed lock to prevent overlapping cron executions
  const lockKey = 'lock:cron:check-new-episodes';
  const gotLock = await acquireLock(lockKey, 120); // 2 min TTL
  if (!gotLock) {
    log.warn('Another check is already running, skipping');
    return NextResponse.json({ error: 'Another check is already running' }, { status: 409 });
  }

  log.info('Starting new episode check');

  try {
    const [podcastResults, youtubeResults] = await Promise.all([
      checkNewPodcastEpisodes(),
      checkNewYouTubeVideos(),
    ]);

    const summary = {
      podcasts: podcastResults,
      youtube: youtubeResults,
      totalSourcesChecked: podcastResults.sourcesChecked + youtubeResults.sourcesChecked,
      totalNewEpisodes: podcastResults.newEpisodesFound + youtubeResults.newEpisodesFound,
      totalNotifications: podcastResults.notificationsCreated + youtubeResults.notificationsCreated,
      totalSummariesQueued: podcastResults.summariesQueued + youtubeResults.summariesQueued,
    };

    log.success('New episode check complete', summary);

    return NextResponse.json(summary);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    log.error('Cron job failed', { error: msg });
    return NextResponse.json({ error: msg }, { status: 500 });
  } finally {
    await releaseLock(lockKey);
  }
}
