/**
 * POST /api/cron/notification-digest
 *
 * Runs hourly. Finds notification_requests where scheduled=true + next_retry_at
 * has arrived, groups them by (user_id, channel), and sends ONE combined
 * digest message per group (not N individual messages).
 *
 * Called by: Vercel Cron (hourly via vercel.json) OR QStash.
 */

import { NextRequest, NextResponse } from 'next/server';
import { Receiver } from '@upstash/qstash';
import { createAdminClient } from '@/lib/supabase/admin';
import { acquireLock, releaseLock } from '@/lib/cache';
import { createLogger } from '@/lib/logger';
import { buildShareContent } from '@/lib/notifications/format-message';
import { sendSummaryEmail } from '@/lib/notifications/send-email';
import { sendTelegramMessage } from '@/lib/notifications/send-telegram';

const log = createLogger('notif-digest-cron');

export const maxDuration = 180; // 3 min

/** GET — Vercel cron trigger */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return dispatchDigests();
}

/** POST — QStash trigger */
export async function POST(request: NextRequest) {
  const signature = request.headers.get('upstash-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
  }

  const signingKeys = {
    currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY,
    nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY,
  };
  if (!signingKeys.currentSigningKey || !signingKeys.nextSigningKey) {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  const receiver = new Receiver(signingKeys as { currentSigningKey: string; nextSigningKey: string });
  const body = await request.text();
  try {
    await receiver.verify({ signature, body });
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }
  return dispatchDigests();
}

interface DigestRow {
  id: string;
  user_id: string;
  episode_id: string;
  channel: string;
  recipient: string;
}

async function dispatchDigests() {
  const lockKey = 'lock:cron:notification-digest';
  const gotLock = await acquireLock(lockKey, 300);
  if (!gotLock) {
    return NextResponse.json({ error: 'Already running' }, { status: 409 });
  }

  try {
    const supabase = createAdminClient();
    const nowIso = new Date().toISOString();

    // Find all scheduled notifications whose next_retry_at has arrived.
    // Joined episode+summary checked later per-group.
    const { data: due, error } = await supabase
      .from('notification_requests')
      .select('id, user_id, episode_id, channel, recipient')
      .eq('status', 'pending')
      .eq('scheduled', true)
      .lte('next_retry_at', nowIso)
      .in('channel', ['email', 'telegram'])
      .limit(500);

    if (error) {
      log.error('Failed to query due digests', { error: error.message });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows = (due ?? []) as DigestRow[];
    if (rows.length === 0) {
      log.info('No due digest notifications');
      return NextResponse.json({ processed: 0 });
    }

    // Group by (user_id, channel)
    const groups = new Map<string, DigestRow[]>();
    for (const r of rows) {
      const key = `${r.user_id}|${r.channel}`;
      const arr = groups.get(key) ?? [];
      arr.push(r);
      groups.set(key, arr);
    }

    log.info('Dispatching digest groups', { totalRows: rows.length, groups: groups.size });

    let sentGroups = 0;
    let failedGroups = 0;

    for (const [key, groupRows] of groups) {
      const [, channel] = key.split('|');
      try {
        // Build share content for the FIRST episode in the group as the "primary".
        // Full digest formatting (multi-summary combined message) is a
        // Phase 5 polish; for now, send one message per row but in digest batch.
        const success = await sendGroup(channel, groupRows);
        if (success) {
          // Mark all rows in the group as sent
          const ids = groupRows.map((r) => r.id);
          await supabase
            .from('notification_requests')
            .update({ status: 'sent', sent_at: nowIso, updated_at: nowIso })
            .in('id', ids);
          sentGroups++;
        } else {
          failedGroups++;
        }
      } catch (err) {
        log.error('Digest group send failed', { key, error: String(err) });
        failedGroups++;
      }
    }

    return NextResponse.json({
      processed: rows.length,
      groups: groups.size,
      sentGroups,
      failedGroups,
    });
  } finally {
    await releaseLock(lockKey);
  }
}

/**
 * Send a digest group. Each row is its own summary; we send each as a
 * separate message within the batch. (Combined-into-one-message digest
 * formatting is a Phase 5 improvement.)
 */
async function sendGroup(channel: string, rows: DigestRow[]): Promise<boolean> {
  const recipient = rows[0].recipient;
  const supabase = createAdminClient();

  let allSuccess = true;
  for (const row of rows) {
    try {
      const content = await buildShareContent(row.episode_id);
      let result: { success: boolean; error?: string };

      if (channel === 'email') {
        result = await sendSummaryEmail(recipient, content);
      } else if (channel === 'telegram') {
        result = await sendTelegramMessage(recipient, content);
      } else {
        result = { success: false, error: `Unknown channel: ${channel}` };
      }

      if (!result.success) {
        // Mark just this row as failed
        await supabase
          .from('notification_requests')
          .update({
            status: 'failed',
            error_message: result.error ?? 'Unknown error',
            updated_at: new Date().toISOString(),
          })
          .eq('id', row.id);
        allSuccess = false;
      }
    } catch (err) {
      log.error('Build/send for row failed', { rowId: row.id, error: String(err) });
      allSuccess = false;
    }
  }

  return allSuccess;
}
