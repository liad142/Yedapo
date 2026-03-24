/**
 * POST /api/youtube/refresh
 * Force refresh all followed channels and fetch latest videos
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getFollowedChannels,
  upsertFeedItems,
} from '@/lib/rsshub-db';
import { fetchChannelVideos } from '@/lib/youtube/api';
import { checkRateLimit } from '@/lib/cache';
import { getAuthUser } from '@/lib/auth-helpers';

export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Rate limiting
    if (!(await checkRateLimit(user.id, 5, 60))) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again in a minute.' },
        { status: 429 }
      );
    }

    // Get all followed channels
    const channels = await getFollowedChannels(user.id);

    if (channels.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No channels to refresh',
        videosAdded: 0,
      });
    }

    let totalVideosAdded = 0;
    const errors: string[] = [];

    // Refresh all channels in parallel via YouTube Data API
    const results = await Promise.allSettled(
      channels.map(async (channel) => {
        const { videos } = await fetchChannelVideos(channel.channelId, 15);

        if (videos.length > 0) {
          await upsertFeedItems(
            videos.map((video) => ({
              sourceType: 'youtube' as const,
              sourceId: channel.id,
              title: video.title,
              description: video.description,
              thumbnailUrl: video.thumbnailUrl,
              publishedAt: new Date(video.publishedAt),
              url: `https://www.youtube.com/watch?v=${video.videoId}`,
              videoId: video.videoId,
              userId: user.id,
            }))
          );
        }

        return { channelName: channel.channelName, videosCount: videos.length };
      })
    );

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.status === 'fulfilled') {
        totalVideosAdded += result.value.videosCount;
      } else {
        const channel = channels[i];
        console.error(`Failed to refresh channel ${channel.channelName}:`, result.reason);
        errors.push(`${channel.channelName}: ${result.reason instanceof Error ? result.reason.message : 'Unknown error'}`);
      }
    }

    return NextResponse.json({
      success: true,
      channelsRefreshed: channels.length - errors.length,
      videosAdded: totalVideosAdded,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Refresh channels error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to refresh channels',
      },
      { status: 500 }
    );
  }
}
