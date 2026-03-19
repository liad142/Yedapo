import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth-helpers';
import { createAdminClient } from '@/lib/supabase/admin';
import { buildShareContent } from '@/lib/notifications/format-message';
import { sendSummaryEmail } from '@/lib/notifications/send-email';
import { sendTelegramMessage } from '@/lib/notifications/send-telegram';
import { checkRateLimit } from '@/lib/cache';
import type { SendNotificationPayload, NotificationChannel } from '@/types/notifications';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate limit: 5 requests/min per user
    const rlAllowed = await checkRateLimit(`notification-send:${user.id}`, 5, 60);
    if (!rlAllowed) {
      return NextResponse.json({ error: 'Too many notification requests' }, { status: 429 });
    }

    const body: SendNotificationPayload = await request.json();
    const { episodeId, channel, recipient, scheduled } = body;

    // Validate required fields (recipient is optional for telegram - resolved from connection)
    if (!episodeId || !channel) {
      return NextResponse.json(
        { error: 'Missing required fields: episodeId, channel' },
        { status: 400 }
      );
    }
    if (channel === 'email' && !recipient) {
      return NextResponse.json(
        { error: 'Recipient email is required' },
        { status: 400 }
      );
    }

    // Validate channel
    if (channel !== 'email' && channel !== 'telegram') {
      return NextResponse.json(
        { error: 'Invalid channel. Must be "email" or "telegram".' },
        { status: 400 }
      );
    }

    // Validate recipient
    if (channel === 'email' && !EMAIL_REGEX.test(recipient)) {
      return NextResponse.json(
        { error: 'Invalid email address' },
        { status: 400 }
      );
    }

    // Enforce email recipient matches user's own email
    if (channel === 'email') {
      if (!user.email) {
        return NextResponse.json({ error: 'No email on account' }, { status: 400 });
      }
      if (recipient.toLowerCase() !== user.email.toLowerCase()) {
        return NextResponse.json({ error: 'Can only send to your own email' }, { status: 403 });
      }
    }

    const supabase = createAdminClient();

    // For telegram: resolve chat_id from telegram_connections if not provided
    let resolvedRecipient = recipient;
    if (channel === 'telegram') {
      if (!recipient || recipient.trim().length === 0) {
        const { data: connection } = await supabase
          .from('telegram_connections')
          .select('telegram_chat_id')
          .eq('user_id', user.id)
          .single();

        if (!connection) {
          return NextResponse.json(
            { error: 'No Telegram account connected. Please connect Telegram first.' },
            { status: 400 }
          );
        }
        resolvedRecipient = connection.telegram_chat_id;
      }
    }

    // Check if this should be sent immediately or scheduled
    let shouldSchedule = scheduled === true;

    if (!shouldSchedule) {
      // Check if a summary is ready
      const { data: summaries } = await supabase
        .from('summaries')
        .select('id')
        .eq('episode_id', episodeId)
        .in('level', ['quick', 'deep'])
        .eq('status', 'ready')
        .limit(1);

      if (summaries && summaries.length > 0) {
        // Summary is ready - send immediately
        const content = await buildShareContent(episodeId);
        let sendResult: { success: boolean; error?: string };

        if (channel === 'email') {
          sendResult = await sendSummaryEmail(resolvedRecipient, content);
        } else {
          sendResult = await sendTelegramMessage(resolvedRecipient, content);
        }

        const now = new Date().toISOString();
        const { data: record, error: insertError } = await supabase
          .from('notification_requests')
          .insert({
            user_id: user.id,
            episode_id: episodeId,
            channel,
            recipient: resolvedRecipient,
            scheduled: false,
            status: sendResult.success ? 'sent' : 'failed',
            error_message: sendResult.error || null,
            sent_at: sendResult.success ? now : null,
            created_at: now,
            updated_at: now,
          })
          .select()
          .single();

        if (insertError) {
          console.error('Failed to create notification record:', insertError);
          return NextResponse.json(
            { error: 'Failed to create notification record' },
            { status: 500 }
          );
        }

        return NextResponse.json(record);
      } else {
        // No summary ready - force scheduled mode
        shouldSchedule = true;
      }
    }

    // Create a pending scheduled notification
    const now = new Date().toISOString();
    const { data: record, error: insertError } = await supabase
      .from('notification_requests')
      .insert({
        user_id: user.id,
        episode_id: episodeId,
        channel,
        recipient: resolvedRecipient,
        scheduled: true,
        status: 'pending',
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Failed to create notification record:', insertError);
      return NextResponse.json(
        { error: 'Failed to create notification record' },
        { status: 500 }
      );
    }

    return NextResponse.json(record, { status: 201 });
  } catch (error) {
    console.error('Error sending notification:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
