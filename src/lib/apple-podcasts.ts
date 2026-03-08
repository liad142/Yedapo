/**
 * Apple Podcasts Client Library
 * Uses iTunes Search API for discovery and direct RSS feed fetching
 */

import Parser from 'rss-parser';
import { Agent } from 'undici';
import { getCached, setCached, CacheKeys, CacheTTL, checkRateLimit as redisRateLimit } from '@/lib/cache';
import {
  isPodcastIndexConfigured,
  getPodcastByItunesId,
  getEpisodesByFeedId,
} from '@/lib/podcast-index';
import {
  ApplePodcast,
  AppleEpisode,
  ApplePodcastFeed,
  ITunesSearchResponse,
  ITunesPodcast,
  AppleGenre,
  APPLE_PODCAST_GENRES,
} from '@/types/apple-podcasts';

const ITUNES_API_BASE = 'https://itunes.apple.com';
// Rate limiting is handled by Redis via @/lib/cache
const MAX_FEED_SIZE = 50 * 1024 * 1024; // 50MB limit for XML feeds (large podcasts with 500+ episodes)

// Podcast CDNs (podtrac, etc.) often return oversized response headers.
// Node's built-in fetch (undici) defaults to 16 KB max header size which is too small.
const largeFetchDispatcher = new Agent({ maxHeaderSize: 128 * 1024 }); // 128 KB

interface ParsedRSSFeed {
  title: string;
  description: string;
  link: string;
  image?: { url: string };
  items: Array<{
    title: string;
    link: string;
    pubDate: string;
    content?: string;
    contentSnippet?: string;
    guid?: string;
    isoDate?: string;
    enclosure?: { url: string; type: string; length?: string };
    itunes?: {
      duration?: string;
      episode?: string;
      season?: string;
      image?: string;
    };
  }>;
}

const parser = new Parser({
  customFields: {
    item: [
      ['itunes:duration', 'duration'],
      ['itunes:episode', 'episode'],
      ['itunes:season', 'season'],
      ['itunes:image', 'itunesImage'],
    ],
  },
});

/**
 * Extract Apple Podcast ID from URL
 */
