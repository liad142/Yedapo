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

  // Cap at 100 channels per import
  const limited = channels.slice(0, 100);

  log.info('Starting import', { channelCount: limited.length, userId: user.id.slice(0, 8) });

  const results = await Promise.allSettled(
    limited.map(async (channel) => {
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
      const { videos } = await fetchChannelVideos(channel.channelId, 5);
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
            duration: v.durationSeconds,
            url: `https://www.youtube.com/watch?v=${v.videoId}`,
            videoId: v.videoId,
            userId: user.id,
          }))
        );
      }

      return channel.channelId;
    })
  );

  const imported: string[] = [];
  const errors: string[] = [];
  results.forEach((result, i) => {
    if (result.status === 'fulfilled') {
      imported.push(result.value);
    } else {
      log.error('Failed to import channel', { channelId: limited[i].channelId, error: String(result.reason) });
      errors.push(limited[i].channelId);
    }
  });

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
