import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCached, setCached } from '@/lib/cache';
import type { AiAnalytics } from '@/types/admin';

const CACHE_KEY = 'admin:ai-analytics';
const SUMMARY_LEVELS = ['quick', 'deep'] as const;
const SUMMARY_STATUSES = ['ready', 'failed', 'queued', 'transcribing', 'summarizing'] as const;
const TRANSCRIPT_STATUSES = ['ready', 'failed', 'pending', 'transcribing'] as const;
const YOUTUBE_RSS_PATTERN = 'youtube:%';

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  // Check Redis cache first (15 min TTL)
  const cached = await getCached<AiAnalytics>(CACHE_KEY);
  if (cached) {
    return NextResponse.json(cached);
  }

  const admin = createAdminClient();

  // Individual count queries per level+status combination (no row fetching)
  const summaryCountQueries = SUMMARY_LEVELS.flatMap(level =>
    SUMMARY_STATUSES.map(status =>
      admin.from('summaries').select('*', { count: 'exact', head: true }).eq('level', level).eq('status', status)
    )
  );
  const transcriptCountQueries = TRANSCRIPT_STATUSES.map(status =>
    admin.from('transcripts').select('*', { count: 'exact', head: true }).eq('status', status)
  );

  const [
    { count: totalSummaries },
    { count: totalTranscripts },
    { data: recentFailedSummaries },
    { data: recentFailedTranscripts },
    { count: youtubeChannels },
    { count: youtubeTotalSummaries },
    { count: youtubeFailedSummaries },
    { count: youtubeQueuedSummaries },
    { count: youtubeTotalTranscripts },
    { count: youtubeFailedTranscripts },
    { data: recentFailedYouTubeSummaries },
    { data: recentFailedYouTubeTranscripts },
    ...countResults
  ] = await Promise.all([
    admin.from('summaries').select('*', { count: 'exact', head: true }),
    admin.from('transcripts').select('*', { count: 'exact', head: true }),
    admin.from('summaries')
      .select('episode_id, level, status, error_message, updated_at, episodes(title)')
      .eq('status', 'failed')
      .order('updated_at', { ascending: false })
      .limit(10),
    admin.from('transcripts')
      .select('episode_id, status, error_message, updated_at, episodes(title)')
      .eq('status', 'failed')
      .order('updated_at', { ascending: false })
      .limit(5),
    admin.from('podcasts').select('*', { count: 'exact', head: true }).like('rss_feed_url', YOUTUBE_RSS_PATTERN),
    admin.from('summaries')
      .select('id, episodes!inner(id, podcasts!inner(rss_feed_url))', { count: 'exact', head: true })
      .like('episodes.podcasts.rss_feed_url', YOUTUBE_RSS_PATTERN),
    admin.from('summaries')
      .select('id, episodes!inner(id, podcasts!inner(rss_feed_url))', { count: 'exact', head: true })
      .eq('status', 'failed')
      .like('episodes.podcasts.rss_feed_url', YOUTUBE_RSS_PATTERN),
    admin.from('summaries')
      .select('id, episodes!inner(id, podcasts!inner(rss_feed_url))', { count: 'exact', head: true })
      .in('status', ['queued', 'transcribing', 'summarizing'])
      .like('episodes.podcasts.rss_feed_url', YOUTUBE_RSS_PATTERN),
    admin.from('transcripts')
      .select('id, episodes!inner(id, podcasts!inner(rss_feed_url))', { count: 'exact', head: true })
      .like('episodes.podcasts.rss_feed_url', YOUTUBE_RSS_PATTERN),
    admin.from('transcripts')
      .select('id, episodes!inner(id, podcasts!inner(rss_feed_url))', { count: 'exact', head: true })
      .eq('status', 'failed')
      .like('episodes.podcasts.rss_feed_url', YOUTUBE_RSS_PATTERN),
    admin.from('summaries')
      .select('episode_id, level, error_message, updated_at, episodes!inner(title, podcasts!inner(rss_feed_url))')
      .eq('status', 'failed')
      .like('episodes.podcasts.rss_feed_url', YOUTUBE_RSS_PATTERN)
      .order('updated_at', { ascending: false })
      .limit(8),
    admin.from('transcripts')
      .select('episode_id, error_message, updated_at, episodes!inner(title, podcasts!inner(rss_feed_url))')
      .eq('status', 'failed')
      .like('episodes.podcasts.rss_feed_url', YOUTUBE_RSS_PATTERN)
      .order('updated_at', { ascending: false })
      .limit(8),
    ...summaryCountQueries,
    ...transcriptCountQueries,
  ]);

  // Parse summary counts from level x status matrix
  const summaryResults = countResults.slice(0, SUMMARY_LEVELS.length * SUMMARY_STATUSES.length);
  const transcriptResults = countResults.slice(SUMMARY_LEVELS.length * SUMMARY_STATUSES.length);

  const summariesByLevelAndStatus: { level: string; status: string; count: number }[] = [];
  let queueDepth = 0;
  let failedCount = 0;
  const queueStatuses = new Set(['queued', 'transcribing', 'summarizing']);

  SUMMARY_LEVELS.forEach((level, li) => {
    SUMMARY_STATUSES.forEach((status, si) => {
      const count = summaryResults[li * SUMMARY_STATUSES.length + si]?.count ?? 0;
      if (count > 0) {
        summariesByLevelAndStatus.push({ level, status, count });
      }
      if (status === 'failed') failedCount += count;
      if (queueStatuses.has(status)) queueDepth += count;
    });
  });

  const transcriptsByStatus = TRANSCRIPT_STATUSES
    .map((status, i) => ({ label: status, count: transcriptResults[i]?.count ?? 0 }))
    .filter(t => t.count > 0);

  const total = totalSummaries ?? 0;
  const failureRate = total > 0 ? Math.round((failedCount / total) * 100) : 0;
  const youtubeSummaryTotal = youtubeTotalSummaries ?? 0;
  const youtubeSummaryFailed = youtubeFailedSummaries ?? 0;
  const youtubeSummaryFailureRate = youtubeSummaryTotal > 0
    ? Math.round((youtubeSummaryFailed / youtubeSummaryTotal) * 100)
    : 0;

  // Generation over time — fetch only ready summaries with minimal fields
  const { data: readySummaries } = await admin
    .from('summaries')
    .select('updated_at')
    .eq('status', 'ready')
    .order('updated_at', { ascending: false })
    .limit(2000);

  const genByDay: Record<string, number> = {};
  (readySummaries ?? []).forEach(s => {
    const day = s.updated_at.split('T')[0];
    genByDay[day] = (genByDay[day] || 0) + 1;
  });
  const generationOverTime = Object.entries(genByDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, value]) => ({ date, value }));

  // Recent failures
  const failures = [
    ...(recentFailedSummaries ?? []).map((s: { episode_id: string; episodes: { title: string } | { title: string }[] | null; level: string; error_message: string | null; updated_at: string }) => ({
      episode_id: s.episode_id,
      episode_title: (Array.isArray(s.episodes) ? s.episodes[0]?.title : s.episodes?.title) ?? 'Unknown',
      type: 'summary' as const,
      level: s.level,
      error_message: s.error_message,
      failed_at: s.updated_at,
    })),
    ...(recentFailedTranscripts ?? []).map((t: { episode_id: string; episodes: { title: string } | { title: string }[] | null; error_message: string | null; updated_at: string }) => ({
      episode_id: t.episode_id,
      episode_title: (Array.isArray(t.episodes) ? t.episodes[0]?.title : t.episodes?.title) ?? 'Unknown',
      type: 'transcript' as const,
      error_message: t.error_message,
      failed_at: t.updated_at,
    })),
  ].sort((a, b) => new Date(b.failed_at).getTime() - new Date(a.failed_at).getTime()).slice(0, 10);

  const youtubeFailures = [
    ...(recentFailedYouTubeSummaries ?? []).map((s: { episode_id: string; episodes: { title: string } | { title: string }[] | null; level: string; error_message: string | null; updated_at: string }) => ({
      episode_id: s.episode_id,
      episode_title: (Array.isArray(s.episodes) ? s.episodes[0]?.title : s.episodes?.title) ?? 'Unknown',
      type: 'summary' as const,
      level: s.level,
      error_message: s.error_message,
      failed_at: s.updated_at,
    })),
    ...(recentFailedYouTubeTranscripts ?? []).map((t: { episode_id: string; episodes: { title: string } | { title: string }[] | null; error_message: string | null; updated_at: string }) => ({
      episode_id: t.episode_id,
      episode_title: (Array.isArray(t.episodes) ? t.episodes[0]?.title : t.episodes?.title) ?? 'Unknown',
      type: 'transcript' as const,
      error_message: t.error_message,
      failed_at: t.updated_at,
    })),
  ].sort((a, b) => new Date(b.failed_at).getTime() - new Date(a.failed_at).getTime()).slice(0, 8);

  const data: AiAnalytics = {
    totalSummaries: totalSummaries ?? 0,
    totalTranscripts: totalTranscripts ?? 0,
    queueDepth,
    failureRate,
    summariesByLevelAndStatus,
    transcriptsByStatus,
    generationOverTime,
    recentFailures: failures,
    youtubeSummaryHealth: {
      totalSummaries: youtubeSummaryTotal,
      queuedSummaries: youtubeQueuedSummaries ?? 0,
      failedSummaries: youtubeSummaryFailed,
      failureRate: youtubeSummaryFailureRate,
      totalTranscripts: youtubeTotalTranscripts ?? 0,
      failedTranscripts: youtubeFailedTranscripts ?? 0,
      youtubeChannels: youtubeChannels ?? 0,
      recentFailures: youtubeFailures,
    },
  };

  // Cache for 15 minutes
  await setCached(CACHE_KEY, data, 900);

  return NextResponse.json(data);
}