export function extractApplePodcastId(url: string): string | null {
  // Match patterns like:
  // https://podcasts.apple.com/us/podcast/the-daily/id1200361736
  // https://podcasts.apple.com/podcast/id1200361736
  const patterns = [
    /podcasts\.apple\.com\/.*\/podcast\/.*\/id(\d+)/,
    /podcasts\.apple\.com\/podcast\/id(\d+)/,
    /itunes\.apple\.com\/.*\/podcast\/.*\/id(\d+)/,
    /^(\d+)$/, // Just the ID
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  return null;
}

// Cache functions are now imported from @/lib/cache

/**
 * Transform iTunes podcast to our format
 */
function transformITunesPodcast(itunes: ITunesPodcast): ApplePodcast {
  return {
    id: String(itunes.collectionId || itunes.trackId),
    name: itunes.collectionName || itunes.trackName,
    artistName: itunes.artistName,
    description: '', // iTunes search doesn't return full description
    artworkUrl: itunes.artworkUrl600 || itunes.artworkUrl100 || itunes.artworkUrl60,
    feedUrl: itunes.feedUrl,
    genres: itunes.genres || [itunes.primaryGenreName],
    trackCount: itunes.trackCount,
    country: itunes.country,
    contentAdvisoryRating: itunes.contentAdvisoryRating,
    releaseDate: itunes.releaseDate,
  };
}

/**
 * Search podcasts using iTunes Search API
 */
export async function searchPodcasts(
  term: string,
  country: string = 'us',
  limit: number = 20
): Promise<ApplePodcast[]> {
  const cacheKey = CacheKeys.searchPodcasts(country, term, limit);

  // Check cache
  const cached = await getCached<ApplePodcast[]>(cacheKey);
  if (cached) return cached;

  try {
    const url = new URL(`${ITUNES_API_BASE}/search`);
    url.searchParams.set('term', term);
    url.searchParams.set('country', country);
    url.searchParams.set('media', 'podcast');
    url.searchParams.set('entity', 'podcast');
    url.searchParams.set('limit', String(limit));

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`iTunes API returned ${response.status}`);
    }

    const data: ITunesSearchResponse = await response.json();
    const podcasts = data.results.map(transformITunesPodcast);

    // Cache for 30 minutes (search results)
    await setCached(cacheKey, podcasts, CacheTTL.SEARCH);

    return podcasts;
  } catch (err) {
    console.error('iTunes search error:', err);
    throw new Error(`Failed to search podcasts: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }
}

/**
 * Get top podcasts for a country using iTunes RSS feeds
 */
export async function getTopPodcasts(
  country: string = 'us',
  limit: number = 20,
  genreId?: string
): Promise<ApplePodcast[]> {
  const cacheKey = CacheKeys.topPodcasts(country, genreId, limit);

  // Check cache
  const cached = await getCached<ApplePodcast[]>(cacheKey);
  if (cached) return cached;

  try {
    // iTunes RSS feed for top podcasts
    // Format: https://itunes.apple.com/{country}/rss/toppodcasts/limit={limit}/genre={genreId}/json
    let url = `${ITUNES_API_BASE}/${country}/rss/toppodcasts/limit=${limit}`;
    if (genreId) {
      url += `/genre=${genreId}`;
    }
    url += '/json';

    const response = await fetch(url);
    if (!response.ok) {
      // Fallback to search if RSS feed fails
      console.warn(`iTunes RSS feed failed, falling back to search`);
      const genre = APPLE_PODCAST_GENRES.find(g => g.id === genreId);
      return searchPodcasts(genre?.name || 'podcast', country, limit);
    }

    const data = await response.json();
    const entries = data?.feed?.entry || [];

    const podcasts: ApplePodcast[] = entries.map((entry: any) => ({
      id: entry.id?.attributes?.['im:id'] || extractApplePodcastId(entry.id?.label || '') || '',
      name: entry['im:name']?.label || entry.title?.label || 'Unknown',
      artistName: entry['im:artist']?.label || '',
      description: entry.summary?.label || '',
      artworkUrl: entry['im:image']?.[2]?.label || entry['im:image']?.[1]?.label || entry['im:image']?.[0]?.label || '',
      genres: entry.category?.attributes?.label ? [entry.category.attributes.label] : [],
      trackCount: 0,
      country: country.toUpperCase(),
      releaseDate: entry['im:releaseDate']?.label,
    }));

    // Cache for 6 hours (top charts)
    await setCached(cacheKey, podcasts, CacheTTL.TOP_PODCASTS);

    return podcasts;
  } catch (err) {
    console.error('iTunes top podcasts error:', err);
    throw new Error(`Failed to get top podcasts: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }
}

/**
 * Get podcasts by genre
 */
export async function getPodcastsByGenre(
  genreId: string,
  country: string = 'us',
  limit: number = 20
): Promise<ApplePodcast[]> {
  return getTopPodcasts(country, limit, genreId);
}

/**
 * Get podcast details by ID using iTunes Lookup API
 */
