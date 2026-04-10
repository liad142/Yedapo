import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCached, deleteCached } from '@/lib/cache';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;

/** Short one-way fingerprint of a secret, safe to return in diagnostic responses. */
function fingerprint(value: string | null | undefined): string {
  if (!value) return 'none';
  return crypto.createHash('sha256').update(value).digest('hex').slice(0, 12);
}

export async function POST(request: NextRequest) {
  try {
    // Verify webhook secret via header (not query params, to avoid logging)
    const secret = request.headers.get('x-telegram-bot-api-secret-token');
    if (!TELEGRAM_WEBHOOK_SECRET || secret !== TELEGRAM_WEBHOOK_SECRET) {
      // TEMPORARY DEBUG — remove once Telegram connect is verified working.
      // Only responds with diagnostic info when a specific probe header is set,
      // so normal attackers just see a plain 403.
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

    const update = await request.json();

    // Only handle messages with /start command
    const message = update?.message;
    if (!message?.text?.startsWith('/start ')) {
      return NextResponse.json({ ok: true });
    }

    const token = message.text.slice('/start '.length).trim();
    if (!token) {
      return NextResponse.json({ ok: true });
    }

    // Look up token in Redis (set during connect flow) — prevents forged tokens
    const userId = await getCached<string>(`telegram:connect:${token}`);
    if (!userId) {
      return NextResponse.json({ ok: true });
    }
    await deleteCached(`telegram:connect:${token}`);

    const chatId = String(message.chat.id);
    const username = message.from?.username || null;

    // Save or update the telegram connection
    const supabase = createAdminClient();
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
      console.error('Failed to save Telegram connection:', upsertError);
      return NextResponse.json({ ok: true });
    }

    // Send welcome message back to the user
    if (TELEGRAM_BOT_TOKEN) {
      await fetch(
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
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Telegram webhook error:', error);
    return NextResponse.json({ ok: true });
  }
}
