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
import type { SummaryLevel } from '@/types/database';

const log = createLogger('sub-notifications');

const MAX_SOURCES_PER_TICK = 50;
const MAX_AUTO_SUMMARIES_PER_RUN = 100;
const SUMMARY_COUNTER_KEY = 'cron:auto-summary-count';
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/** Parse a date safely, returning null for NULL/invalid values */
function safeDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

/** Get the earliest valid last_checked_at from a list of subscribers, defaulting to 7 days ago */
function getEarliestChecked(subscribers: Array<{ last_checked_at: string | null }>): Date {
  const sevenDaysAgo = new Date(Date.now() - SEVEN_DAYS_MS);
  return subscribers.reduce((min, sub) => {
    const d = safeDate(sub.last_checked_at);
    if (!d) return min;
    return d < min ? d : min;
  }, sevenDaysAgo);
}

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

  // Get ALL podcast subscriptions — auto-summarize for every subscriber,
  // notifications only sent if notify_enabled is true
  const { data: subs, error } = await supabase
    .from('podcast_subscriptions')
    .select('id, user_id, podcast_id, last_checked_at, notify_enabled, notify_channels')
    .limit(MAX_SOURCES_PER_TICK);

  if (error) {
    log.error('Failed to query podcast subscriptions', { error: error.message });
    return { sourcesChecked: 0, newEpisodesFound: 0, notificationsCreated: 0, summariesQueued: 0 };
  }

  if (!subs || subs.length === 0) {
    log.info('No podcast subscriptions found');
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
      const earliestChecked = getEarliestChecked(subscribers);

      // Refresh the podcast feed (this imports new episodes into the episodes table)
      // We use the first subscriber's user_id for the feed_items population
      await refreshSinglePodcastFeed(subscribers[0].user_id, podcastId);

      // Find new episodes since earliest last_checked_at
      const { data: newEpisodes, error: epError } = await supabase
        .from('episodes')
        .select('id, title, published_at, audio_url, transcript_url')
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
        .select('title, language')
        .eq('id', podcastId)
        .single();

      const podcastTitle = podcast?.title || 'Unknown Podcast';
      const podcastLanguage = podcast?.language?.split('-')[0] || 'en';
      const subscriberUserIds = subscribers.map(s => s.user_id);

      for (const episode of newEpisodes) {
        // Queue auto-summary if under limit, and create user_summaries for subscribers
        // Queue both quick + deep summaries for full insights page
        summariesQueued += await maybeQueueAutoSummary(
          episode.id,
          episode.audio_url,
          'quick',
          podcastLanguage,
          episode.transcript_url,
          { podcastTitle, episodeTitle: episode.title },
          subscriberUserIds
        );
        summariesQueued += await maybeQueueAutoSummary(
          episode.id,
          episode.audio_url,
          'deep',
          podcastLanguage,
          episode.transcript_url,
          { podcastTitle, episodeTitle: episode.title },
          subscriberUserIds
        );

        // Create notifications for subscribers with notifications enabled
        for (const sub of subscribers) {
          if (!sub.notify_enabled) continue;
          const subLastChecked = safeDate(sub.last_checked_at);
          const episodePubDate = safeDate(episode.published_at);
          if (subLastChecked && episodePubDate && episodePubDate <= subLastChecked) continue;

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
    .select('id, user_id, channel_id, last_checked_at, notify_enabled, notify_channels')
    .limit(MAX_SOURCES_PER_TICK);

  if (error) {
    log.error('Failed to query YouTube follows', { error: error.message });
    return { sourcesChecked: 0, newEpisodesFound: 0, notificationsCreated: 0, summariesQueued: 0 };
  }

  if (!follows || follows.length === 0) {
    log.info('No YouTube follows found');
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
      const earliestChecked = getEarliestChecked(subscribers);

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
      const subscriberUserIds = subscribers.map(s => s.user_id);

      for (const item of newItems) {
        // Try to find a corresponding episode record for summary queueing
        if (item.video_id) {
          const videoUrl = `https://www.youtube.com/watch?v=${item.video_id}`;
          const { data: episode } = await supabase
            .from('episodes')
            .select('id')
            .eq('audio_url', videoUrl)
            .single();

          if (episode) {
            // Queue both quick + deep summaries for full insights page
            summariesQueued += await maybeQueueAutoSummary(
              episode.id,
              videoUrl,
              'quick',
              'en',
              undefined,
              { podcastTitle: channel.channel_name, episodeTitle: item.title },
              subscriberUserIds
            );
            summariesQueued += await maybeQueueAutoSummary(
              episode.id,
              videoUrl,
              'deep',
              'en',
              undefined,
              { podcastTitle: channel.channel_name, episodeTitle: item.title },
              subscriberUserIds
            );
          }
        }

        // Create notifications for subscribers with notifications enabled
        for (const sub of subscribers) {
          if (!sub.notify_enabled) continue;
          const subLastChecked = safeDate(sub.last_checked_at);
          const itemPubDate = safeDate(item.published_at);
          if (subLastChecked && itemPubDate && itemPubDate <= subLastChecked) continue;

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
 * Actually triggers summary generation (not just a DB insert) and creates user_summaries
 * for subscribing users so it appears on their Summaries page.
 * Returns 1 if queued, 0 if skipped.
 */
async function maybeQueueAutoSummary(
  episodeId: string,
  audioUrl: string,
  level: SummaryLevel = 'quick',
  language: string = 'en',
  transcriptUrl?: string | null,
  metadata?: { podcastTitle: string; episodeTitle: string },
  subscriberUserIds?: string[]
): Promise<number> {
  const supabase = createAdminClient();

  // Check if summary already exists
  const { data: existing } = await supabase
    .from('summaries')
    .select('id, status')
    .eq('episode_id', episodeId)
    .in('status', ['ready', 'summarizing', 'queued', 'transcribing'])
    .limit(1);

  if (existing && existing.length > 0) {
    // Summary exists — still create user_summaries for subscribers if missing
    if (subscriberUserIds?.length && existing[0].id) {
      await createUserSummaries(existing[0].id, episodeId, subscriberUserIds);
    }
    return 0;
  }

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

  // Trigger summary via HTTP POST to create a separate serverless invocation.
  // Direct function calls (fire-and-forget) get killed when the cron returns.
  try {
    log.info('Triggering auto-summary via HTTP', { episodeId, level });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const cronSecret = process.env.CRON_SECRET || '';

    // POST to the summaries endpoint — this runs in its own function invocation
    const res = await fetch(`${appUrl}/api/episodes/${episodeId}/summaries`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-cron-secret': cronSecret,
      },
      body: JSON.stringify({ level }),
    });

    if (res.ok) {
      log.info('Auto-summary triggered', { episodeId, status: res.status });

      // Create user_summaries for subscribers
      if (subscriberUserIds?.length) {
        const { data: summaryRow } = await supabase
          .from('summaries')
          .select('id')
          .eq('episode_id', episodeId)
          .order('updated_at', { ascending: false })
          .limit(1)
          .single();

        if (summaryRow) {
          await createUserSummaries(summaryRow.id, episodeId, subscriberUserIds);
        }
      }
    } else {
      log.error('Auto-summary trigger failed', { episodeId, status: res.status });
    }

    return 1;
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    log.error('Error triggering auto-summary', { episodeId, error: msg });
    return 0;
  }
}

/** Create user_summaries junction records for subscribers */
async function createUserSummaries(
  summaryId: string,
  episodeId: string,
  userIds: string[]
): Promise<void> {
  const supabase = createAdminClient();
  const records = userIds.map(userId => ({
    user_id: userId,
    summary_id: summaryId,
    episode_id: episodeId,
  }));

  const { error } = await supabase
    .from('user_summaries')
    .upsert(records, { onConflict: 'user_id,summary_id', ignoreDuplicates: true });

  if (error) {
    log.error('Failed to create user_summaries', { summaryId, error: error.message });
  }
}
