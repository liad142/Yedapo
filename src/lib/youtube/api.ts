import { getYouTubeAccessToken } from './token-manager';
import { createLogger } from '@/lib/logger';
import { getCached, setCached } from '@/lib/cache';

const log = createLogger('youtube');

const YT_API_BASE = 'https://www.googleapis.com/youtube/v3';

const YT_QUOTA_WARNING_THRESHOLD = 8000;
const YT_QUOTA_DAILY_LIMIT = 10000;

/** Estimated quota cost per YouTube Data API endpoint */
const QUOTA_COSTS = {
  'search.list': 100,
  'videos.list': 1,
  'channels.list': 1,
  'subscriptions.list': 1,
  'playlistItems.list': 1,
} as const;

type QuotaEndpoint = keyof typeof QUOTA_COSTS;

/**
 * Increment the daily YouTube API quota counter in Redis.
 * Key pattern: yt-quota:{YYYY-MM-DD}
 * TTL: 48 hours (covers timezone edge cases).
 */
async function trackQuota(endpoint: QuotaEndpoint): Promise<void> {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const key = `yt-quota:${today}`;
    const cost = QUOTA_COSTS[endpoint];

    const current = await getCached<number>(key);
    const newTotal = (current || 0) + cost;
    // 48h TTL to handle timezone edge cases
    await setCached(key, newTotal, 172800);

    if (newTotal >= YT_QUOTA_WARNING_THRESHOLD) {
      log.warn(`YouTube API quota high: ${newTotal}/${YT_QUOTA_DAILY_LIMIT} units used today`, { endpoint, cost });
    }
  } catch (err) {
    // Non-critical — never block API calls for tracking failures
    log.error('Failed to track YouTube quota', err);
  }
}

/**
 * Get current daily YouTube API quota usage from Redis.
 */
export async function getYouTubeQuotaUsage(): Promise<{ used: number; limit: number; date: string }> {
  const today = new Date().toISOString().slice(0, 10);
  const key = `yt-quota:${today}`;
  const used = await getCached<number>(key) || 0;
  return { used, limit: YT_QUOTA_DAILY_LIMIT, date: today };
}

export interface YouTubeSubscription {
  channelId: string;
  title: string;
  description: string;
  thumbnailUrl: string;
}

export interface YouTubeChannelSearchResult {
  channelId: string;
  title: string;
  description: string;
  thumbnailUrl: string;
}

export interface YouTubeVideo {
  videoId: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  publishedAt: string;
  channelId: string;
  channelTitle: string;
}

/**
 * Fetch video details by ID using the YouTube Data API.
 * Returns channelId, channelTitle, title, etc.
 */
export async function fetchVideoDetails(videoId: string): Promise<YouTubeVideo | null> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    log.error('YOUTUBE_API_KEY not set');
    return null;
  }

  const res = await fetch(
    `${YT_API_BASE}/videos?${new URLSearchParams({
      part: 'snippet',
      id: videoId,
      key: apiKey,
    })}`
  );

  if (!res.ok) {
    log.error('Failed to fetch video details', { status: res.status, videoId });
    return null;
  }

  await trackQuota('videos.list');
  const data = await res.json();
  const item = data.items?.[0];
  if (!item) return null;

  const snippet = item.snippet;
  return {
    videoId,
    title: snippet.title,
    description: snippet.description || '',
    thumbnailUrl: snippet.thumbnails?.medium?.url || snippet.thumbnails?.default?.url || '',
    publishedAt: snippet.publishedAt || '',
    channelId: snippet.channelId,
    channelTitle: snippet.channelTitle,
  };
}

/**
 * Fetch all YouTube subscriptions for a user (paginated).
 * Uses the user's OAuth token.
 */
