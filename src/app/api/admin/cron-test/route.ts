import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/admin';
import { refreshSinglePodcastFeed } from '@/lib/rsshub-db';

/**
 * GET /api/admin/cron-test?podcastId=<uuid>&since=2026-03-17T00:00:00Z&execute=false
 *
 * Simulates the check-new-episodes cron for a single podcast.
 * - `podcastId` (required): internal UUID or apple:<id> format
 * - `since` (required): ISO date string — simulates last_checked_at
 * - `execute` (optional): "true" to actually queue summaries, default is dry-run
 *
 * Returns detailed step-by-step trace of what the cron would do.
 */
export async function GET(request: NextRequest) {
  const { user, error } = await requireAdmin();
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const podcastIdParam = searchParams.get('podcastId');
  const sinceParam = searchParams.get('since');
  const execute = searchParams.get('execute') === 'true';

  if (!podcastIdParam || !sinceParam) {
    return NextResponse.json(
      { error: 'Required params: podcastId, since (ISO date)' },
      { status: 400 }
    );
  }

  const sinceDate = new Date(sinceParam);
  if (isNaN(sinceDate.getTime())) {
    return NextResponse.json({ error: 'Invalid since date' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const trace: Record<string, unknown>[] = [];

  try {
    // Step 1: Resolve podcast
    let podcastId = podcastIdParam;
    let podcast: { id: string; title: string; rss_feed_url: string; language: string } | null = null;

    // If it looks like an apple ID, resolve to internal UUID
    if (podcastIdParam.startsWith('apple:') || /^\d+$/.test(podcastIdParam)) {
      const appleId = podcastIdParam.replace('apple:', '');
      const { data } = await supabase
        .from('podcasts')
        .select('id, title, rss_feed_url, language')
        .or(`rss_feed_url.eq.apple:${appleId},apple_id.eq.${appleId}`)
        .single();
      podcast = data;
      if (podcast) podcastId = podcast.id;
    } else {
      const { data } = await supabase
        .from('podcasts')
        .select('id, title, rss_feed_url, language')
        .eq('id', podcastIdParam)
        .single();
      podcast = data;
    }

    trace.push({
      step: '1_resolve_podcast',
      found: !!podcast,
      podcastId: podcast?.id,
      title: podcast?.title,
      rssField: podcast?.rss_feed_url,
      language: podcast?.language,
    });

    if (!podcast) {
      return NextResponse.json({ error: 'Podcast not found', trace }, { status: 404 });
    }

    // Step 2: Check subscriptions for this podcast
    const { data: subs } = await supabase
      .from('podcast_subscriptions')
      .select('id, user_id, last_checked_at, notify_enabled, notify_channels')
      .eq('podcast_id', podcast.id);

    trace.push({
      step: '2_subscriptions',
      count: subs?.length || 0,
      subscriptions: subs?.map(s => ({
        userId: s.user_id,
        lastCheckedAt: s.last_checked_at,
        notifyEnabled: s.notify_enabled,
        notifyChannels: s.notify_channels,
      })),
    });

    // Step 3: Refresh RSS feed (this actually fetches and imports episodes)
    const userId = user?.id || subs?.[0]?.user_id || 'cron-test';
    const refreshResult = await refreshSinglePodcastFeed(userId, podcast.id);

    trace.push({
      step: '3_refresh_rss_feed',
      episodesAdded: refreshResult.episodesAdded,
    });

    // Step 4: Find new episodes since the given date
    const { data: newEpisodes, error: epError } = await supabase
      .from('episodes')
      .select('id, title, published_at, audio_url, transcript_url')
      .eq('podcast_id', podcast.id)
      .gt('published_at', sinceDate.toISOString())
      .order('published_at', { ascending: false })
      .limit(20);

    trace.push({
      step: '4_new_episodes_since',
      since: sinceDate.toISOString(),
      count: newEpisodes?.length || 0,
      error: epError?.message || null,
      episodes: newEpisodes?.map(ep => ({
        id: ep.id,
        title: ep.title,
        publishedAt: ep.published_at,
        hasTranscriptUrl: !!ep.transcript_url,
      })),
    });

    // Step 5: Check existing summaries for these episodes
    const summaryChecks = [];
    for (const ep of newEpisodes || []) {
      const { data: summaries } = await supabase
        .from('summaries')
        .select('id, level, status, updated_at')
        .eq('episode_id', ep.id);

      summaryChecks.push({
        episodeId: ep.id,
        episodeTitle: ep.title,
        existingSummaries: summaries?.map(s => ({
          level: s.level,
          status: s.status,
          updatedAt: s.updated_at,
        })) || [],
        wouldQueueQuick: !summaries?.some(s => s.level === 'quick' && ['ready', 'summarizing', 'queued', 'transcribing'].includes(s.status)),
        wouldQueueDeep: !summaries?.some(s => s.level === 'deep' && ['ready', 'summarizing', 'queued', 'transcribing'].includes(s.status)),
      });
    }

    trace.push({
      step: '5_summary_status',
      episodes: summaryChecks,
    });

    // Step 6: If execute mode, actually trigger summaries
    if (execute && newEpisodes?.length) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const cronSecret = process.env.CRON_SECRET || '';
      const triggered: { episodeId: string; level: string; status: number }[] = [];

      for (const check of summaryChecks) {
        for (const level of ['quick', 'deep'] as const) {
          const wouldQueue = level === 'quick' ? check.wouldQueueQuick : check.wouldQueueDeep;
          if (!wouldQueue) continue;

          try {
            const res = await fetch(`${appUrl}/api/episodes/${check.episodeId}/summaries`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-cron-secret': cronSecret,
              },
              body: JSON.stringify({ level }),
            });
            triggered.push({ episodeId: check.episodeId, level, status: res.status });
          } catch (err) {
            triggered.push({
              episodeId: check.episodeId,
              level,
              status: 0,
            });
          }
        }
      }

      trace.push({
        step: '6_execute_summaries',
        triggered,
      });
    }

    // Step 7: Environment check (no sensitive values exposed)
    trace.push({
      step: '7_env_check',
    });

    return NextResponse.json({
      mode: execute ? 'EXECUTE' : 'DRY_RUN',
      podcast: { id: podcast.id, title: podcast.title },
      since: sinceDate.toISOString(),
      trace,
    });
  } catch (error) {
    console.error('Cron test failed:', error);
    return NextResponse.json({ error: 'Operation failed', trace }, { status: 500 });
  }
}
