import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthUser } from '@/lib/auth-helpers';

// POST: Fetch listening progress for a batch of episode IDs
export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ progress: {} });
  }

  try {
    const { episodeIds } = await request.json();

    if (!Array.isArray(episodeIds) || episodeIds.length === 0) {
      return NextResponse.json({ progress: {} });
    }

    // Limit to 100 IDs per request
    const ids = episodeIds.slice(0, 100);

    const { data, error } = await createAdminClient()
      .from('listening_progress')
      .select('episode_id, current_time_seconds, duration_seconds, completed, last_played_at')
      .eq('user_id', user.id)
      .in('episode_id', ids);

    if (error) throw error;

    // Return as a map: episodeId -> progress
    const progress: Record<string, {
      currentTime: number;
      duration: number;
      completed: boolean;
      lastPlayedAt: string;
    }> = {};

    for (const row of data || []) {
      progress[row.episode_id] = {
        currentTime: row.current_time_seconds,
        duration: row.duration_seconds,
        completed: row.completed,
        lastPlayedAt: row.last_played_at,
      };
    }

    return NextResponse.json({ progress });
  } catch (error) {
    console.error('Error fetching listening progress:', error);
    return NextResponse.json({ progress: {} });
  }
}
