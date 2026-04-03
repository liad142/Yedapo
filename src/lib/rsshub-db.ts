/**
 * Database functions for RSSHub YouTube integration and podcast feed population
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { fetchPodcastFeed } from '@/lib/rss';
import { getPodcastById } from '@/lib/apple-podcasts';

// Use singleton admin client for connection pooling
function getSupabaseClient() {
  return createAdminClient();
}

export interface YouTubeChannel {
  id: string;
  channelId: string;
  channelName: string;
  channelUrl: string;
  channelHandle?: string;
  thumbnailUrl?: string;
  description?: string;
  subscriberCount?: number;
  videoCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface FeedItem {
  id: string;
  sourceType: 'youtube' | 'podcast';
  sourceId: string;
  title: string;
  description?: string;
  thumbnailUrl?: string;
  publishedAt: string;
  duration?: number;
  url: string;
  videoId?: string;
  episodeId?: string;
  bookmarked: boolean;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Get or create YouTube channel
 */
export async function upsertYouTubeChannel(channelData: {
  channelId: string;
  channelName: string;
  channelUrl: string;
  channelHandle?: string;
  thumbnailUrl?: string;
  description?: string;
}): Promise<YouTubeChannel> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('youtube_channels')
    .upsert(
      {
        channel_id: channelData.channelId,
        channel_name: channelData.channelName,
        channel_url: channelData.channelUrl,
        channel_handle: channelData.channelHandle,
        thumbnail_url: channelData.thumbnailUrl,
        description: channelData.description,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'channel_id' }
    )
    .select()
    .single();

  if (error) throw new Error(`Failed to upsert channel: ${error.message}`);
  return data as YouTubeChannel;
}

/**
 * Follow a YouTube channel
 */
export async function followYouTubeChannel(
  userId: string,
  channelId: string
): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('youtube_channel_follows').insert({
    user_id: userId,
    channel_id: channelId,
  });

  if (error && !error.message.includes('duplicate')) {
    throw new Error(`Failed to follow channel: ${error.message}`);
  }
}

/**
 * Unfollow a YouTube channel
 */
export async function unfollowYouTubeChannel(
  userId: string,
  channelId: string
): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('youtube_channel_follows')
    .delete()
    .eq('user_id', userId)
    .eq('channel_id', channelId);

  if (error) throw new Error(`Failed to unfollow channel: ${error.message}`);
}

/**
 * Get all channels followed by user
 */
export async function getFollowedChannels(
  userId: string
): Promise<YouTubeChannel[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('youtube_channel_follows')
    .select('channel_id, youtube_channels(*)')
    .eq('user_id', userId)
    .order('followed_at', { ascending: false });

  if (error) throw new Error(`Failed to get followed channels: ${error.message}`);

  return (data || []).map((item: any) => item.youtube_channels as YouTubeChannel);
}

/**
 * Check if user follows a channel
 */
export async function isFollowingChannel(
  userId: string,
  channelId: string
): Promise<boolean> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('youtube_channel_follows')
    .select('id')
    .eq('user_id', userId)
    .eq('channel_id', channelId)
    .single();

  return !!data && !error;
}

/**
 * Insert or update feed items (bulk upsert)
 */
