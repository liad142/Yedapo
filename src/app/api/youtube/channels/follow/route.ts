/**
 * POST /api/youtube/channels/follow
 * Follow a YouTube channel by URL, channel ID, or handle.
 * Accepts either { input } (legacy RSSHub path) or { channelId, title, thumbnailUrl, description }
 * for direct follow from the browse page.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  fetchYouTubeChannelFeed,
  parseYouTubeInput,
  checkRateLimit,
} from '@/lib/rsshub';
import {
  upsertYouTubeChannel,
  followYouTubeChannel,
  upsertFeedItems,
} from '@/lib/rsshub-db';
import { getAuthUser } from '@/lib/auth-helpers';

export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();

    // Rate limiting
    if (!(await checkRateLimit(user.id, 10, 60))) {
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

    // Try RSSHub first, fall back to direct upsert
    let dbChannel;
    let videosAdded = 0;

    try {
      const { channel, videos } = await fetchYouTubeChannelFeed(parsed.value);

      dbChannel = await upsertYouTubeChannel({
        channelId: channel.channelId,
        channelName: channel.channelName,
        channelUrl: channel.channelUrl,
        channelHandle: channel.channelHandle,
        thumbnailUrl: channel.thumbnailUrl,
        description: channel.description,
      });

      await upsertFeedItems(
        videos.map((video) => ({
          sourceType: 'youtube' as const,
          sourceId: dbChannel.id,
          title: video.title,
          description: video.description,
          thumbnailUrl: video.thumbnailUrl,
          publishedAt: video.publishedAt,
          duration: video.duration,
          url: video.url,
          videoId: video.videoId,
          userId: user.id,
        }))
      );
      videosAdded = videos.length;
    } catch (rsshubError) {
      console.warn('RSSHub unavailable, falling back to direct follow:', rsshubError);
      // Fallback: just upsert the channel without feed items
      dbChannel = await upsertYouTubeChannel({
        channelId: parsed.value,
        channelName: parsed.value, // Will be updated when channel page is visited
        channelUrl: `https://www.youtube.com/channel/${parsed.value}`,
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
