import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCached, setCached, deleteCached } from '@/lib/cache';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;

/**
 * TEMPORARY debug trace — records the last webhook invocation to Redis so we
 * can diagnose why Telegram connect isn't completing. Written to key
 * `telegram:webhook:last-trace` with 1-hour TTL. Remove once flow is verified.
 */
type WebhookTrace = {
  at: string;
  secretOk: boolean;
  messageText?: string;
  hasStartPrefix?: boolean;
  tokenFingerprint?: string;
  tokenFoundInRedis?: boolean;
  userId?: string;
  chatId?: string;
  username?: string | null;
  existingRowForChat?: { user_id: string; username: string | null } | null;
  deletedStaleRow?: boolean;
  upsertError?: string | null;
  welcomeSent?: boolean;
  welcomeError?: string | null;
  finalStatus: 'ok' | 'silent_skip' | 'failed';
  silentSkipReason?: string;
};

async function recordTrace(trace: WebhookTrace) {
  try {
    await setCached('telegram:webhook:last-trace', trace, 3600);
  } catch {
    /* ignore — diagnostic only */
  }
}

/** Short one-way fingerprint of a secret, safe to return in diagnostic responses. */
function fingerprint(value: string | null | undefined): string {
  if (!value) return 'none';
  return crypto.createHash('sha256').update(value).digest('hex').slice(0, 12);
}

export async function POST(request: NextRequest) {
  const trace: WebhookTrace = {
    at: new Date().toISOString(),
    secretOk: false,
    finalStatus: 'silent_skip',
  };

  try {
    // Verify webhook secret via header (not query params, to avoid logging)
    const secret = request.headers.get('x-telegram-bot-api-secret-token');
    if (!TELEGRAM_WEBHOOK_SECRET || secret !== TELEGRAM_WEBHOOK_SECRET) {
      // TEMPORARY DEBUG — remove once Telegram connect is verified working.
      if (request.headers.get('x-debug-probe') === 'telegram-config-20260410') {
        return NextResponse.json(
          {
            error: 'Forbidden',
            debug: {
              envSet: !!TELEGRAM_WEBHOOK_SECRET,
              envLength: TELEGRAM_WEBHOOK_SECRET?.length ?? 0,
              envFingerprint: fingerprint(TELEGRAM_WEBHOOK_SECRET),
              headerSet: !!secret,
              headerLength: secret?.length ?? 0,
              headerFingerprint: fingerprint(secret),
              match: !!TELEGRAM_WEBHOOK_SECRET && secret === TELEGRAM_WEBHOOK_SECRET,
            },
          },
          { status: 403 },
        );
      }
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    trace.secretOk = true;
    const update = await request.json();

    // Only handle messages with /start command (with or without payload)
    const message = update?.message;
    const text: string | undefined = message?.text;
    trace.messageText = text ? text.slice(0, 60) : undefined;
    trace.hasStartPrefix = !!text && (text === '/start' || text.startsWith('/start '));

    if (!text || !trace.hasStartPrefix) {
      trace.silentSkipReason = 'not_a_start_command';
      await recordTrace(trace);
      return NextResponse.json({ ok: true });
    }

    // Extract token payload (everything after "/start "). Empty if bare /start.
    const token = text === '/start' ? '' : text.slice('/start '.length).trim();
    trace.tokenFingerprint = token ? fingerprint(token) : 'empty';

    if (!token) {
      // Bare /start — no deep link payload. Tell user to use the Connect link.
      trace.silentSkipReason = 'empty_token';
      trace.finalStatus = 'silent_skip';
      if (TELEGRAM_BOT_TOKEN && message?.chat?.id) {
        try {
          await fetch(
            `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: message.chat.id,
                text: 'Hi! To connect this Telegram account, open Yedapo → Settings → Connections → Telegram → Connect, and follow the link from there.',
              }),
            }
          );
          trace.welcomeSent = true;
        } catch (e) {
          trace.welcomeError = e instanceof Error ? e.message : String(e);
        }
      }
      await recordTrace(trace);
      return NextResponse.json({ ok: true });
    }

    // Look up token in Redis (set during connect flow) — prevents forged tokens
    const userId = await getCached<string>(`telegram:connect:${token}`);
    trace.tokenFoundInRedis = !!userId;
    if (!userId) {
      trace.silentSkipReason = 'token_not_in_redis_or_expired';
      await recordTrace(trace);
      return NextResponse.json({ ok: true });
    }
    await deleteCached(`telegram:connect:${token}`);
    trace.userId = userId.slice(0, 8);

    const chatId = String(message.chat.id);
    const username = message.from?.username || null;
    trace.chatId = chatId;
    trace.username = username;

    const supabase = createAdminClient();

    // Check for an existing row with THIS chat_id owned by a DIFFERENT user.
    // Telegram's chat_id is owned by the physical Telegram account, so if such
    // a row exists it means this user previously connected under a different
    // Yedapo account — transfer ownership to the current user.
    const { data: existingForChat } = await supabase
      .from('telegram_connections')
      .select('user_id, telegram_username')
      .eq('telegram_chat_id', chatId)
      .maybeSingle();

    trace.existingRowForChat = existingForChat
      ? {
          user_id: existingForChat.user_id.slice(0, 8),
          username: existingForChat.telegram_username ?? null,
        }
      : null;

    if (existingForChat && existingForChat.user_id !== userId) {
      // Stale row from a previous account. Delete it so the upsert for the
      // current user can succeed without hitting the UNIQUE(telegram_chat_id)
      // constraint. Safe because possession of the chat_id proves ownership.
      const { error: delError } = await supabase
        .from('telegram_connections')
        .delete()
        .eq('telegram_chat_id', chatId);
      if (delError) {
        trace.upsertError = `delete_stale_failed: ${delError.message}`;
        trace.finalStatus = 'failed';
        await recordTrace(trace);
        return NextResponse.json({ ok: true });
      }
      trace.deletedStaleRow = true;
    }

    // Save or update the telegram connection
    const { error: upsertError } = await supabase
      .from('telegram_connections')
      .upsert(
        {
          user_id: userId,
          telegram_chat_id: chatId,
          telegram_username: username,
          connected_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );

    if (upsertError) {
      trace.upsertError = upsertError.message;
      trace.finalStatus = 'failed';
      console.error('Failed to save Telegram connection:', upsertError);
      await recordTrace(trace);
      return NextResponse.json({ ok: true });
    }

    // Send welcome message back to the user
    if (TELEGRAM_BOT_TOKEN) {
      try {
        const wRes = await fetch(
          `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              text: 'Connected to Yedapo! You will receive episode summary notifications here.',
            }),
          }
        );
        trace.welcomeSent = wRes.ok;
        if (!wRes.ok) {
          const wData = await wRes.json().catch(() => null);
          trace.welcomeError = `sendMessage ${wRes.status}: ${JSON.stringify(wData)}`;
        }
      } catch (e) {
        trace.welcomeError = e instanceof Error ? e.message : String(e);
      }
    }

    trace.finalStatus = 'ok';
    await recordTrace(trace);
    return NextResponse.json({ ok: true });
  } catch (error) {
    trace.finalStatus = 'failed';
    trace.upsertError = error instanceof Error ? error.message : String(error);
    console.error('Telegram webhook error:', error);
    await recordTrace(trace);
    return NextResponse.json({ ok: true });
  }
}
