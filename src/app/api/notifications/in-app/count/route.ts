import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthUser } from '@/lib/auth-helpers';

// GET: Return unread notification count (lightweight endpoint for polling)
export async function GET() {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ unreadCount: 0 });
  }

  try {
    const { count, error } = await createAdminClient()
      .from('in_app_notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('read', false);

    if (error) throw error;

    return NextResponse.json({ unreadCount: count ?? 0 });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    return NextResponse.json({ unreadCount: 0 });
  }
}
