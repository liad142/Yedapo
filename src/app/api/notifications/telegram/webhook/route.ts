import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCached, deleteCached } from '@/lib/cache';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;

export async function POST(request: NextRequest) {
  try {
    // Verify webhook secret via header (not query params, to avoid logging)
    const secret = request.headers.get('x-telegram-bot-api-secret-token');
    if (!TELEGRAM_WEBHOOK_SECRET || secret !== TELEGRAM_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const update = await request.json();

    // Only handle messages starting with /start (with or without payload)
    const message = update?.message;
    const text: string | undefined = message?.text;
    if (!text || (text !== '/start' && !text.startsWith('/start '))) {
      return NextResponse.json({ ok: true });
    }

    // Extract token payload. Bare "/start" (no payload) sends a help message
    // pointing the user back to the Connect flow in the app.
    const token = text === '/start' ? '' : text.slice('/start '.length).trim();
    if (!token) {
      if (TELEGRAM_BOT_TOKEN && message?.chat?.id) {
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: message.chat.id,
            text: 'Hi! To connect this Telegram account, open Yedapo → Settings → Connections → Telegram → Connect, and follow the link from there.',
          }),
        }).catch(() => {});
      }
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

    const supabase = createAdminClient();

    // Telegram's chat_id belongs to the physical Telegram account, so if a
    // row already exists for this chat under a DIFFERENT Yedapo user_id, it's
    // a stale connection from a prior account — transfer ownership. Without
    // this, the upsert below would hit the UNIQUE(telegram_chat_id) constraint
    // and fail silently.
    const { data: existingForChat } = await supabase
      .from('telegram_connections')
      .select('user_id')
      .eq('telegram_chat_id', chatId)
      .maybeSingle();

    if (existingForChat && existingForChat.user_id !== userId) {
      const { error: delError } = await supabase
        .from('telegram_connections')
        .delete()
        .eq('telegram_chat_id', chatId);
      if (delError) {
        console.error('Failed to clear stale Telegram connection:', delError);
        return NextResponse.json({ ok: true });
      }
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
      console.error('Failed to save Telegram connection:', upsertError);
      return NextResponse.json({ ok: true });
    }

    // Send welcome message back to the user
    if (TELEGRAM_BOT_TOKEN) {
      await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: 'Connected to Yedapo! You will receive episode summary notifications here.',
        }),
      }).catch(() => {});
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Telegram webhook error:', error);
    return NextResponse.json({ ok: true });
  }
}
