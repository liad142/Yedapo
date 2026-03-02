import { createAdminClient } from '@/lib/supabase/admin';
import { createLogger } from '@/lib/logger';
import { buildShareContent } from './format-message';
import { sendSummaryEmail } from './send-email';
import { sendTelegramMessage } from './send-telegram';
import type { NotificationChannel } from '@/types/notifications';

const log = createLogger('notifications');

/**
 * Trigger all pending notifications for an episode.
 * Called when a summary status transitions to 'ready'.
 * Each notification is processed independently - one failure won't block others.
 */
export async function triggerPendingNotifications(episodeId: string): Promise<void> {
  const supabase = createAdminClient();

  // Find all pending scheduled notifications for this episode
  const { data: pending, error } = await supabase
    .from('notification_requests')
    .select('*')
    .eq('episode_id', episodeId)
    .eq('status', 'pending')
    .eq('scheduled', true);

  if (error) {
    log.error('Failed to query pending notifications', { episodeId, error: error.message });
    return;
  }

  if (!pending || pending.length === 0) {
    log.info('No pending notifications for episode', { episodeId });
    return;
  }

  log.info('Processing pending notifications', { episodeId, count: pending.length });

  // Build share content once for all notifications
  let content;
  try {
    content = await buildShareContent(episodeId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to build share content';
    log.error('Failed to build share content, marking all as failed', { episodeId, error: msg });

    // Mark all as failed since we can't build the content
    await supabase
      .from('notification_requests')
      .update({
        status: 'failed',
        error_message: msg,
        updated_at: new Date().toISOString(),
      })
      .eq('episode_id', episodeId)
      .eq('status', 'pending')
      .eq('scheduled', true);
    return;
  }

  // Process each notification independently
  for (const notification of pending) {
    try {
      const channel = notification.channel as NotificationChannel;
      let result: { success: boolean; error?: string };

      if (channel === 'email') {
        result = await sendSummaryEmail(notification.recipient, content);
      } else if (channel === 'telegram') {
        result = await sendTelegramMessage(notification.recipient, content);
      } else {
        result = { success: false, error: `Unknown channel: ${channel}` };
      }

      if (result.success) {
        await supabase
          .from('notification_requests')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', notification.id);

        log.success('Notification sent', { id: notification.id, channel });
      } else {
        await supabase
          .from('notification_requests')
          .update({
            status: 'failed',
            error_message: result.error || 'Unknown error',
            updated_at: new Date().toISOString(),
          })
          .eq('id', notification.id);

        log.warn('Notification failed', { id: notification.id, channel, error: result.error });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unexpected error';
      await supabase
        .from('notification_requests')
        .update({
          status: 'failed',
          error_message: msg,
          updated_at: new Date().toISOString(),
        })
        .eq('id', notification.id);

      log.error('Notification error', { id: notification.id, error: msg });
    }
  }

  log.success('Finished processing notifications', { episodeId, processed: pending.length });
}
