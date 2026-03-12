import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { createAdminClient } from '@/lib/supabase/admin';
import { deleteCached, CacheKeys } from '@/lib/cache';

// GET: List stuck summaries/transcripts (queued/transcribing/summarizing)
export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const admin = createAdminClient();

  const [{ data: stuckSummaries }, { data: stuckTranscripts }] = await Promise.all([
    admin
      .from('summaries')
      .select('id, episode_id, level, language, status, updated_at, error_message, episodes(title)')
      .in('status', ['queued', 'transcribing', 'summarizing'])
      .order('updated_at', { ascending: true })
      .limit(50),
    admin
      .from('transcripts')
      .select('id, episode_id, status, updated_at, error_message, episodes(title)')
      .in('status', ['queued', 'transcribing'])
      .order('updated_at', { ascending: true })
      .limit(50),
  ]);

  return NextResponse.json({
    stuckSummaries: (stuckSummaries ?? []).map((s: any) => ({
      id: s.id,
      episode_id: s.episode_id,
      episode_title: (Array.isArray(s.episodes) ? s.episodes[0]?.title : s.episodes?.title) ?? 'Unknown',
      level: s.level,
      language: s.language,
      status: s.status,
      updated_at: s.updated_at,
      stuck_minutes: Math.round((Date.now() - new Date(s.updated_at).getTime()) / 60000),
    })),
    stuckTranscripts: (stuckTranscripts ?? []).map((t: any) => ({
      id: t.id,
      episode_id: t.episode_id,
      episode_title: (Array.isArray(t.episodes) ? t.episodes[0]?.title : t.episodes?.title) ?? 'Unknown',
      status: t.status,
      updated_at: t.updated_at,
      stuck_minutes: Math.round((Date.now() - new Date(t.updated_at).getTime()) / 60000),
    })),
  });
}

// POST: Reset stuck items — body: { type: 'summary'|'transcript'|'all', ids?: string[] }
export async function POST(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const admin = createAdminClient();
  const body = await request.json();
  const { type = 'all', ids } = body as { type?: string; ids?: string[] };

  let summaryCount = 0;
  let transcriptCount = 0;

  if (type === 'summary' || type === 'all') {
    let q = admin
      .from('summaries')
      .update({ status: 'failed', error_message: 'Reset by admin', updated_at: new Date().toISOString() })
      .in('status', ['queued', 'transcribing', 'summarizing']);
    if (ids && type === 'summary') q = q.in('id', ids);
    const { data } = await q.select('id, episode_id, language');
    summaryCount = data?.length ?? 0;

    // Invalidate caches for reset items
    if (data) {
      await Promise.allSettled(
        data.map((s: any) =>
          Promise.allSettled([
            deleteCached(CacheKeys.insightsStatus(s.episode_id, s.language || 'en')),
            deleteCached(CacheKeys.summaryStatus(s.episode_id, s.language || 'en')),
          ])
        )
      );
    }
  }

  if (type === 'transcript' || type === 'all') {
    let q = admin
      .from('transcripts')
      .update({ status: 'failed', error_message: 'Reset by admin', updated_at: new Date().toISOString() })
      .in('status', ['queued', 'transcribing']);
    if (ids && type === 'transcript') q = q.in('id', ids);
    const { data } = await q.select('id');
    transcriptCount = data?.length ?? 0;
  }

  // Invalidate admin AI cache
  await deleteCached('admin:ai-analytics').catch(() => {});

  return NextResponse.json({ reset: { summaries: summaryCount, transcripts: transcriptCount } });
}
