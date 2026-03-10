import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthUser } from '@/lib/auth-helpers';
import { deleteCached } from '@/lib/cache';
import { createLogger } from '@/lib/logger';

const log = createLogger('profile');

// GET: Fetch current user's profile
export async function GET() {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { data: profile, error } = await createAdminClient()
      .from('user_profiles')
      .select('id, display_name, preferred_genres, preferred_country, onboarding_completed, plan, created_at')
      .eq('id', user.id)
      .single();

    if (error) throw error;

    log.info('GET', { userId: user.id.slice(0, 8), genres: profile?.preferred_genres?.length ?? 0, onboarding: profile?.onboarding_completed });

    return NextResponse.json({ profile }, {
      headers: { 'Cache-Control': 'private, no-cache' },
    });
  } catch (error) {
    log.error('GET error', error);
    return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
  }
}

// PATCH: Update profile
export async function PATCH(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const updates = await request.json();

    // Only allow updating specific fields
    const allowedFields = ['display_name', 'preferred_genres', 'preferred_country', 'onboarding_completed'];
    const filteredUpdates: Record<string, any> = {};

    for (const key of allowedFields) {
      if (key in updates) {
        filteredUpdates[key] = updates[key];
      }
    }

    if (Object.keys(filteredUpdates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    log.info('PATCH', { userId: user.id.slice(0, 8), fields: Object.keys(filteredUpdates).join(',') });

    // Use upsert to handle race condition where trigger hasn't created the row yet
    const { data: profile, error } = await createAdminClient()
      .from('user_profiles')
      .upsert(
        { id: user.id, ...filteredUpdates },
        { onConflict: 'id' }
      )
      .select()
      .single();

    if (error) throw error;

    log.success('Saved', { genres: profile?.preferred_genres?.length ?? 0, onboarding: profile?.onboarding_completed });

    // Invalidate personalized discovery cache when genres or country change
    if ('preferred_genres' in filteredUpdates || 'preferred_country' in filteredUpdates) {
      const country = profile?.preferred_country || 'us';
      await deleteCached(`personalized:${user.id}:${country}`);
    }

    return NextResponse.json({ profile });
  } catch (error) {
    log.error('PATCH error', error);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}
