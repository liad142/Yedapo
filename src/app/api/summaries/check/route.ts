import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createLogger } from '@/lib/logger';

const log = createLogger('summary');

interface CheckSummariesRequest {
  audioUrls: string[];
}

interface SummaryAvailability {
  audioUrl: string;
  episodeId: string | null;
  hasQuickSummary: boolean;
  hasDeepSummary: boolean;
  quickStatus: string | null;
  deepStatus: string | null;
}

export async function POST(request: NextRequest) {
  try {
    const body: CheckSummariesRequest = await request.json();
    const { audioUrls } = body;

    log.info('Check request received', {
      audioUrlCount: audioUrls?.length,
    });

    if (!audioUrls || !Array.isArray(audioUrls) || audioUrls.length === 0) {
      return NextResponse.json(
        { error: 'audioUrls array is required' },
        { status: 400 }
      );
    }

    // Limit to prevent abuse
    if (audioUrls.length > 100) {
      return NextResponse.json(
        { error: 'Maximum 100 audio URLs allowed per request' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Find episodes by audio URLs — batch to avoid HeadersOverflowError
    // (Supabase encodes .in() filter as URL query params, 50 long CDN URLs exceeds limits)
    const BATCH_SIZE = 10;
    const episodes: { id: string; audio_url: string }[] = [];
    for (let i = 0; i < audioUrls.length; i += BATCH_SIZE) {
      const batch = audioUrls.slice(i, i + BATCH_SIZE);
      const { data, error: batchError } = await supabase
        .from('episodes')
        .select('id, audio_url')
        .in('audio_url', batch);

      if (batchError) {
        log.error('Error fetching episodes', batchError);
        return NextResponse.json(
          { error: 'Database error' },
          { status: 500 }
        );
      }
      if (data) episodes.push(...data);
    }

    log.info('Episodes lookup', {
      queriedUrls: audioUrls.length,
      foundEpisodes: episodes.length,
    });

    // If no episodes found, return empty availability
    if (!episodes || episodes.length === 0) {
      const availability: SummaryAvailability[] = audioUrls.map(url => ({
        audioUrl: url,
        episodeId: null,
        hasQuickSummary: false,
        hasDeepSummary: false,
        quickStatus: null,
        deepStatus: null,
      }));
      return NextResponse.json({ availability });
    }

    // Get episode IDs
    const episodeIds = episodes.map(e => e.id);

    // Fetch summaries for these episodes
    const { data: summaries, error: summariesError } = await supabase
      .from('summaries')
      .select('episode_id, level, status')
      .in('episode_id', episodeIds);

    log.info('Summaries lookup', {
      episodeIds: episodeIds.length,
      foundSummaries: summaries?.length || 0,
    });

    if (summariesError) {
      log.error('Error fetching summaries', summariesError);
      return NextResponse.json(
        { error: 'Database error' },
        { status: 500 }
      );
    }

    // Build audio URL to episode mapping
    const audioUrlToEpisode = new Map(episodes.map(e => [e.audio_url, e.id]));

    // Build episode ID to summaries mapping
    const { SUMMARY_STATUS_PRIORITY: statusPriority } = await import('@/lib/status-utils');

    const episodeSummaries = new Map<string, { quick: string | null; deep: string | null }>();
    for (const summary of summaries || []) {
      const existing = episodeSummaries.get(summary.episode_id) || { quick: null, deep: null };

      if (summary.level === 'quick') {
        // Only update if new status has higher priority
        const currentPriority = statusPriority[existing.quick || ''] || 0;
        const newPriority = statusPriority[summary.status] || 0;
        if (newPriority > currentPriority) {
          existing.quick = summary.status;
        }
      } else if (summary.level === 'deep') {
        // Only update if new status has higher priority
        const currentPriority = statusPriority[existing.deep || ''] || 0;
        const newPriority = statusPriority[summary.status] || 0;
        if (newPriority > currentPriority) {
          existing.deep = summary.status;
        }
      }

      episodeSummaries.set(summary.episode_id, existing);
    }

    // Build response
    const availability: SummaryAvailability[] = audioUrls.map(url => {
      const episodeId = audioUrlToEpisode.get(url) || null;
      const summaryInfo = episodeId ? episodeSummaries.get(episodeId) : null;

      return {
        audioUrl: url,
        episodeId,
        hasQuickSummary: summaryInfo?.quick === 'ready',
        hasDeepSummary: summaryInfo?.deep === 'ready',
        quickStatus: summaryInfo?.quick || null,
        deepStatus: summaryInfo?.deep || null,
      };
    });

    return NextResponse.json({ availability });
  } catch (error) {
    log.error('Error in summaries check', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
