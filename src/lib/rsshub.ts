/**
 * RSSHub Client Library
 * Handles YouTube RSS feed fetching via RSSHub with caching and rate limiting
 */

import Parser from 'rss-parser';
import { getCached, setCached, CacheKeys, CacheTTL, checkRateLimit as redisRateLimit } from '@/lib/cache';

const RSSHUB_BASE_URL = process.env.RSSHUB_BASE_URL || 'http://localhost:1200';
// Rate limiting is handled by Redis via @/lib/cache
const MAX_FEED_SIZE = 10 * 1024 * 1024; // 10MB limit for XML feeds

interface YouTubeVideo {
  videoId: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  publishedAt: Date;
  duration?: number;
  url: string;
}

interface YouTubeChannelInfo {
  channelId: string;
  channelName: string;
  channelUrl: string;
  channelHandle?: string;
  thumbnailUrl?: string;
  description?: string;
}

interface RSSHubFeed {
  title: string;
  description: string;
  link: string;
  items: Array<{
    title: string;
    link: string;
    pubDate: string;
    content?: string;
    contentSnippet?: string;
    guid?: string;
    isoDate?: string;
  }>;
  image?: {
    url: string;
  };
}

const parser = new Parser({
  customFields: {
    item: [
      ['media:group', 'mediaGroup'],
      ['yt:videoId', 'videoId'],
      ['yt:channelId', 'channelId'],
    ],
  },
});

/**
 * Extract YouTube video ID from various URL formats
 */
export function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  return null;
}

/**
 * Extract YouTube channel ID from various URL formats
 */
export function extractChannelId(url: string): string | null {
  const patterns = [
    /youtube\.com\/channel\/([a-zA-Z0-9_-]+)/,
    /^([a-zA-Z0-9_-]{24})$/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  return null;
}

/**
 * Extract YouTube handle from URL or @handle string
 */
export function extractHandle(input: string): string | null {
  const patterns = [
    /youtube\.com\/@([a-zA-Z0-9_-]+)/,
    /^@([a-zA-Z0-9_-]+)$/,
    /^([a-zA-Z0-9_-]+)$/, // Plain handle without @
  ];

  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (match) {
      const handle = match[1];
      return handle.startsWith('@') ? handle : `@${handle}`;
    }
  }

  return null;
}

/**
 * Parse YouTube input (URL, channel ID, or handle) and determine the type
 */
export function parseYouTubeInput(input: string): {
  type: 'channel' | 'handle' | 'unknown';
  value: string;
} {
  // Try channel ID first
  const channelId = extractChannelId(input);
  if (channelId) {
    return { type: 'channel', value: channelId };
  }

  // Try handle
  const handle = extractHandle(input);
  if (handle) {
    return { type: 'handle', value: handle };
  }

  return { type: 'unknown', value: input };
}

// Cache functions are now imported from @/lib/cache

/**
 * Fetch YouTube channel RSS feed via RSSHub
 */
export async function fetchYouTubeChannelFeed(
  channelIdOrHandle: string,
  useCache = true
): Promise<{ channel: YouTubeChannelInfo; videos: YouTubeVideo[] }> {
  const cacheKey = CacheKeys.youtubeFeed(channelIdOrHandle);

  // Check cache first
  if (useCache) {
    const cached = await getCached<RSSHubFeed>(cacheKey);
    if (cached) {
      return parseFeedData(cached, channelIdOrHandle);
    }
  }

  // Determine RSSHub endpoint
  const isChannelId = channelIdOrHandle.match(/^UC[a-zA-Z0-9_-]{22}$/);
  const endpoint = isChannelId
    ? `/youtube/channel/${channelIdOrHandle}`
    : `/youtube/user/${channelIdOrHandle}`;

  const url = `${RSSHUB_BASE_URL}${endpoint}`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Yedapo/1.0',
      },
    });

    if (!response.ok) {
      throw new Error(`RSSHub returned ${response.status}: ${response.statusText}`);
    }

    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > MAX_FEED_SIZE) {
      throw new Error('Feed too large to process');
    }
    const feedXml = await response.text();
    if (feedXml.length > MAX_FEED_SIZE) {
      throw new Error('Feed content exceeds size limit');
    }
    const feed = await parser.parseString(feedXml);

    // Cache the response in Redis
    await setCached(cacheKey, feed as unknown as RSSHubFeed, CacheTTL.YOUTUBE_FEED);

    return parseFeedData(feed as unknown as RSSHubFeed, channelIdOrHandle);
  } catch (err) {
    console.error('RSSHub fetch error:', err);
    throw new Error(`Failed to fetch YouTube feed: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }
}

/**
 * Parse RSS feed data into structured format
 */
function parseFeedData(
  feed: RSSHubFeed,
  channelIdOrHandle: string
): { channel: YouTubeChannelInfo; videos: YouTubeVideo[] } {
  // Extract channel info
  const channel: YouTubeChannelInfo = {
    channelId: channelIdOrHandle,
    channelName: feed.title || 'Unknown Channel',
    channelUrl: feed.link || `https://youtube.com/channel/${channelIdOrHandle}`,
    thumbnailUrl: feed.image?.url,
    description: feed.description,
  };

  // Parse videos
  const videos: YouTubeVideo[] = feed.items.map((item) => {
    const videoId = extractVideoId(item.link || '') || item.guid || '';
    const url = item.link || `https://youtube.com/watch?v=${videoId}`;

    return {
      videoId,
      title: item.title || 'Untitled',
      description: item.contentSnippet || item.content || '',
      thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      publishedAt: new Date(item.isoDate || item.pubDate || Date.now()),
      url,
    };
  });

  return { channel, videos };
}

/**
 * Rate limiter for API calls (distributed via Redis)
 */
export async function checkRateLimit(userId: string, maxRequests = 10, windowSeconds = 60): Promise<boolean> {
  return redisRateLimit(userId, maxRequests, windowSeconds);
}
