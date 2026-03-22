import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/youtube/{videoId}/status
 * Check if a YouTube video already has an episode and summary in the DB.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
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

    const hasSummary = episode.deep_summary_status === 'ready' || episode.quick_summary_status === 'ready';

    return NextResponse.json({
      episodeId: episode.id,
      hasSummary,
    });
  } catch {
    return NextResponse.json({ episodeId: null, hasSummary: false });
  }
}
