/**
 * POST /api/youtube/refresh
 * Force refresh all followed channels and fetch latest videos.
 *
 * Per-channel 24h cache: first user to hit a stale channel triggers the
 * YouTube API fetch. Subsequent users (or reloads) within 24h skip that
 * channel. This keeps YouTube API quota usage low regardless of traffic.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getFollowedChannels,
  upsertFeedItems,
} from '@/lib/rsshub-db';
import { fetchChannelVideos } from '@/lib/youtube/api';
import { checkRateLimit, CacheKeys, hasCached, setCached } from '@/lib/cache';
import { getAuthUser } from '@/lib/auth-helpers';
import { createLogger } from '@/lib/logger';

const log = createLogger('yt-refresh');

// 24 hours — per-channel refresh cache
const CHANNEL_REFRESH_TTL = 24 * 60 * 60;

export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Rate limiting: 5 req/min per user (safety net against abuse)
    if (!(await checkRateLimit(`yt-refresh:${user.id}`, 5, 60))) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again in a minute.' },
        { status: 429 }
      );
    }

    // Get all followed channels. Defensive filter against rows with missing
    // channelId (would have poisoned the cache with `yt:ch:undefined:refreshed`).
    const allChannels = await getFollowedChannels(user.id);
    const channels = allChannels.filter((ch) => !!ch.channelId);

    if (channels.length < allChannels.length) {
      log.warn('Skipped channels with missing channelId', {
        skipped: allChannels.length - channels.length,
        total: allChannels.length,
      });
    }

    if (channels.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No channels to refresh',
        videosAdded: 0,
        channelsRefreshed: 0,
        channelsSkipped: 0,
      });
    }

    // Check per-channel cache to find which channels need refreshing
    const freshnessChecks = await Promise.all(
      channels.map((ch) => hasCached(CacheKeys.youtubeChannelRefresh(ch.channelId)))
    );

    const staleChannels = channels.filter((_, i) => !freshnessChecks[i]);
    const skippedCount = channels.length - staleChannels.length;

    if (staleChannels.length === 0) {
      log.info('All channels fresh, nothing to refresh', { total: channels.length });
      return NextResponse.json({
        success: true,
        message: 'All channels refreshed recently',
        videosAdded: 0,
        channelsRefreshed: 0,
        channelsSkipped: skippedCount,
      });
    }

    log.info('Refreshing stale channels', {
      stale: staleChannels.length,
      skipped: skippedCount,
      total: channels.length,
    });

    let totalVideosAdded = 0;
    const errors: string[] = [];

    // Refresh only stale channels in parallel via YouTube Data API
    const results = await Promise.allSettled(
      staleChannels.map(async (channel) => {
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
              duration: video.durationSeconds,
              url: `https://www.youtube.com/watch?v=${video.videoId}`,
              videoId: video.videoId,
              userId: user.id,
            }))
          );
        }

        // Mark channel as refreshed — other users (or this user on reload)
        // will skip this channel for 24h.
        await setCached(
          CacheKeys.youtubeChannelRefresh(channel.channelId),
          Date.now(),
          CHANNEL_REFRESH_TTL
        );

        return { channelName: channel.channelName, videosCount: videos.length };
      })
    );

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.status === 'fulfilled') {
        totalVideosAdded += result.value.videosCount;
      } else {
        const channel = staleChannels[i];
        log.error(`Failed to refresh channel ${channel.channelName}`, result.reason);
        errors.push(`${channel.channelName}: ${result.reason instanceof Error ? result.reason.message : 'Unknown error'}`);
      }
    }

    return NextResponse.json({
      success: true,
      channelsRefreshed: staleChannels.length - errors.length,
      channelsSkipped: skippedCount,
      videosAdded: totalVideosAdded,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    log.error('Refresh channels error', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to refresh channels',
      },
      { status: 500 }
    );
  }
}
