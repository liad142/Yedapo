import type { Podcast } from '@/types/database';

/**
 * Check if a podcast is YouTube-based content
 */
export function isYouTubeContent(podcast?: Podcast | null): boolean {
  return !!podcast?.rss_feed_url?.startsWith('youtube:channel:');
}

/**
 * Extract YouTube video ID from a YouTube URL
 * Handles: youtube.com/watch?v=, youtu.be/, youtube.com/embed/
 */
export function extractYouTubeVideoId(url: string | null | undefined): string | null {
  if (!url) return null;
  const match = url.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/
  );
  return match?.[1] ?? null;
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
  const channelId = extractChannelId(input);
  if (channelId) {
    return { type: 'channel', value: channelId };
  }

  const handle = extractHandle(input);
  if (handle) {
    return { type: 'handle', value: handle };
  }

  return { type: 'unknown', value: input };
}

/**
 * Get YouTube thumbnail URL for a video
 */
export function getYouTubeThumbnail(
  videoId: string,
  quality: 'default' | 'mqdefault' | 'hqdefault' | 'sddefault' | 'maxresdefault' = 'hqdefault'
): string {
  return `https://i.ytimg.com/vi/${videoId}/${quality}.jpg`;
}
