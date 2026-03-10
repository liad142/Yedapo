/**
 * Subscription Notifications Service
 *
 * Detects new episodes for subscribed sources, queues auto-summaries,
 * and creates notifications for subscribers.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { createLogger } from '@/lib/logger';
import { getCached, setCached } from '@/lib/cache';
import { refreshSinglePodcastFeed } from '@/lib/rsshub-db';

const log = createLogger('sub-notifications');

const MAX_SOURCES_PER_TICK = 50;
const MAX_AUTO_SUMMARIES_PER_RUN = 10;
const SUMMARY_COUNTER_KEY = 'cron:auto-summary-count';

/**
 * Check all podcast subscriptions with notifications enabled for new episodes.
 */
export async function checkNewPodcastEpisodes(): Promise<{
  sourcesChecked: number;
  newEpisodesFound: number;
  notificationsCreated: number;
  summariesQueued: number;
}> {
  const supabase = createAdminClient();
  let newEpisodesFound = 0;
  let notificationsCreated = 0;
  let summariesQueued = 0;

  // Get all podcast subscriptions with notifications enabled, grouped by podcast_id
  const { data: subs, error } = await supabase
    .from('podcast_subscriptions')
    .select('id, user_id, podcast_id, last_checked_at, notify_channels')
    .eq('notify_enabled', true)
    .limit(MAX_SOURCES_PER_TICK);

  if (error) {
    log.error('Failed to query podcast subscriptions', { error: error.message });
    return { sourcesChecked: 0, newEpisodesFound: 0, notificationsCreated: 0, summariesQueued: 0 };
  }

  if (!subs || subs.length === 0) {
    log.info('No podcast subscriptions with notifications enabled');
    return { sourcesChecked: 0, newEpisodesFound: 0, notificationsCreated: 0, summariesQueued: 0 };
  }

  // Group subscriptions by podcast_id to avoid duplicate feed fetches
  const podcastGroups = new Map<string, typeof subs>();
  for (const sub of subs) {
    const group = podcastGroups.get(sub.podcast_id) || [];
    group.push(sub);
    podcastGroups.set(sub.podcast_id, group);
  }

  for (const [podcastId, subscribers] of podcastGroups) {
    try {
      // Use the earliest last_checked_at among subscribers as our cursor
      const earliestChecked = subscribers.reduce((min, sub) => {
        const d = new Date(sub.last_checked_at);
        return d < min ? d : min;
      }, new Date());

      // Refresh the podcast feed (this imports new episodes into the episodes table)
      // We use the first subscriber's user_id for the feed_items population
      await refreshSinglePodcastFeed(subscribers[0].user_id, podcastId);

      // Find new episodes since earliest last_checked_at
      const { data: newEpisodes, error: epError } = await supabase
        .from('episodes')
        .select('id, title, published_at')
        .eq('podcast_id', podcastId)
        .gt('published_at', earliestChecked.toISOString())
        .order('published_at', { ascending: false })
        .limit(10);

      if (epError) {
        log.error('Failed to query new episodes', { podcastId, error: epError.message });
        continue;
      }

      if (!newEpisodes || newEpisodes.length === 0) {
        // Update last_checked_at even if no new episodes
        const subIds = subscribers.map(s => s.id);
        await supabase
          .from('podcast_subscriptions')
          .update({ last_checked_at: new Date().toISOString() })
          .in('id', subIds);
        continue;
      }

      newEpisodesFound += newEpisodes.length;

      // Get podcast info for notification messages
      const { data: podcast } = await supabase
        .from('podcasts')
        .select('title')
        .eq('id', podcastId)
        .single();

      const podcastTitle = podcast?.title || 'Unknown Podcast';

      for (const episode of newEpisodes) {
        // Queue auto-summary if under limit
        summariesQueued += await maybeQueueAutoSummary(episode.id);

        // Create notifications for each subscriber
        for (const sub of subscribers) {
          const subLastChecked = new Date(sub.last_checked_at);
          if (new Date(episode.published_at) <= subLastChecked) continue;

          const channels: string[] = sub.notify_channels || [];
          const created = await createNotificationsForSubscriber(
            sub.user_id,
            episode.id,
            'podcast',
            podcastId,
            episode.title,
            `New episode from ${podcastTitle}`,
            channels
          );
          notificationsCreated += created;
        }
      }

      // Update last_checked_at for all subscribers
      const subIds = subscribers.map(s => s.id);
      await supabase
        .from('podcast_subscriptions')
        .update({ last_checked_at: new Date().toISOString() })
        .in('id', subIds);

    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      log.error('Error processing podcast', { podcastId, error: msg });
    }
  }

  return {
    sourcesChecked: podcastGroups.size,
    newEpisodesFound,
    notificationsCreated,
    summariesQueued,
  };
}

