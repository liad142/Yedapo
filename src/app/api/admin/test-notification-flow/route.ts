import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/admin';
import { buildShareContent } from '@/lib/notifications/format-message';
import { sendSummaryEmail } from '@/lib/notifications/send-email';
import { sendTelegramMessage } from '@/lib/notifications/send-telegram';

/**
 * POST /api/admin/test-notification-flow
 *
 * End-to-end test of the notification delivery pipeline.
 * Simulates what happens when a cron job detects a new episode and the summary is ready.
 *
 * Steps:
 * 1. Picks a recent ready episode (or uses provided episodeId)
 * 2. Finds the current user's notification subscriptions + channels
 * 3. Builds the email/telegram content
 * 4. Sends via all configured channels
 * 5. Returns detailed trace of each step
 *
 * Body (optional):
 *   { episodeId?: string }
 */
export async function POST(request: NextRequest) {
  const { user, error } = await requireAdmin();
  if (error) return error;
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createAdminClient();
  const trace: { step: string; status: string; detail?: unknown }[] = [];

  try {
    const body = await request.json().catch(() => ({}));

    // Step 1: Find an episode with a ready summary
    let episodeId = body.episodeId;
    if (!episodeId) {
      const { data: summaries } = await supabase
        .from('summaries')
        .select('episode_id, level, status, episodes(title)')
        .eq('status', 'ready')
        .in('level', ['deep', 'quick'])
        .order('updated_at', { ascending: false })
        .limit(1);

      if (!summaries?.length) {
        return NextResponse.json({ error: 'No ready summaries found to test with', trace }, { status: 404 });
      }
      episodeId = summaries[0].episode_id;
      const ep = summaries[0].episodes as unknown as { title: string } | null;
      trace.push({ step: '1_find_episode', status: 'ok', detail: { episodeId, title: ep?.title } });
    } else {
      trace.push({ step: '1_find_episode', status: 'ok', detail: { episodeId, source: 'provided' } });
    }

    // Step 2: Get user's notification channels from their subscriptions
    const { data: podcastSubs } = await supabase
      .from('podcast_subscriptions')
      .select('podcast_id, notify_enabled, notify_channels')
      .eq('user_id', user.id)
      .eq('notify_enabled', true);

    const { data: ytFollows } = await supabase
      .from('youtube_channel_follows')
      .select('channel_id, notify_enabled, notify_channels')
      .eq('user_id', user.id)
      .eq('notify_enabled', true);

    const allChannels = new Set<string>();
    [...(podcastSubs || []), ...(ytFollows || [])].forEach(s => {
      ((s.notify_channels as string[]) || []).forEach(ch => allChannels.add(ch));
    });

    // Always include email for the test
    if (allChannels.size === 0) allChannels.add('email');

    trace.push({
      step: '2_resolve_channels',
      status: 'ok',
      detail: {
        podcastSubs: podcastSubs?.length || 0,
        ytFollows: ytFollows?.length || 0,
        channels: [...allChannels],
        email: user.email,
      },
    });

    // Step 3: Build notification content
    let content;
    try {
      content = await buildShareContent(episodeId);
      trace.push({
        step: '3_build_content',
        status: 'ok',
        detail: {
          episodeTitle: content.episodeTitle,
          podcastTitle: content.podcastTitle,
          hasHookHeadline: !!content.hookHeadline,
          highlightCount: content.highlights?.length || 0,
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to build content';
      trace.push({ step: '3_build_content', status: 'failed', detail: { error: msg } });
      return NextResponse.json({ error: msg, trace }, { status: 500 });
    }

    // Step 4: Send via each channel
    const results: { channel: string; success: boolean; error?: string }[] = [];

    if (allChannels.has('email') && user.email) {
      const emailResult = await sendSummaryEmail(user.email, content);
      results.push({ channel: 'email', ...emailResult });
    }

    if (allChannels.has('telegram')) {
      const { data: tgConn } = await supabase
        .from('telegram_connections')
        .select('telegram_chat_id')
        .eq('user_id', user.id)
        .single();

      if (tgConn) {
        const tgResult = await sendTelegramMessage(tgConn.telegram_chat_id, content);
        results.push({ channel: 'telegram', ...tgResult });
      } else {
        results.push({ channel: 'telegram', success: false, error: 'No Telegram connected' });
      }
    }

    if (allChannels.has('in_app')) {
      results.push({ channel: 'in_app', success: true, error: 'In-app notifications are passive (no push needed)' });
    }

    trace.push({
      step: '4_send_notifications',
      status: results.every(r => r.success) ? 'ok' : 'partial',
      detail: results,
    });

    // Step 5: Summary
    const sent = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    trace.push({
      step: '5_summary',
      status: failed === 0 ? 'ok' : 'partial',
      detail: {
        totalChannels: results.length,
        sent,
        failed,
        message: `Sent ${sent}/${results.length} notifications for "${content.episodeTitle}"`,
      },
    });

    return NextResponse.json({
      success: failed === 0,
      message: `Sent ${sent}/${results.length} notifications for "${content.episodeTitle}"`,
      trace,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unexpected error';
    trace.push({ step: 'error', status: 'failed', detail: { error: msg } });
    return NextResponse.json({ error: msg, trace }, { status: 500 });
  }
}
