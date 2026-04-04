import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { createAdminClient } from '@/lib/supabase/admin';
import { createLogger } from '@/lib/logger';

const log = createLogger('admin');

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id: userId } = await params;
  if (!userId) {
    return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
  }

  // Validate UUID format before sequential deletes
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(userId)) {
    return NextResponse.json({ error: 'Invalid user ID format' }, { status: 400 });
  }

  const admin = createAdminClient();

  // Delete from all user-owned tables in dependency order.
  // Continue on individual table errors so the auth user still gets removed.
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
    const { error: tableError } = await admin.from(table).delete().eq(column, userId);
    if (tableError) {
      log.error(`Failed to delete from ${table}`, { userId, message: tableError.message });
      // Continue — best-effort cleanup before removing auth user
    }
  }

  // Finally remove the auth user (cascades any remaining FK references)
  const { error: authError } = await admin.auth.admin.deleteUser(userId);

  if (authError) {
    log.error('Failed to delete auth user', { userId, message: authError.message });
    return NextResponse.json({ error: authError.message }, { status: 500 });
  }

  log.info('Deleted user', { userId });
  return NextResponse.json({ success: true });
}