/**
 * Check all YouTube channel follows with notifications enabled for new videos.
 */
export async function checkNewYouTubeVideos(): Promise<{
  sourcesChecked: number;
  newEpisodesFound: number;
  notificationsCreated: number;
  summariesQueued: number;
}> {
  const supabase = createAdminClient();
  let newEpisodesFound = 0;
  let notificationsCreated = 0;
  let summariesQueued = 0;

  const { data: follows, error } = await supabase
    .from('youtube_channel_follows')
    .select('id, user_id, channel_id, last_checked_at, notify_channels')
    .eq('notify_enabled', true)
    .limit(MAX_SOURCES_PER_TICK);

  if (error) {
    log.error('Failed to query YouTube follows', { error: error.message });
    return { sourcesChecked: 0, newEpisodesFound: 0, notificationsCreated: 0, summariesQueued: 0 };
  }

  if (!follows || follows.length === 0) {
    log.info('No YouTube follows with notifications enabled');
    return { sourcesChecked: 0, newEpisodesFound: 0, notificationsCreated: 0, summariesQueued: 0 };
  }

  // Group by channel_id
  const channelGroups = new Map<string, typeof follows>();
  for (const follow of follows) {
    const group = channelGroups.get(follow.channel_id) || [];
    group.push(follow);
    channelGroups.set(follow.channel_id, group);
  }

  for (const [channelDbId, subscribers] of channelGroups) {
    try {
      const earliestChecked = subscribers.reduce((min, sub) => {
        const d = new Date(sub.last_checked_at);
        return d < min ? d : min;
      }, new Date());

      // Get channel info
      const { data: channel } = await supabase
        .from('youtube_channels')
        .select('channel_id, channel_name')
        .eq('id', channelDbId)
        .single();

      if (!channel) continue;

      // Find new episodes (videos stored as episodes with youtube source)
      // Check feed_items for new videos from this channel
      const { data: newItems, error: itemError } = await supabase
        .from('feed_items')
        .select('id, title, video_id, published_at')
        .eq('source_type', 'youtube')
        .eq('source_id', channelDbId)
        .gt('published_at', earliestChecked.toISOString())
        .order('published_at', { ascending: false })
        .limit(10);

      if (itemError) {
        log.error('Failed to query new YouTube items', { channelDbId, error: itemError.message });
        continue;
      }

      if (!newItems || newItems.length === 0) {
        const followIds = subscribers.map(s => s.id);
        await supabase
          .from('youtube_channel_follows')
          .update({ last_checked_at: new Date().toISOString() })
          .in('id', followIds);
        continue;
      }

      newEpisodesFound += newItems.length;

      for (const item of newItems) {
        // Try to find a corresponding episode record for summary queueing
        if (item.video_id) {
          const { data: episode } = await supabase
            .from('episodes')
            .select('id')
            .eq('audio_url', `https://www.youtube.com/watch?v=${item.video_id}`)
            .single();

          if (episode) {
            summariesQueued += await maybeQueueAutoSummary(episode.id);
          }
        }

        // Create notifications for each subscriber
        for (const sub of subscribers) {
          const subLastChecked = new Date(sub.last_checked_at);
          if (new Date(item.published_at) <= subLastChecked) continue;

          const channels: string[] = sub.notify_channels || [];
          const created = await createNotificationsForSubscriber(
            sub.user_id,
            null, // No episode_id for YouTube feed items
            'youtube',
            channelDbId,
            item.title,
            `New video from ${channel.channel_name}`,
            channels
          );
          notificationsCreated += created;
        }
      }

      // Update last_checked_at
      const followIds = subscribers.map(s => s.id);
      await supabase
        .from('youtube_channel_follows')
        .update({ last_checked_at: new Date().toISOString() })
        .in('id', followIds);

    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      log.error('Error processing YouTube channel', { channelDbId, error: msg });
    }
  }

  return {
    sourcesChecked: channelGroups.size,
    newEpisodesFound,
    notificationsCreated,
    summariesQueued,
  };
}

