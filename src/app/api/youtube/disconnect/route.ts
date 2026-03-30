import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth-helpers';
import { createAdminClient } from '@/lib/supabase/admin';
import { createLogger } from '@/lib/logger';

const log = createLogger('youtube');

/**
 * POST /api/youtube/disconnect
 * Disconnects YouTube (Google) integration for the current user.
 * Removes stored tokens, unfollows all YouTube channels, and attempts
 * to revoke the Google OAuth token.
 */
export async function POST() {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();
  const userId = user.id;

  log.info('YouTube disconnect requested', { userId: userId.slice(0, 8) });

  // Fetch the access token before deleting so we can revoke it
  const { data: tokenRow } = await admin
    .from('user_provider_tokens')
    .select('access_token')
    .eq('user_id', userId)
    .eq('provider', 'google')
    .single();

  // Delete provider tokens for Google
  const { error: tokenError } = await admin
    .from('user_provider_tokens')
    .delete()
    .eq('user_id', userId)
    .eq('provider', 'google');

  if (tokenError) {
    log.error('Failed to delete provider tokens', { userId: userId.slice(0, 8), message: tokenError.message });
  }

  // Delete all YouTube channel follows
  const { error: followsError } = await admin
    .from('youtube_channel_follows')
    .delete()
    .eq('user_id', userId);

  if (followsError) {
    log.error('Failed to delete YouTube channel follows', { userId: userId.slice(0, 8), message: followsError.message });
  }

  // Fire-and-forget: revoke the Google token
  if (tokenRow?.access_token) {
    fetch(`https://oauth2.googleapis.com/revoke?token=${tokenRow.access_token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    }).catch(() => {
      // Revocation is best-effort; ignore errors
    });
  }

  log.info('YouTube disconnected', { userId: userId.slice(0, 8) });
  return NextResponse.json({ ok: true });
}
