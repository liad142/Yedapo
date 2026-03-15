import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth-helpers';
import { createAdminClient } from '@/lib/supabase/admin';
import { importYouTubeVideo } from '@/lib/youtube/video-import';
import { requestYouTubeSummary } from '@/lib/youtube/summary';
import { createLogger } from '@/lib/logger';
import type { SummaryLevel } from '@/types/database';

const log = createLogger('youtube');

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { videoId } = await params;
  const body = await request.json();
  const {
    level = 'quick',
    title,
    description,
    channelId,
    channelTitle,
    thumbnailUrl,
    publishedAt,
  } = body;

  try {
    const supabase = createAdminClient();
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

    // Check if episode already exists for this video
    const { data: existingEpisode } = await supabase
      .from('episodes')
      .select('id, podcast_id')
      .eq('audio_url', videoUrl)
      .single();

    let episodeId: string;
    let podcastId: string;
    let isNew = false;

    if (existingEpisode) {
      episodeId = existingEpisode.id;
      podcastId = existingEpisode.podcast_id;

      // If quick summary already exists and is ready, skip generation entirely
      const { data: existingQuick } = await supabase
        .from('summaries')
        .select('status')
        .eq('episode_id', episodeId)
        .eq('level', 'quick')
        .eq('language', 'en')
        .single();

      if (existingQuick?.status === 'ready') {
        return NextResponse.json({
          episodeId,
          podcastId,
          isNew: false,
          summary: { status: 'ready' },
        });
      }
    } else {
      // New video — need channel info for import
      // Try to resolve missing channelId/channelTitle from our DB
      let resolvedChannelId = channelId;
      let resolvedChannelTitle = channelTitle;

      // Resolve channel info from our DB if missing
      // Note: channelId may be a YouTube channel ID (UCxxx) OR an internal UUID (from feed_items.source_id)
      if (!resolvedChannelId || !resolvedChannelTitle) {
        // Try looking up from feed_items by video_id first
        const { data: feedItem } = await supabase
          .from('feed_items')
          .select('source_id')
          .eq('video_id', videoId)
          .eq('source_type', 'youtube')
          .limit(1)
          .single();

        const lookupId = resolvedChannelId || feedItem?.source_id;

        if (lookupId) {
          // Try by internal UUID first, then by YouTube channel_id
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
      episodeId = imported.episodeId;
      podcastId = imported.podcastId;
      isNew = imported.isNew;
    }

    // Request summary
    const result = await requestYouTubeSummary(
      episodeId,
      videoId,
      level as SummaryLevel
    );

    // Record user ownership so this shows on the Summaries page
    const { data: summaryRow } = await supabase
      .from('summaries')
      .select('id')
      .eq('episode_id', episodeId)
      .eq('level', level)
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (summaryRow) {
      await supabase
        .from('user_summaries')
        .upsert({
          user_id: user.id,
          summary_id: summaryRow.id,
          episode_id: episodeId,
        }, { onConflict: 'user_id,summary_id', ignoreDuplicates: true });
    }

    return NextResponse.json({
      episodeId,
      podcastId,
      isNew,
      summary: result,
    });
  } catch (err) {
    log.error(`Error for video ${videoId}`, err);
    return NextResponse.json(
      { error: 'Failed to process video summary' },
      { status: 500 }
    );
  }
}
