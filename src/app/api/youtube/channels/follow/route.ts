/**
 * POST /api/youtube/channels/follow
 * Follow a YouTube channel by URL, channel ID, or handle.
 * Accepts either { input } (legacy path) or { channelId, title, thumbnailUrl, description }
 * for direct follow from the browse page.
 */

import { NextRequest, NextResponse } from 'next/server';
import { parseYouTubeInput } from '@/lib/youtube/utils';
import { fetchChannelVideos } from '@/lib/youtube/api';
import { checkRateLimit } from '@/lib/cache';
import {
  upsertYouTubeChannel,
  followYouTubeChannel,
  upsertFeedItems,
  YouTubeChannel,
} from '@/lib/rsshub-db';
import { getAuthUser } from '@/lib/auth-helpers';

export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();

    // Rate limiting (10 requests per 60 seconds)
    if (!(await checkRateLimit('yt-follow:' + user.id, 10, 60))) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again in a minute.' },
        { status: 429 }
      );
    }

    // Direct follow path: channelId + metadata provided by the browse page
    if (body.channelId && body.title) {
      const dbChannel = await upsertYouTubeChannel({
        channelId: body.channelId,
        channelName: body.title,
        channelUrl: `https://www.youtube.com/channel/${body.channelId}`,
        thumbnailUrl: body.thumbnailUrl || undefined,
        description: body.description || undefined,
      });

      await followYouTubeChannel(user.id, dbChannel.id);

      // Update notification preferences if provided
      if (typeof body.notifyEnabled === 'boolean' || Array.isArray(body.notifyChannels)) {
        const { createAdminClient } = await import('@/lib/supabase/admin');
        const updateData: Record<string, unknown> = {};
        if (typeof body.notifyEnabled === 'boolean') updateData.notify_enabled = body.notifyEnabled;
        if (Array.isArray(body.notifyChannels)) updateData.notify_channels = body.notifyChannels;

        await createAdminClient()
          .from('youtube_channel_follows')
          .update(updateData)
          .eq('user_id', user.id)
          .eq('channel_id', dbChannel.id);
      }

      return NextResponse.json({
        success: true,
        channel: {
          id: dbChannel.id,
          channelId: dbChannel.channelId,
          channelName: dbChannel.channelName,
          channelUrl: dbChannel.channelUrl,
          thumbnailUrl: dbChannel.thumbnailUrl,
        },
      });
    }

    // Legacy path: parse input string (URL, ID, or handle)
    const { input } = body;
    if (!input || typeof input !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid input' },
        { status: 400 }
      );
    }

    const parsed = parseYouTubeInput(input.trim());
    if (parsed.type === 'unknown') {
      return NextResponse.json(
        { error: 'Invalid YouTube channel URL, ID, or handle' },
        { status: 400 }
      );
    }

    // Fetch channel videos via YouTube Data API and upsert
    let dbChannel: YouTubeChannel;
    let videosAdded = 0;
    const channelId = parsed.type === 'channel' ? parsed.value : parsed.value;

    try {
      const { videos } = await fetchChannelVideos(channelId, 15);

      const channelName = videos[0]?.channelTitle || channelId;
      dbChannel = await upsertYouTubeChannel({
        channelId,
        channelName,
        channelUrl: `https://www.youtube.com/channel/${channelId}`,
      });

      if (videos.length > 0) {
        await upsertFeedItems(
          videos.map((video) => ({
            sourceType: 'youtube' as const,
            sourceId: dbChannel.id,
            title: video.title,
            description: video.description,
            thumbnailUrl: video.thumbnailUrl,
            publishedAt: new Date(video.publishedAt),
            url: `https://www.youtube.com/watch?v=${video.videoId}`,
            videoId: video.videoId,
            userId: user.id,
          }))
        );
        videosAdded = videos.length;
      }
    } catch (apiError) {
      console.warn('YouTube API unavailable, falling back to direct follow:', apiError);
      dbChannel = await upsertYouTubeChannel({
        channelId,
        channelName: channelId,
        channelUrl: `https://www.youtube.com/channel/${channelId}`,
      });
    }

    await followYouTubeChannel(user.id, dbChannel.id);

    return NextResponse.json({
      success: true,
      channel: {
        id: dbChannel.id,
        channelId: dbChannel.channelId,
        channelName: dbChannel.channelName,
        channelUrl: dbChannel.channelUrl,
        thumbnailUrl: dbChannel.thumbnailUrl,
      },
      videosAdded,
    });
  } catch (error) {
    console.error('Follow channel error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to follow channel',
      },
      { status: 500 }
    );
  }
}