export async function upsertFeedItems(items: Array<{
  sourceType: 'youtube' | 'podcast';
  sourceId: string;
  title: string;
  description?: string;
  thumbnailUrl?: string;
  publishedAt: Date;
  duration?: number;
  url: string;
  videoId?: string;
  episodeId?: string;
  userId: string;
}>): Promise<void> {
  const supabase = getSupabaseClient();

  const format = (item: typeof items[0]) => ({
    source_type: item.sourceType,
    source_id: item.sourceId,
    title: item.title,
    description: item.description,
    thumbnail_url: item.thumbnailUrl,
    published_at: item.publishedAt.toISOString(),
    duration: item.duration,
    url: item.url,
    video_id: item.videoId,
    episode_id: item.episodeId,
    user_id: item.userId,
    updated_at: new Date().toISOString(),
  });

  // Split by source type — each uses a different unique constraint
  const youtubeItems = items.filter(i => i.sourceType === 'youtube');
  const podcastItems = items.filter(i => i.sourceType === 'podcast');

  const promises: Promise<void>[] = [];

  if (youtubeItems.length > 0) {
    promises.push(
      Promise.resolve(
        supabase.from('feed_items')
          .upsert(youtubeItems.map(format), { onConflict: 'user_id,source_type,video_id', ignoreDuplicates: false })
      ).then(({ error }) => { if (error) throw new Error(`YouTube upsert failed: ${error.message}`); })
    );
  }

  if (podcastItems.length > 0) {
    promises.push(
      Promise.resolve(
        supabase.from('feed_items')
          .upsert(podcastItems.map(format), { onConflict: 'user_id,source_type,episode_id', ignoreDuplicates: false })
      ).then(({ error }) => { if (error) throw new Error(`Podcast upsert failed: ${error.message}`); })
    );
  }

  await Promise.all(promises);
}

/**
 * Get unified feed with filters
 */
export async function getFeed(params: {
  userId: string;
  sourceType?: 'youtube' | 'podcast' | 'all';
  mode?: 'following' | 'latest' | 'mixed';
  bookmarkedOnly?: boolean;
  limit?: number;
  offset?: number;
}): Promise<FeedItem[]> {
  const supabase = getSupabaseClient();
  const {
    userId,
    sourceType = 'all',
    mode = 'latest',
    bookmarkedOnly = false,
    limit = 20,
    offset = 0,
  } = params;

  let query = supabase
    .from('feed_items')
    .select('*')
    .eq('user_id', userId);

  // Filter by bookmarked
  if (bookmarkedOnly) {
    query = query.eq('bookmarked', true);
  }

  // Mode filtering
  if (mode === 'following') {
    const followedChannels = await getFollowedChannels(userId);
    const channelIds = followedChannels.map((ch) => ch.id);
    if (channelIds.length === 0) return [];
    query = query.in('source_id', channelIds);
  }

  // When filtering by specific type, use simple query
  if (sourceType !== 'all') {
    query = query.eq('source_type', sourceType);
    query = query
      .order('published_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error } = await query;
    if (error) throw new Error(`Failed to get feed: ${error.message}`);
    return (data || []) as FeedItem[];
  }

  // For 'all': interleave content types so one type doesn't dominate
  // Fetch both types separately, then merge by date
  const half = Math.ceil(limit / 2);

  const baseFilters = {
    ...(bookmarkedOnly && { bookmarked: true }),
  };

  const [ytResult, podResult] = await Promise.all([
    supabase
      .from('feed_items')
      .select('*')
      .eq('user_id', userId)
      .eq('source_type', 'youtube')
      .order('published_at', { ascending: false })
      .range(offset > 0 ? Math.floor(offset / 2) : 0, (offset > 0 ? Math.floor(offset / 2) : 0) + half - 1),
    supabase
      .from('feed_items')
      .select('*')
      .eq('user_id', userId)
      .eq('source_type', 'podcast')
      .order('published_at', { ascending: false })
      .range(offset > 0 ? Math.floor(offset / 2) : 0, (offset > 0 ? Math.floor(offset / 2) : 0) + half - 1),
  ]);

  const ytItems = (ytResult.data || []) as FeedItem[];
  const podItems = (podResult.data || []) as FeedItem[];

  // Merge and sort by date, capped at limit
  const merged = [...ytItems, ...podItems]
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .slice(0, limit);

  return merged;
}

/**
 * Set bookmark state on a feed item (atomic, no read-before-write)
 */
export async function setBookmark(
  userId: string,
  feedItemId: string,
  bookmarked: boolean
): Promise<boolean> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('feed_items')
    .update({ bookmarked, updated_at: new Date().toISOString() })
    .eq('id', feedItemId)
    .eq('user_id', userId)
    .select('bookmarked')
    .single();

  if (error) throw new Error(`Failed to set bookmark: ${error.message}`);
  if (!data) throw new Error('Feed item not found or unauthorized');

  return data.bookmarked;
}

