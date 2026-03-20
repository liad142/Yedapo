import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createLogger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/cache';

const log = createLogger('summary');

interface CheckSummariesRequest {
  audioUrls: string[];
  podcastAppleId?: string;
  episodes?: { audioUrl: string; title: string }[];
}

interface SummaryAvailability {
  audioUrl: string;
  episodeId: string | null;
  hasQuickSummary: boolean;
  hasDeepSummary: boolean;
  quickStatus: string | null;
  deepStatus: string | null;
}

/** Normalize title for fuzzy matching: lowercase, collapse whitespace, strip common suffixes */
function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const rlAllowed = await checkRateLimit(`summaries-check:${ip}`, 30, 60);
  if (!rlAllowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

  try {
    const body: CheckSummariesRequest = await request.json();
    const { audioUrls, podcastAppleId, episodes: episodesWithTitles } = body;

    log.info('Check request received', {
      audioUrlCount: audioUrls?.length,
      podcastAppleId: podcastAppleId || null,
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

    // --- Step 1: Find episodes by audio URLs (exact match) ---
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
        return NextResponse.json({ error: 'Database error' }, { status: 500 });
      }
      if (data) episodes.push(...data);
    }

    log.info('Episodes lookup', {
      queriedUrls: audioUrls.length,
      foundEpisodes: episodes.length,
    });

    // Build audio URL → episode ID map
    const audioUrlToEpisode = new Map(episodes.map(e => [e.audio_url, e.id]));

    // --- Step 2: Title-based fallback for unmatched episodes ---
    const unmatchedUrls = audioUrls.filter(url => !audioUrlToEpisode.has(url));

    if (unmatchedUrls.length > 0 && podcastAppleId && episodesWithTitles?.length) {
      // Find podcast by apple_id
      let podcastId: string | null = null;

      const { data: byAppleId } = await supabase
        .from('podcasts')
        .select('id')
        .eq('apple_id', podcastAppleId)
        .single();

      if (byAppleId) {
        podcastId = byAppleId.id;
      } else {
        // Also check by apple: ref in rss_feed_url
        const { data: byRef } = await supabase
          .from('podcasts')
          .select('id')
          .eq('rss_feed_url', `apple:${podcastAppleId}`)
          .single();
        if (byRef) podcastId = byRef.id;
      }

      if (podcastId) {
        // Get all episodes for this podcast (title + id)
        const { data: podcastEpisodes } = await supabase
          .from('episodes')
          .select('id, title')
          .eq('podcast_id', podcastId);

        if (podcastEpisodes?.length) {
          // Build normalized title → episode ID map
          const titleToEpisodeId = new Map<string, string>();
          for (const ep of podcastEpisodes) {
            titleToEpisodeId.set(normalizeTitle(ep.title), ep.id);
          }

          // Build audioUrl → title map from the request
          const urlToTitle = new Map<string, string>();
          for (const ep of episodesWithTitles) {
            urlToTitle.set(ep.audioUrl, ep.title);
          }

          // Match unmatched URLs by title
          let titleMatches = 0;
          for (const url of unmatchedUrls) {
            const title = urlToTitle.get(url);
            if (!title) continue;
            const episodeId = titleToEpisodeId.get(normalizeTitle(title));
            if (episodeId) {
              audioUrlToEpisode.set(url, episodeId);
              titleMatches++;
            }
          }

          if (titleMatches > 0) {
            log.info('Title-based fallback matched', { titleMatches, unmatchedUrls: unmatchedUrls.length });
          }
        }
      }
    }

    // --- Step 3: Get summaries for all matched episodes ---
    const allEpisodeIds = [...new Set(audioUrlToEpisode.values())];

    if (allEpisodeIds.length === 0) {
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

    const { data: summaries, error: summariesError } = await supabase
      .from('summaries')
      .select('episode_id, level, status')
      .in('episode_id', allEpisodeIds);

    log.info('Summaries lookup', {
      episodeIds: allEpisodeIds.length,
      foundSummaries: summaries?.length || 0,
    });

    if (summariesError) {
      log.error('Error fetching summaries', summariesError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    // Build episode ID → summaries mapping
    const { SUMMARY_STATUS_PRIORITY: statusPriority } = await import('@/lib/status-utils');

    const episodeSummaries = new Map<string, { quick: string | null; deep: string | null }>();
    for (const summary of summaries || []) {
      const existing = episodeSummaries.get(summary.episode_id) || { quick: null, deep: null };

      if (summary.level === 'quick') {
        const currentPriority = statusPriority[existing.quick || ''] || 0;
        const newPriority = statusPriority[summary.status] || 0;
        if (newPriority > currentPriority) {
          existing.quick = summary.status;
        }
      } else if (summary.level === 'deep') {
        const currentPriority = statusPriority[existing.deep || ''] || 0;
        const newPriority = statusPriority[summary.status] || 0;
        if (newPriority > currentPriority) {
          existing.deep = summary.status;
        }
      }

      episodeSummaries.set(summary.episode_id, existing);
    }

    // --- Step 4: Build response ---
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
