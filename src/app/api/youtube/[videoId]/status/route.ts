import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { checkRateLimit } from '@/lib/cache';

/**
 * GET /api/youtube/{videoId}/status
 * Check if a YouTube video already has an episode and summary in the DB.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  // IP-based rate limit since this endpoint has no auth
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const rlAllowed = await checkRateLimit(`yt-status:${ip}`, 30, 60);
  if (!rlAllowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

  const { videoId } = await params;
  const supabase = createAdminClient();

  try {
    // Find episode by YouTube video URL pattern
    const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const { data: episode } = await supabase
      .from('episodes')
      .select('id, deep_summary_status, quick_summary_status')
      .eq('audio_url', youtubeUrl)
      .single();

    if (!episode) {
      return NextResponse.json({ episodeId: null, hasSummary: false });
    }

    // Check actual summary records for this episode
    const { data: summaries } = await supabase
      .from('summaries')
      .select('level, status')
      .eq('episode_id', episode.id)
      .in('level', ['deep', 'quick']);

    const deepSummary = summaries?.find((s: any) => s.level === 'deep');
    const quickSummary = summaries?.find((s: any) => s.level === 'quick');

    // hasSummary = deep summary is ready (full insights available)
    const hasSummary = deepSummary?.status === 'ready';
    // isProcessing = any summary is still being generated
    const isProcessing = summaries?.some((s: any) => ['queued', 'transcribing', 'summarizing'].includes(s.status)) ?? false;

    return NextResponse.json({
      episodeId: episode.id,
      hasSummary,
      isProcessing,
    });
  } catch {
    return NextResponse.json({ episodeId: null, hasSummary: false });
  }
}
