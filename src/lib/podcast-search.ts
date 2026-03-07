/**
 * Unified Podcast Search Service
 * Orchestrates both Apple Podcasts and Podcastindex APIs
 */

import { getCached, setCached, CacheKeys, CacheTTL } from '@/lib/cache';
import { searchPodcasts as appleSearch } from '@/lib/apple-podcasts';
import {
  searchPodcasts as piSearch,
  isPodcastIndexConfigured,
} from '@/lib/podcast-index';
import { searchYouTubeChannels } from '@/lib/youtube/api';
import type { ApplePodcast } from '@/types/apple-podcasts';
import type { Podcast, SearchResult, YouTubeChannelResult } from '@/types/podcast';

/**
 * Transform an Apple Podcast to the unified Podcast type
 */
function transformApplePodcast(apple: ApplePodcast): Podcast {
  return {
    id: `apple:${apple.id}`,
    source: 'apple',
    title: apple.name,
    author: apple.artistName,
    description: apple.description || '',
    artworkUrl: apple.artworkUrl,
    feedUrl: apple.feedUrl,
    genres: apple.genres || [],
    episodeCount: apple.trackCount || 0,
    itunesId: parseInt(apple.id, 10) || undefined,
  };
}

/**
 * Deduplicate podcasts by iTunes ID (both sources share this)
 * Podcastindex results take priority when duplicates are found
 */
function deduplicatePodcasts(piResults: Podcast[], appleResults: Podcast[]): Podcast[] {
  const seen = new Map<string, Podcast>();

  // Add PI results first (higher priority - purpose-built podcast index)
  for (const podcast of piResults) {
    const dedupeKey = podcast.itunesId ? `itunes:${podcast.itunesId}` : podcast.id;
    seen.set(dedupeKey, podcast);
  }

  // Add Apple results, skipping duplicates
  for (const podcast of appleResults) {
    const dedupeKey = podcast.itunesId ? `itunes:${podcast.itunesId}` : podcast.id;
    if (!seen.has(dedupeKey)) {
      seen.set(dedupeKey, podcast);
    }
  }

  return Array.from(seen.values());
}

/**
 * Search podcasts across both APIs with graceful degradation
 */
export async function searchPodcasts(
  term: string,
  country: string = 'us',
  limit: number = 20
): Promise<SearchResult> {
  // Check unified cache
  const cacheKey = CacheKeys.unifiedSearch(term, country, limit);
  const cached = await getCached<SearchResult>(cacheKey);
  if (cached) return cached;

  const piConfigured = isPodcastIndexConfigured();
  const ytApiKey = !!process.env.YOUTUBE_API_KEY;

  // Fire all APIs in parallel
  const [piResult, appleResult, ytResult] = await Promise.allSettled([
    piConfigured
      ? piSearch(term, limit)
      : Promise.reject(new Error('Podcastindex not configured')),
    appleSearch(term, country, limit),
    ytApiKey
      ? searchYouTubeChannels(term, 5)
      : Promise.reject(new Error('YouTube API not configured')),
  ]);

  const piPodcasts = piResult.status === 'fulfilled' ? piResult.value : [];
  const applePodcasts = appleResult.status === 'fulfilled'
    ? appleResult.value.map(transformApplePodcast)
    : [];

  // YouTube channels
  const ytChannels: YouTubeChannelResult[] = ytResult.status === 'fulfilled'
    ? ytResult.value.map((ch) => ({
        id: ch.channelId,
        title: ch.title,
        thumbnailUrl: ch.thumbnailUrl,
        description: ch.description,
      }))
    : [];

  // Determine source for response metadata
  let source: SearchResult['source'] = 'merged';
  if (piPodcasts.length === 0 && applePodcasts.length > 0) source = 'apple';
  if (piPodcasts.length > 0 && applePodcasts.length === 0) source = 'podcastindex';

  // Both podcast APIs failed
  if (piPodcasts.length === 0 && applePodcasts.length === 0) {
    // If both actually errored, throw (unless YouTube has results)
    if (piResult.status === 'rejected' && appleResult.status === 'rejected' && ytChannels.length === 0) {
      throw new Error('All search APIs failed');
    }
    // Otherwise one returned empty results - that's fine
  }

  const podcasts = deduplicatePodcasts(piPodcasts, applePodcasts).slice(0, limit);

  const result: SearchResult = {
    podcasts,
    channels: ytChannels.length > 0 ? ytChannels : undefined,
    query: term,
    source,
    count: podcasts.length,
  };

  // Cache merged result
  await setCached(cacheKey, result, CacheTTL.UNIFIED_SEARCH);

  return result;
}