export async function fetchUserSubscriptions(userId: string): Promise<YouTubeSubscription[]> {
  const accessToken = await getYouTubeAccessToken(userId);
  if (!accessToken) return [];

  const subscriptions: YouTubeSubscription[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      part: 'snippet',
      mine: 'true',
      maxResults: '50',
    });
    if (pageToken) params.set('pageToken', pageToken);

    const res = await fetch(`${YT_API_BASE}/subscriptions?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      log.error('Failed to fetch subscriptions', { status: res.status });
      break;
    }

    await trackQuota('subscriptions.list');
    const data = await res.json();

    for (const item of data.items || []) {
      const snippet = item.snippet;
      subscriptions.push({
        channelId: snippet.resourceId.channelId,
        title: snippet.title,
        description: snippet.description || '',
        thumbnailUrl: snippet.thumbnails?.default?.url || snippet.thumbnails?.medium?.url || '',
      });
    }

    pageToken = data.nextPageToken;
  } while (pageToken);

  return subscriptions;
}

/**
 * Parse ISO 8601 duration (e.g., "PT1H23M45S") to seconds.
 */
function parseIsoDuration(iso: string): number {
  const match = iso.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) return 0;
  const hours = parseInt(match[1] ?? '0', 10);
  const minutes = parseInt(match[2] ?? '0', 10);
  const seconds = parseInt(match[3] ?? '0', 10);
  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Minimum video length in seconds to qualify as a "regular" video.
 * YouTube Shorts are ≤60s by spec. We use 61s as the threshold.
 */
const MIN_REGULAR_VIDEO_SECONDS = 61;

/**
 * Enrich a list of YouTube videos with duration + liveBroadcastContent,
 * then filter out shorts, active live broadcasts, and upcoming premieres.
 * Returns only regular on-demand videos.
 *
 * Cost: 1 quota unit per videos.list call (batched up to 50 IDs/call).
 */
async function filterRegularVideos<T extends { videoId: string }>(
  videos: T[]
): Promise<T[]> {
  if (videos.length === 0) return [];
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return videos; // fail open — can't filter without API key

  // videos.list caps at 50 IDs per call
  const batches: T[][] = [];
  for (let i = 0; i < videos.length; i += 50) {
    batches.push(videos.slice(i, i + 50));
  }

  const keep = new Set<string>();
  for (const batch of batches) {
    const ids = batch.map((v) => v.videoId).join(',');
    try {
      const res = await fetch(
        `${YT_API_BASE}/videos?${new URLSearchParams({
          part: 'contentDetails,snippet',
          id: ids,
          key: apiKey,
        })}`
      );
      if (!res.ok) {
        // Fail open: if the enrichment fails, keep all videos rather than drop them
        log.warn('videos.list enrichment failed, keeping unfiltered', { status: res.status });
        batch.forEach((v) => keep.add(v.videoId));
        continue;
      }
      await trackQuota('videos.list');
      const data = await res.json();
      for (const item of data.items ?? []) {
        const durationSec = parseIsoDuration(item.contentDetails?.duration ?? '');
        const liveStatus = item.snippet?.liveBroadcastContent ?? 'none';
        // Only keep: long enough to not be a short AND not an active/upcoming live
        if (durationSec >= MIN_REGULAR_VIDEO_SECONDS && liveStatus === 'none') {
          keep.add(item.id);
        }
      }
    } catch (err) {
      log.warn('videos.list enrichment error', { error: String(err) });
      batch.forEach((v) => keep.add(v.videoId));
    }
  }

  return videos.filter((v) => keep.has(v.videoId));
}

/**
 * Fetch recent videos from a channel's uploads playlist.
 * Uses API key (public data, no user token needed).
 */
export async function fetchChannelVideos(
  channelId: string,
  maxResults = 5,
  pageToken?: string
): Promise<{ videos: YouTubeVideo[]; nextPageToken?: string; totalResults?: number }> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    log.error('YOUTUBE_API_KEY not set');
    return { videos: [] };
  }

  // First, get the channel's uploads playlist ID
  const channelRes = await fetch(
    `${YT_API_BASE}/channels?${new URLSearchParams({
      part: 'contentDetails',
      id: channelId,
      key: apiKey,
    })}`
  );

  if (!channelRes.ok) {
    log.error('Failed to fetch channel', { status: channelRes.status });
    return { videos: [] };
  }

  await trackQuota('channels.list');
  const channelData = await channelRes.json();
  const uploadsPlaylistId = channelData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploadsPlaylistId) return { videos: [] };

  // Fetch playlist items (recent videos)
  const params: Record<string, string> = {
    part: 'snippet',
    playlistId: uploadsPlaylistId,
    maxResults: String(maxResults),
    key: apiKey,
  };
  if (pageToken) params.pageToken = pageToken;

  const playlistRes = await fetch(
    `${YT_API_BASE}/playlistItems?${new URLSearchParams(params)}`
  );

  if (!playlistRes.ok) {
    log.error('Failed to fetch playlist items', { status: playlistRes.status });
    return { videos: [] };
  }

  await trackQuota('playlistItems.list');
  const playlistData = await playlistRes.json();

  const rawVideos: YouTubeVideo[] = (playlistData.items || []).map((item: any) => {
    const snippet = item.snippet;
    return {
      videoId: snippet.resourceId.videoId,
      title: snippet.title,
      description: snippet.description || '',
      thumbnailUrl: snippet.thumbnails?.high?.url || snippet.thumbnails?.medium?.url || '',
      publishedAt: snippet.publishedAt,
      channelId: snippet.channelId,
      channelTitle: snippet.channelTitle,
    };
  });

  // Filter out Shorts (<61s), active live streams, and upcoming premieres.
  // Costs 1 extra quota unit per 50 videos via videos.list.
  const videos = await filterRegularVideos(rawVideos);

  return {
    videos,
    nextPageToken: playlistData.nextPageToken,
    totalResults: playlistData.pageInfo?.totalResults,
  };
}

/**
 * Fetch topic details for a batch of channel IDs.
 * Uses API key (public data). Batches in groups of 50 (YouTube API limit).
 */
export async function fetchChannelTopics(
  channelIds: string[]
): Promise<Record<string, { topicIds: string[]; topicCategories: string[] }>> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    log.error('YOUTUBE_API_KEY not set');
    return {};
  }

  const results: Record<string, { topicIds: string[]; topicCategories: string[] }> = {};

  // Batch channel IDs in groups of 50
  for (let i = 0; i < channelIds.length; i += 50) {
    const batch = channelIds.slice(i, i + 50);

    try {
      const res = await fetch(
        `${YT_API_BASE}/channels?${new URLSearchParams({
          part: 'topicDetails',
          id: batch.join(','),
          key: apiKey,
        })}`
      );

      await trackQuota('channels.list');

      if (!res.ok) {
        log.error('Failed to fetch channel topics', { status: res.status });
        continue;
      }

      const data = await res.json();

      for (const item of data.items || []) {
        results[item.id] = {
          topicIds: item.topicDetails?.topicIds || [],
          topicCategories: item.topicDetails?.topicCategories || [],
        };
      }
    } catch (err) {
      log.error('Error fetching channel topics batch', err);
      continue;
    }
  }

  return results;
}

/**
 * Search YouTube channels by keyword.
 * Uses API key (public data, no user token needed).
 */
export async function searchYouTubeChannels(
  term: string,
  maxResults = 5
): Promise<YouTubeChannelSearchResult[]> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    log.error('YOUTUBE_API_KEY not set');
    return [];
  }

  const res = await fetch(
    `${YT_API_BASE}/search?${new URLSearchParams({
      part: 'snippet',
      type: 'channel',
      q: term,
      maxResults: String(maxResults),
      key: apiKey,
    })}`
  );

  await trackQuota('search.list');

  if (!res.ok) {
    log.error('Failed to search YouTube channels', { status: res.status });
    return [];
  }

  const data = await res.json();

  return (data.items || []).map((item: any) => ({
    channelId: item.snippet.channelId,
    title: item.snippet.channelTitle,
    description: item.snippet.description || '',
    thumbnailUrl: item.snippet.thumbnails?.default?.url || item.snippet.thumbnails?.medium?.url || '',
  }));
}

/**
 * Search YouTube videos by keyword.
 * Uses API key (public data, no user token needed).
 */
export async function searchYouTubeVideos(
  term: string,
  maxResults = 5
): Promise<YouTubeVideo[]> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    log.error('YOUTUBE_API_KEY not set');
    return [];
  }

  // Over-fetch by 2x to account for shorts/lives that will be filtered out.
  // YouTube search max per call is 50.
  const fetchCount = Math.min(50, maxResults * 2);
  const res = await fetch(
    `${YT_API_BASE}/search?${new URLSearchParams({
      part: 'snippet',
      type: 'video',
      q: term,
      maxResults: String(fetchCount),
      key: apiKey,
    })}`
  );

  await trackQuota('search.list');

  if (!res.ok) {
    log.error('Failed to search YouTube videos', { status: res.status });
    return [];
  }

  const data = await res.json();

  const rawVideos: YouTubeVideo[] = (data.items || []).map((item: any) => ({
    videoId: item.id.videoId,
    title: item.snippet.title,
    description: item.snippet.description || '',
    thumbnailUrl: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url || '',
    publishedAt: item.snippet.publishedAt || '',
    channelId: item.snippet.channelId,
    channelTitle: item.snippet.channelTitle,
  }));

  // Filter to regular videos only (no Shorts, no live, no upcoming).
  const filtered = await filterRegularVideos(rawVideos);
  return filtered.slice(0, maxResults);
}
