import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth-helpers';
import { createAdminClient } from '@/lib/supabase/admin';
import { importYouTubeVideo } from '@/lib/youtube/video-import';
import { fetchVideoDetails } from '@/lib/youtube/api';
import { checkRateLimit } from '@/lib/cache';
import { createLogger } from '@/lib/logger';

const log = createLogger('youtube-import');

/**
 * POST /api/youtube/[videoId]/import
 * Import a YouTube video into the database WITHOUT triggering summarization.
 * Returns the episodeId so the client can add it to the summarize queue.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { videoId } = await params;

  if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) {
    return NextResponse.json({ error: 'Invalid video ID' }, { status: 400 });
  }

  const rlAllowed = await checkRateLimit(`yt-import:${user.id}`, 20, 60);
  if (!rlAllowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

  const body = await request.json();
  const { title, description, channelId, channelTitle, thumbnailUrl, publishedAt } = body;

  try {
    const supabase = createAdminClient();
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

    // Check if episode already exists
    const { data: existingEpisode } = await supabase
      .from('episodes')
      .select('id, podcast_id')
      .eq('audio_url', videoUrl)
      .single();

    if (existingEpisode) {
      return NextResponse.json({
        episodeId: existingEpisode.id,
        podcastId: existingEpisode.podcast_id,
        isNew: false,
      });
    }

    // Resolve channel info
    let resolvedChannelId = channelId;
    let resolvedChannelTitle = channelTitle;

    if (!resolvedChannelId || !resolvedChannelTitle) {
      const { data: feedItem } = await supabase
        .from('feed_items')
        .select('source_id')
        .eq('video_id', videoId)
        .eq('source_type', 'youtube')
        .limit(1)
        .single();

      const lookupId = resolvedChannelId || feedItem?.source_id;

      if (lookupId) {
        const { data: channelById } = await supabase
          .from('youtube_channels')
          .select('channel_id, channel_name')
          .eq('id', lookupId)
          .single();

        if (channelById) {
          resolvedChannelId = channelById.channel_id;
          resolvedChannelTitle = resolvedChannelTitle || channelById.channel_name;
        } else {
          const { data: channelByYtId } = await supabase
            .from('youtube_channels')
            .select('channel_id, channel_name')
            .eq('channel_id', lookupId)
            .single();

          if (channelByYtId) {
            resolvedChannelId = channelByYtId.channel_id;
            resolvedChannelTitle = resolvedChannelTitle || channelByYtId.channel_name;
          }
        }
      }
    }

    if (!resolvedChannelId || !resolvedChannelTitle) {
      const videoDetails = await fetchVideoDetails(videoId);
      if (videoDetails) {
        resolvedChannelId = resolvedChannelId || videoDetails.channelId;
        resolvedChannelTitle = resolvedChannelTitle || videoDetails.channelTitle;
      }
    }

    if (!title || !resolvedChannelId || !resolvedChannelTitle) {
      return NextResponse.json(
        { error: 'Missing required fields: title, channelId, channelTitle' },
        { status: 400 }
      );
    }

    const imported = await importYouTubeVideo({
      videoId,
      title,
      description,
      channelId: resolvedChannelId,
      channelTitle: resolvedChannelTitle,
      thumbnailUrl,
      publishedAt,
    });

    log.info('Video imported', { videoId, episodeId: imported.episodeId, isNew: imported.isNew });

    return NextResponse.json({
      episodeId: imported.episodeId,
      podcastId: imported.podcastId,
      isNew: imported.isNew,
    });
  } catch (err) {
    log.error(`Import error for video ${videoId}`, err);
    return NextResponse.json({ error: 'Failed to import video' }, { status: 500 });
  }
}