/**
 * Create notifications for a single subscriber based on their channel preferences.
 */
async function createNotificationsForSubscriber(
  userId: string,
  episodeId: string | null,
  sourceType: 'podcast' | 'youtube',
  sourceId: string,
  title: string,
  message: string,
  notifyChannels: string[]
): Promise<number> {
  const supabase = createAdminClient();
  let count = 0;

  // In-app notification (immediate)
  if (notifyChannels.includes('in_app')) {
    const { error } = await supabase.from('in_app_notifications').insert({
      user_id: userId,
      episode_id: episodeId,
      source_type: sourceType,
      source_id: sourceId,
      title,
      message,
    });
    if (!error) count++;
  }

  // Email notification (scheduled - waits for summary completion)
  if (notifyChannels.includes('email') && episodeId) {
    // Get user's email
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('email')
      .eq('id', userId)
      .single();

    if (profile?.email) {
      const { error } = await supabase.from('notification_requests').insert({
        user_id: userId,
        episode_id: episodeId,
        channel: 'email',
        recipient: profile.email,
        status: 'pending',
        scheduled: true,
      });
      if (!error) count++;
    }
  }

  // Telegram notification (scheduled - waits for summary completion)
  if (notifyChannels.includes('telegram') && episodeId) {
    const { data: telegram } = await supabase
      .from('telegram_connections')
      .select('telegram_chat_id')
      .eq('user_id', userId)
      .single();

    if (telegram?.telegram_chat_id) {
      const { error } = await supabase.from('notification_requests').insert({
        user_id: userId,
        episode_id: episodeId,
        channel: 'telegram',
        recipient: telegram.telegram_chat_id,
        status: 'pending',
        scheduled: true,
      });
      if (!error) count++;
    }
  }

  return count;
}

/**
 * Queue an auto-summary for an episode if under the per-run limit and not already processed.
 * Returns 1 if queued, 0 if skipped.
 */
async function maybeQueueAutoSummary(episodeId: string): Promise<number> {
  const supabase = createAdminClient();

  // Check if summary already exists
  const { data: existing } = await supabase
    .from('summaries')
    .select('status')
    .eq('episode_id', episodeId)
    .in('status', ['ready', 'summarizing', 'queued', 'transcribing'])
    .limit(1);

  if (existing && existing.length > 0) return 0;

  // Check rate limit counter
  try {
    const current = await getCached<number>(SUMMARY_COUNTER_KEY);
    if (current != null && current >= MAX_AUTO_SUMMARIES_PER_RUN) {
      log.info('Auto-summary rate limit reached', { episodeId });
      return 0;
    }
    await setCached(SUMMARY_COUNTER_KEY, (current ?? 0) + 1, 35 * 60);
  } catch {
    // Fail open on Redis issues
  }

  // Queue the summary by calling the summarize API internally
  // This creates the summary record with status 'queued'
  try {
    const { error } = await supabase
      .from('summaries')
      .insert({
        episode_id: episodeId,
        status: 'queued',
        level: 'quick',
        language: 'en',
      });

    if (error && !error.message.includes('duplicate')) {
      log.error('Failed to queue auto-summary', { episodeId, error: error.message });
      return 0;
    }

    log.info('Auto-summary queued', { episodeId });
    return 1;
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    log.error('Error queueing auto-summary', { episodeId, error: msg });
    return 0;
  }
}
