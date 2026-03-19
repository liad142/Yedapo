import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthUser } from '@/lib/auth-helpers';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/summaries/:episodeId/cancel — reset stuck summary to failed
export async function POST(_request: Request, { params }: RouteParams) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: episodeId } = await params;
  const admin = createAdminClient();

  // Verify the user owns a summary request for this episode
  const { data: ownership } = await admin
    .from('user_summaries')
    .select('id')
    .eq('user_id', user.id)
    .eq('episode_id', episodeId)
    .limit(1)
    .single();

  if (!ownership) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Only reset non-terminal statuses
  const { data, error } = await admin
    .from('summaries')
    .update({
      status: 'failed',
      error_message: 'Cancelled by user',
      updated_at: new Date().toISOString(),
    })
    .eq('episode_id', episodeId)
    .in('status', ['queued', 'transcribing', 'summarizing'])
    .select('id');

  if (error) {
    return NextResponse.json({ error: 'Failed to cancel' }, { status: 500 });
  }

  return NextResponse.json({ cancelled: data?.length ?? 0 });
}
