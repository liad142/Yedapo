import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthUser } from '@/lib/auth-helpers';

export async function GET() {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();

  // Fetch telegram connection
  const { data: telegramRow } = await admin
    .from('telegram_connections')
    .select('telegram_username')
    .eq('user_id', user.id)
    .maybeSingle();

  // Fetch podcast subscriptions with notifications enabled, joined with podcasts
  const { data: subs } = await admin
    .from('podcast_subscriptions')
    .select('podcast_id, notify_enabled, notify_channels, podcasts(title, image_url)')
    .eq('user_id', user.id)
    .eq('notify_enabled', true);

  // Fetch YouTube channel follows with notifications enabled
  const { data: ytFollows } = await admin
    .from('youtube_channel_follows')
    .select('channel_id, notify_enabled, notify_channels, podcasts(title, image_url)')
    .eq('user_id', user.id)
    .eq('notify_enabled', true);

  const connections = {
    email: {
      address: user.email || null,
      verified: !!user.email_confirmed_at,
    },
    telegram: {
      connected: !!telegramRow,
      username: telegramRow?.telegram_username || null,
    },
  };

  const subscriptions = [
    ...(subs || []).map((s: Record<string, unknown>) => {
      const podcast = s.podcasts as { title: string; image_url: string | null } | null;
      return {
        podcastId: s.podcast_id as string,
        podcastTitle: podcast?.title || 'Unknown',
        podcastArtwork: podcast?.image_url || null,
        notifyEnabled: s.notify_enabled as boolean,
        notifyChannels: (s.notify_channels as string[]) || [],
      };
    }),
    ...(ytFollows || []).map((f: Record<string, unknown>) => {
      const podcast = f.podcasts as { title: string; image_url: string | null } | null;
      return {
        podcastId: f.channel_id as string,
        podcastTitle: podcast?.title || 'Unknown',
        podcastArtwork: podcast?.image_url || null,
        notifyEnabled: f.notify_enabled as boolean,
        notifyChannels: (f.notify_channels as string[]) || [],
      };
    }),
  ];

  return NextResponse.json({ connections, subscriptions });
}
