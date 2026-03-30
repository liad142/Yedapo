import { createAdminClient } from '@/lib/supabase/admin';

interface VideoImportData {
  videoId: string;
  title: string;
  description?: string;
  channelId: string;
  channelTitle: string;
  thumbnailUrl?: string;
  publishedAt?: string;
}

/**
 * Import a YouTube video into the episodes/podcasts tables.
 *
 * YouTube channel → stored as a `podcast` row with rss_feed_url = 'youtube:channel:{channelId}'
 * YouTube video → stored as an `episode` row with audio_url = YouTube watch URL
 */
export async function importYouTubeVideo(video: VideoImportData): Promise<{
  episodeId: string;
  podcastId: string;
  isNew: boolean;
}> {
  const supabase = createAdminClient();

  // Upsert the YouTube channel as a "podcast"
  const channelFeedUrl = `youtube:channel:${video.channelId}`;

  // Look up channel thumbnail from youtube_channels (authoritative source)
  let channelThumbnail = video.thumbnailUrl || null;
  const { data: ytChannel } = await supabase
    .from('youtube_channels')
    .select('thumbnail_url')
    .eq('channel_id', video.channelId)
    .single();
  if (ytChannel?.thumbnail_url) {
    channelThumbnail = ytChannel.thumbnail_url;
  }

  const { data: existingPodcast } = await supabase
    .from('podcasts')
    .select('id, image_url')
    .eq('rss_feed_url', channelFeedUrl)
    .single();

  let podcastId: string;

  if (existingPodcast) {
    podcastId = existingPodcast.id;

    // Sync channel thumbnail to podcast image_url if missing
    if (channelThumbnail && !existingPodcast.image_url) {
      await supabase
        .from('podcasts')
        .update({ image_url: channelThumbnail })
        .eq('id', podcastId);
    }
  } else {
    const { data: newPodcast, error: podcastError } = await supabase
      .from('podcasts')
      .insert({
        title: video.channelTitle,
        rss_feed_url: channelFeedUrl,
        image_url: channelThumbnail,
        language: 'en',
      })
      .select('id')
      .single();

    if (podcastError || !newPodcast) {
      throw new Error(`Failed to create podcast for channel: ${podcastError?.message}`);
    }
    podcastId = newPodcast.id;
  }

  // Check if episode already exists
  const videoUrl = `https://www.youtube.com/watch?v=${video.videoId}`;
  const { data: existingEpisode } = await supabase
    .from('episodes')
    .select('id')
    .eq('podcast_id', podcastId)
    .eq('audio_url', videoUrl)
    .single();

  if (existingEpisode) {
    return { episodeId: existingEpisode.id, podcastId, isNew: false };
  }

  // Create new episode
  const { data: newEpisode, error: episodeError } = await supabase
    .from('episodes')
    .insert({
      podcast_id: podcastId,
      title: video.title,
      description: video.description || null,
      audio_url: videoUrl,
      published_at: video.publishedAt || null,
    })
    .select('id')
    .single();

  if (episodeError || !newEpisode) {
    throw new Error(`Failed to create episode: ${episodeError?.message}`);
  }

  return { episodeId: newEpisode.id, podcastId, isNew: true };
}
