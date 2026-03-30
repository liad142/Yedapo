import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth-helpers';
import { createAdminClient } from '@/lib/supabase/admin';
import { createLogger } from '@/lib/logger';

const log = createLogger('account');

/**
 * DELETE /api/user/account
 * Self-service account deletion. Removes all user data from every table
 * then deletes the auth.users row.
 */
export async function DELETE() {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();
  const userId = user.id;

  log.info('Account deletion requested', { userId: userId.slice(0, 8) });

  // Delete from all user-owned tables in dependency order.
  // We continue on individual table errors so the auth user still gets removed.
  const tables: { table: string; column: string }[] = [
    { table: 'user_provider_tokens', column: 'user_id' },
    { table: 'user_summaries', column: 'user_id' },
    { table: 'listening_progress', column: 'user_id' },
    { table: 'episode_comments', column: 'user_id' },
    { table: 'podcast_subscriptions', column: 'user_id' },
    { table: 'youtube_channel_follows', column: 'user_id' },
    { table: 'notification_requests', column: 'user_id' },
    { table: 'telegram_connections', column: 'user_id' },
    { table: 'in_app_notifications', column: 'user_id' },
    { table: 'analytics_events', column: 'user_id' },
    { table: 'user_profiles', column: 'id' },
  ];

  for (const { table, column } of tables) {
    const { error } = await admin.from(table).delete().eq(column, userId);
    if (error) {
      log.error(`Failed to delete from ${table}`, { userId: userId.slice(0, 8), message: error.message });
      // Continue — best-effort cleanup before removing auth user
    }
  }

  // Finally remove the auth user (cascades any remaining FK references)
  const { error: authError } = await admin.auth.admin.deleteUser(userId);
  if (authError) {
    log.error('Failed to delete auth user', { userId: userId.slice(0, 8), message: authError.message });
    return NextResponse.json({ error: 'Failed to delete account. Please try again or contact support.' }, { status: 500 });
  }

  log.info('Account deleted successfully', { userId: userId.slice(0, 8) });
  return NextResponse.json({ ok: true });
}