/**
 * Toggle bookmark on a feed item
 * @deprecated Prefer setBookmark() to avoid read-before-write race conditions.
 * Kept for backward compatibility.
 */
export async function toggleBookmark(
  userId: string,
  feedItemId: string
): Promise<boolean> {
  const supabase = getSupabaseClient();
  // Get current state
  const { data: item, error: fetchError } = await supabase
    .from('feed_items')
    .select('bookmarked')
    .eq('id', feedItemId)
    .eq('user_id', userId)
    .single();

  if (fetchError || !item) {
    throw new Error('Feed item not found or unauthorized');
  }

  return setBookmark(userId, feedItemId, !item.bookmarked);
}

/**
 * Delete old feed items (cleanup job)
 * Keeps items for 90 days unless bookmarked
 */
export async function cleanupOldFeedItems(): Promise<number> {
  const supabase = getSupabaseClient();
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const { data, error } = await supabase
    .from('feed_items')
    .delete()
    .lt('published_at', ninetyDaysAgo.toISOString())
    .eq('bookmarked', false)
    .select('id');

  if (error) throw new Error(`Failed to cleanup feed items: ${error.message}`);

  return (data || []).length;
}

/**
 * Get YouTube channel by channel_id (not UUID)
 */
export async function getYouTubeChannelByChannelId(
  channelId: string
): Promise<YouTubeChannel | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('youtube_channels')
    .select('*')
    .eq('channel_id', channelId)
    .single();

  if (error || !data) return null;
  return data as YouTubeChannel;
}

/**
 * Resolve the actual RSS feed URL for a podcast.
 * Apple-sourced podcasts store "apple:ID" — resolve via Apple API to get the real feedUrl.
 */
async function resolveRssUrl(rssFieldValue: string): Promise<string | null> {
  if (!rssFieldValue) return null;

  if (rssFieldValue.startsWith('apple:')) {
    const appleId = rssFieldValue.replace('apple:', '');
    const applePodcast = await getPodcastById(appleId);
    return applePodcast?.feedUrl || null;
  }

  return rssFieldValue;
}

/**
 * Fetch RSS episodes and upsert them into episodes + feed_items for a single podcast.
 */
