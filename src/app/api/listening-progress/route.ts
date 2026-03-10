import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthUser } from '@/lib/auth-helpers';

// POST: Upsert listening progress for an episode
export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { episodeId, currentTime, duration } = await request.json();

    if (!episodeId || typeof currentTime !== 'number' || typeof duration !== 'number') {
      return NextResponse.json({ error: 'episodeId, currentTime, and duration required' }, { status: 400 });
    }

    // Mark as completed if >= 95% through
    const completed = duration > 0 && currentTime / duration >= 0.95;

    const { error } = await createAdminClient()
      .from('listening_progress')
      .upsert(
        {
          user_id: user.id,
          episode_id: episodeId,
          current_time_seconds: currentTime,
          duration_seconds: duration,
          completed,
          completed_at: completed ? new Date().toISOString() : null,
          last_played_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,episode_id' }
      );

    if (error) throw error;

    return NextResponse.json({ ok: true, completed });
  } catch (error) {
    console.error('Error saving listening progress:', error);
    return NextResponse.json({ error: 'Failed to save progress' }, { status: 500 });
  }
}
