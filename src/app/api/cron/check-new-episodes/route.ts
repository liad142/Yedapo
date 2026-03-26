import { NextRequest, NextResponse } from 'next/server';
import { Receiver } from '@upstash/qstash';
import { checkNewPodcastEpisodes, checkNewYouTubeVideos } from '@/lib/subscription-notifications';
import { acquireLock, releaseLock } from '@/lib/cache';
import { createLogger } from '@/lib/logger';
import { sendAdminAlert } from '@/lib/notifications/send-admin-alert';

const log = createLogger('cron');

export const maxDuration = 300; // 5 min — needs time for RSS fetches + summary queueing

// ---------------------------------------------------------------------------
// Auth: Vercel cron (GET) or QStash (POST)
// ---------------------------------------------------------------------------

/** GET — triggered by Vercel cron (daily fallback) */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return checkNewEpisodes();
}

/** POST — triggered by QStash (every 6 hours) */
export async function POST(request: NextRequest) {
  const signature = request.headers.get('upstash-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
  }

  const signingKeys = {
    currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY,
    nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY,
  };

  if (!signingKeys.currentSigningKey || !signingKeys.nextSigningKey) {
    log.error('QStash signing keys not configured');
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  const receiver = new Receiver(signingKeys as { currentSigningKey: string; nextSigningKey: string });
  const body = await request.text();

  try {
    await receiver.verify({ signature, body });
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  return checkNewEpisodes();
}

// ---------------------------------------------------------------------------
// Shared processing logic
// ---------------------------------------------------------------------------

async function checkNewEpisodes() {
  const lockKey = 'lock:cron:check-new-episodes';
  const gotLock = await acquireLock(lockKey, 120);
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
    await sendAdminAlert('check-new-episodes cron failed', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  } finally {
    await releaseLock(lockKey);
  }
}
