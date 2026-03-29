import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { createAdminClient } from '@/lib/supabase/admin';
import type { YouTubePipelineRow } from '@/types/admin';

const YOUTUBE_RSS_PATTERN = 'youtube:%';
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 200;

export async function GET(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const admin = createAdminClient();
  const search = request.nextUrl.searchParams;
  const status = search.get('status') || 'all';
  const level = search.get('level') || 'all';
  const limit = Math.min(Number(search.get('limit') || DEFAULT_LIMIT), MAX_LIMIT);

  let summaryQuery = admin
    .from('summaries')
    .select(`
      id,
      episode_id,
      level,
      language,
      status,
      error_message,
      updated_at,
      episodes!inner(
        id,
        title,
        audio_url,
        podcast_id,
        podcasts!inner(id, title, rss_feed_url)
      )
    `)
    .like('episodes.podcasts.rss_feed_url', YOUTUBE_RSS_PATTERN)
    .order('updated_at', { ascending: false })
    .limit(limit);

  if (status !== 'all') summaryQuery = summaryQuery.eq('status', status);
  if (level !== 'all') summaryQuery = summaryQuery.eq('level', level);

  const { data: summaries, error: summariesError } = await summaryQuery;
  if (summariesError) {
    return NextResponse.json({ error: summariesError.message }, { status: 500 });
  }

  const summaryRows = summaries ?? [];
  const episodeIds = [...new Set(summaryRows.map((s: any) => s.episode_id).filter(Boolean))];
  const summaryIds = summaryRows.map((s: any) => s.id).filter(Boolean);

  const [transcriptsRes, userSummariesRes] = await Promise.all([
    episodeIds.length > 0
      ? admin
          .from('transcripts')
          .select('id, episode_id, language, status, provider, error_message, updated_at')
          .in('episode_id', episodeIds)
      : Promise.resolve({ data: [], error: null }),
    summaryIds.length > 0
      ? admin
          .from('user_summaries')
          .select('user_id, summary_id, created_at')
          .in('summary_id', summaryIds)
          .order('created_at', { ascending: true })
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (transcriptsRes.error) {
    return NextResponse.json({ error: transcriptsRes.error.message }, { status: 500 });
  }
  if (userSummariesRes.error) {
    return NextResponse.json({ error: userSummariesRes.error.message }, { status: 500 });
  }

  const transcripts = transcriptsRes.data ?? [];
  const userSummaries = userSummariesRes.data ?? [];

  const earliestBySummary = new Map<string, { user_id: string | null; created_at: string | null }>();
  const userIds = new Set<string>();
  for (const row of userSummaries as Array<{ user_id: string | null; summary_id: string; created_at: string | null }>) {
    const prev = earliestBySummary.get(row.summary_id);
    if (!prev || ((row.created_at ?? '') < (prev.created_at ?? ''))) {
      earliestBySummary.set(row.summary_id, { user_id: row.user_id, created_at: row.created_at });
    }
    if (row.user_id) userIds.add(row.user_id);
  }

  const { data: userProfiles, error: userProfilesError } = userIds.size > 0
    ? await admin.from('user_profiles').select('id, email').in('id', [...userIds])
    : { data: [], error: null as null | { message: string } };

  if (userProfilesError) {
    return NextResponse.json({ error: userProfilesError.message }, { status: 500 });
  }

  const userEmailById = new Map<string, string | null>();
  (userProfiles ?? []).forEach((u: any) => userEmailById.set(u.id, u.email ?? null));

  const transcriptByEpisode = new Map<string, any>();
  for (const t of transcripts as any[]) {
    const prev = transcriptByEpisode.get(t.episode_id);
    if (!prev || new Date(t.updated_at).getTime() > new Date(prev.updated_at).getTime()) {
      transcriptByEpisode.set(t.episode_id, t);
    }
  }

  const rows: YouTubePipelineRow[] = summaryRows.map((s: any) => {
    const episode = Array.isArray(s.episodes) ? s.episodes[0] : s.episodes;
    const podcast = episode && Array.isArray(episode.podcasts) ? episode.podcasts[0] : episode?.podcasts;
    const transcript = transcriptByEpisode.get(s.episode_id);
    const firstRequest = earliestBySummary.get(s.id);
    const requestedByUserId = firstRequest?.user_id ?? null;

    return {
      episode_id: s.episode_id,
      episode_title: episode?.title ?? 'Unknown',
      podcast_id: podcast?.id ?? '',
      podcast_title: podcast?.title ?? 'Unknown',
      rss_feed_url: podcast?.rss_feed_url ?? null,
      video_url: episode?.audio_url ?? null,
      summary_id: s.id,
      transcript_id: transcript?.id ?? null,
      level: s.level,
      language: s.language ?? transcript?.language ?? null,
      summary_status: s.status ?? null,
      transcript_status: transcript?.status ?? null,
      transcript_provider: transcript?.provider ?? null,
      summary_error: s.error_message ?? null,
      transcript_error: transcript?.error_message ?? null,
      updated_at: s.updated_at,
      requested_by_user_id: requestedByUserId,
      requested_by_email: requestedByUserId ? (userEmailById.get(requestedByUserId) ?? null) : null,
      requested_at: firstRequest?.created_at ?? null,
    };
  });

  return NextResponse.json({ rows });
}
