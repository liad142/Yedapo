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

  const admin = createAdminClient();

  // 1. Delete user_profiles row (may not cascade from auth.users)
  const { error: profileError } = await admin
    .from('user_profiles')
    .delete()
    .eq('id', userId);

  if (profileError) {
    log.error('Failed to delete user profile', { userId, message: profileError.message });
    // Continue — still try to delete auth user
  }

  // 2. Delete from auth.users (cascades to notification_requests, telegram_connections, etc.)
  const { error: authError } = await admin.auth.admin.deleteUser(userId);

  if (authError) {
    log.error('Failed to delete auth user', { userId, message: authError.message });
    return NextResponse.json({ error: authError.message }, { status: 500 });
  }

  log.info('Deleted user', { userId });
  return NextResponse.json({ success: true });
}
