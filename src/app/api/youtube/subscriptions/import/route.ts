import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth-helpers';
import { upsertYouTubeChannel, followYouTubeChannel, upsertFeedItems } from '@/lib/rsshub-db';
import { fetchChannelVideos } from '@/lib/youtube/api';
import { createAdminClient } from '@/lib/supabase/admin';
import { createLogger } from '@/lib/logger';

const log = createLogger('yt-import');

export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const channels: Array<{
    channelId: string;
    title: string;
    description?: string;
    thumbnailUrl?: string;
  }> = body.channels;

  if (!channels || channels.length === 0) {
    return NextResponse.json({ error: 'No channels provided' }, { status: 400 });
  }

  log.info('Starting import', { channelCount: channels.length, userId: user.id.slice(0, 8) });

  const imported: string[] = [];
  const errors: string[] = [];

  for (const channel of channels) {
    try {
      log.info('Importing channel', { title: channel.title, channelId: channel.channelId });
      // Upsert the channel
      const dbChannel = await upsertYouTubeChannel({
        channelId: channel.channelId,
        channelName: channel.title,
        channelUrl: `https://www.youtube.com/channel/${channel.channelId}`,
        thumbnailUrl: channel.thumbnailUrl,
        description: channel.description,
      });

      // Follow the channel (uses DB row UUID, not YouTube channel ID)
      await followYouTubeChannel(user.id, dbChannel.id);

      // Fetch recent videos
      const videos = await fetchChannelVideos(channel.channelId, 5);
      log.info('Fetched videos', { count: videos.length, channel: channel.title });

      if (videos.length > 0) {
        await upsertFeedItems(
          videos.map((v) => ({
            sourceType: 'youtube' as const,
            sourceId: dbChannel.id,
            title: v.title,
            description: v.description,
            thumbnailUrl: v.thumbnailUrl,
            publishedAt: new Date(v.publishedAt),
            url: `https://www.youtube.com/watch?v=${v.videoId}`,
            videoId: v.videoId,
            userId: user.id,
          }))
        );
      }

      imported.push(channel.channelId);
    } catch (err) {
      log.error('Failed to import channel', { channelId: channel.channelId, error: String(err) });
      errors.push(channel.channelId);
    }
  }

  // Mark youtube as imported in user profile
  try {
    const admin = createAdminClient();
    await admin
      .from('user_profiles')
      .update({ youtube_imported: true })
      .eq('id', user.id);
  } catch (err) {
    log.error('Failed to update youtube_imported flag', err);
  }

  log.success('Import done', { imported: imported.length, errors: errors.length });

  return NextResponse.json({
    imported: imported.length,
    errors: errors.length,
    importedChannels: imported,
    failedChannels: errors,
  });
}
