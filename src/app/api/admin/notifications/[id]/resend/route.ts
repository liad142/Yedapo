import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendSummaryEmail } from '@/lib/notifications/send-email';
import { sendTelegramMessage } from '@/lib/notifications/send-telegram';
import { buildShareContent } from '@/lib/notifications/format-message';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  const admin = createAdminClient();

  // Get the notification request
  const { data: notification, error: fetchError } = await admin
    .from('notification_requests')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError || !notification) {
    return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
  }

  if (notification.status !== 'failed') {
    return NextResponse.json({ error: 'Only failed notifications can be resent' }, { status: 400 });
  }

  // Build content and resend (wrapped in try/catch like the force-send sibling)
  let content;
  try {
    content = await buildShareContent(notification.episode_id);
  } catch (err) {
    return NextResponse.json({ error: `Failed to build content: ${err instanceof Error ? err.message : String(err)}` }, { status: 500 });
  }

  let result: { success: boolean; error?: string };
  if (notification.channel === 'email') {
    result = await sendSummaryEmail(notification.recipient, content);
  } else {
    result = await sendTelegramMessage(notification.recipient, content);
  }

  if (result.success) {
    await admin
      .from('notification_requests')
      .update({ status: 'sent', sent_at: new Date().toISOString(), error_message: null })
      .eq('id', id);
    return NextResponse.json({ success: true });
  }

  await admin
    .from('notification_requests')
    .update({ error_message: result.error, updated_at: new Date().toISOString() })
    .eq('id', id);

  return NextResponse.json({ error: result.error }, { status: 500 });
}