export async function getPodcastById(podcastId: string, country: string = 'us'): Promise<ApplePodcast | null> {
  const cacheKey = CacheKeys.podcastDetails(podcastId, country);

  // Check Redis cache
  const cached = await getCached<ApplePodcast>(cacheKey);
  if (cached) return cached;

  try {
    const url = new URL(`${ITUNES_API_BASE}/lookup`);
    url.searchParams.set('id', podcastId);
    url.searchParams.set('country', country);
    url.searchParams.set('entity', 'podcast');

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`iTunes API returned ${response.status}`);
    }

    const data: ITunesSearchResponse = await response.json();
    if (data.resultCount === 0 || !data.results[0]) {
      return null;
    }

    const podcast = transformITunesPodcast(data.results[0]);

    // Cache in Redis (persistent, shared across instances)
    await setCached(cacheKey, podcast, CacheTTL.PODCAST_DETAILS);

    return podcast;
  } catch (err) {
    console.error('iTunes lookup error:', err);
    throw new Error(`Failed to get podcast: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }
}

/**
 * Parse duration string to seconds
 */
function parseDuration(duration: string | undefined): number {
  if (!duration) return 0;

  // Format: HH:MM:SS or MM:SS or seconds
  const parts = duration.split(':').map(Number);
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  return parseInt(duration, 10) || 0;
}

export interface PodcastEpisodesResult {
  episodes: AppleEpisode[];
  totalCount: number;
  hasMore: boolean;
}

/**
 * Get podcast episodes via direct RSS feed
 * Caches the full parsed feed and applies offset/limit slicing on the result
 */
export async function getPodcastEpisodes(
  podcastId: string,
  feedUrl?: string,
  limit: number = 50,
  offset: number = 0
): Promise<PodcastEpisodesResult> {
  const cacheKey = CacheKeys.podcastEpisodes(podcastId);

  // Check Redis cache for the full episode list
  let allEpisodes = await getCached<AppleEpisode[]>(cacheKey);

  if (!allEpisodes) {
    // Primary: try Podcastindex API (reliable single endpoint, structured JSON)
    if (isPodcastIndexConfigured()) {
      try {
        const piPodcast = await getPodcastByItunesId(podcastId);
        if (piPodcast?.podcastIndexId) {
          const piEpisodes = await getEpisodesByFeedId(String(piPodcast.podcastIndexId));
          allEpisodes = piEpisodes.map((ep) => ({
            id: ep.id,
            podcastId,
            title: ep.title,
            description: ep.description,
            publishedAt: ep.publishedAt,
            duration: ep.duration,
            audioUrl: ep.audioUrl,
            artworkUrl: ep.artworkUrl,
            episodeNumber: ep.episodeNumber,
            seasonNumber: ep.seasonNumber,
          }));
          await setCached(cacheKey, allEpisodes, CacheTTL.EPISODES);
        }
      } catch (piErr) {
        console.error('Podcastindex episodes fetch failed:', piErr);
      }
    }

    // Fallback: fetch directly from RSS feed
    if (!allEpisodes) {
      try {
        let resolvedFeedUrl = feedUrl;

        if (!resolvedFeedUrl) {
          const podcast = await getPodcastById(podcastId);
          resolvedFeedUrl = podcast?.feedUrl;
        }

        if (!resolvedFeedUrl) {
          throw new Error('No feed URL available');
        }

        const response = await fetch(resolvedFeedUrl, {
          headers: { 'User-Agent': 'Sumfi/1.0' },
          // @ts-expect-error -- dispatcher is a valid undici option accepted by Node's built-in fetch
          dispatcher: largeFetchDispatcher,
        });
        if (!response.ok) {
          throw new Error(`Feed fetch failed: ${response.status}`);
        }
        const contentLength = response.headers.get('content-length');
        if (contentLength && parseInt(contentLength) > MAX_FEED_SIZE) {
          throw new Error('Feed too large to process');
        }
        const feedXml = await response.text();
        if (feedXml.length > MAX_FEED_SIZE) {
          throw new Error('Feed content exceeds size limit');
        }
        const feedData = await parser.parseString(feedXml) as unknown as ParsedRSSFeed;

        allEpisodes = feedData.items.map((item, index) => ({
          id: item.guid || `${podcastId}-${index}`,
          podcastId,
          title: item.title || 'Untitled Episode',
          description: item.contentSnippet || item.content || '',
          publishedAt: new Date(item.isoDate || item.pubDate || Date.now()),
          duration: parseDuration((item as any).duration),
          audioUrl: item.enclosure?.url,
          artworkUrl: (item as any).itunesImage?.$?.href || (item as any).itunes?.image || feedData.image?.url,
          episodeNumber: parseInt((item as any).episode, 10) || undefined,
          seasonNumber: parseInt((item as any).season, 10) || undefined,
        }));

        await setCached(cacheKey, allEpisodes, CacheTTL.EPISODES);
      } catch (err) {
        console.error('RSS feed fallback also failed:', err);
        throw new Error(`Failed to get episodes: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }
  }

  // Apply offset + limit slicing
  const sliced = allEpisodes.slice(offset, offset + limit);

  return {
    episodes: sliced,
    totalCount: allEpisodes.length,
    hasMore: offset + limit < allEpisodes.length,
  };
}

/**
 * Get full podcast with episodes
 */
export async function getPodcastFeed(
  podcastId: string,
  country: string = 'us',
  episodeLimit: number = 50
): Promise<ApplePodcastFeed | null> {
  const podcast = await getPodcastById(podcastId, country);
  if (!podcast) return null;

  const result = await getPodcastEpisodes(podcastId, podcast.feedUrl, episodeLimit);

  return { podcast, episodes: result.episodes };
}

/**
 * Get available genres
 */
export function getGenres(): AppleGenre[] {
  return APPLE_PODCAST_GENRES;
}

/**
 * Rate limiter for API calls (distributed via Redis)
 */
export async function checkRateLimit(userId: string, maxRequests = 30, windowSeconds = 60): Promise<boolean> {
  return redisRateLimit(userId, maxRequests, windowSeconds);
}