async function populatePodcastFeedItems(
  userId: string,
  podcast: { id: string; rss_feed_url: string; image_url: string | null; title?: string },
): Promise<number> {
  const supabase = getSupabaseClient();

  const rssUrl = await resolveRssUrl(podcast.rss_feed_url);
  if (!rssUrl) {
    console.error(`[feed] Failed to resolve RSS URL for podcast "${podcast.title || podcast.id}" (${podcast.rss_feed_url})`);
    return 0;
  }

  const { episodes } = await fetchPodcastFeed(rssUrl);
  const recentEpisodes = episodes.slice(0, 10);

  // Filter episodes with audio URLs
  const episodesWithAudio = recentEpisodes.filter(ep => ep.audio_url);
  if (episodesWithAudio.length === 0) return 0;

  // Batch lookup: single SELECT for all audio URLs instead of N+1 per-episode queries
  const audioUrls = episodesWithAudio.map(ep => ep.audio_url);
  const { data: existingEpisodes } = await supabase
    .from('episodes')
    .select('id, audio_url')
    .eq('podcast_id', podcast.id)
    .in('audio_url', audioUrls);

  const existingByUrl = new Set((existingEpisodes || []).map(e => e.audio_url));
  const existingIdByUrl = new Map((existingEpisodes || []).map(e => [e.audio_url, e.id]));

  // Bulk insert new episodes that don't exist yet
  const newEpisodes = episodesWithAudio.filter(ep => !existingByUrl.has(ep.audio_url));
  if (newEpisodes.length > 0) {
    const { data: created } = await supabase
      .from('episodes')
      .insert(
        newEpisodes.map(ep => ({
          podcast_id: podcast.id,
          title: ep.title,
          description: ep.description || null,
          audio_url: ep.audio_url,
          duration_seconds: ep.duration_seconds,
          published_at: ep.published_at ? new Date(ep.published_at).toISOString() : new Date().toISOString(),
          transcript_url: ep.transcript_url || null,
        }))
      )
      .select('id, audio_url');

    // Add newly created episodes to the lookup map
    for (const row of created || []) {
      existingIdByUrl.set(row.audio_url, row.id);
    }
  }

  // Build feed items from all episodes (existing + newly created)
  const feedItems = [];
  for (const ep of episodesWithAudio) {
    const episodeId = existingIdByUrl.get(ep.audio_url);
    if (episodeId) {
      feedItems.push({
        sourceType: 'podcast' as const,
        sourceId: podcast.id,
        title: ep.title,
        description: ep.description,
        thumbnailUrl: podcast.image_url || undefined,
        publishedAt: ep.published_at ? new Date(ep.published_at) : new Date(),
        duration: ep.duration_seconds,
        url: ep.audio_url,
        episodeId,
        userId,
      });
    }
  }

  if (feedItems.length > 0) {
    // Wrap in try-catch: feed_items are nice-to-have for the user's feed,
    // but failures (e.g., invalid userId) must NOT crash the entire episode import.
    try {
      await upsertFeedItems(feedItems);
    } catch (err) {
      console.error('Feed items upsert failed (non-fatal):', err instanceof Error ? err.message : err);
    }

    // Update podcasts.latest_episode_date so My List badge works
    const latestDate = feedItems.reduce((max, item) => {
      const d = item.publishedAt instanceof Date ? item.publishedAt : new Date(item.publishedAt);
      return d > max ? d : max;
    }, new Date(0));

    if (latestDate.getTime() > 0) {
      await supabase
        .from('podcasts')
        .update({ latest_episode_date: latestDate.toISOString() })
        .eq('id', podcast.id)
        .or(`latest_episode_date.is.null,latest_episode_date.lt.${latestDate.toISOString()}`);
    }
  }

  return feedItems.length;
}

/**
 * Refresh a single podcast's episodes into feed_items for a user
 */
export async function refreshSinglePodcastFeed(
  userId: string,
  podcastId: string
): Promise<{ episodesAdded: number }> {
  const supabase = getSupabaseClient();

  const { data: podcast } = await supabase
    .from('podcasts')
    .select('id, title, rss_feed_url, image_url')
    .eq('id', podcastId)
    .single();

  if (!podcast?.rss_feed_url) return { episodesAdded: 0 };

  const count = await populatePodcastFeedItems(userId, podcast);
  return { episodesAdded: count };
}

/**
 * Refresh all subscribed podcasts' episodes into feed_items for a user
 */
export async function refreshPodcastFeed(userId: string): Promise<{
  podcastsRefreshed: number;
  episodesAdded: number;
  errors: string[];
}> {
  const supabase = getSupabaseClient();

  const { data: subs } = await supabase
    .from('podcast_subscriptions')
    .select('podcast_id, podcasts(id, title, rss_feed_url, image_url)')
    .eq('user_id', userId);

  if (!subs || subs.length === 0) {
    return { podcastsRefreshed: 0, episodesAdded: 0, errors: [] };
  }

  let totalEpisodes = 0;
  const errors: string[] = [];

  const results = await Promise.allSettled(
    subs.map(async (sub) => {
      const podcast = sub.podcasts as any;
      if (!podcast?.rss_feed_url) return { count: 0 };

      const count = await populatePodcastFeedItems(userId, podcast);
      return { count };
    })
  );

  for (let i = 0; i < results.length; i++) {
    if (results[i].status === 'fulfilled') {
      totalEpisodes += (results[i] as PromiseFulfilledResult<{ count: number }>).value.count;
    } else {
      const podcast = (subs[i].podcasts as any);
      errors.push(`${podcast?.title || 'Unknown'}: ${(results[i] as PromiseRejectedResult).reason?.message || 'Unknown error'}`);
    }
  }

  return {
    podcastsRefreshed: subs.length - errors.length,
    episodesAdded: totalEpisodes,
    errors,
  };
}
