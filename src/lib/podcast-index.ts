/**
 * Podcastindex.org API Client
 * Uses SHA1 auth per https://podcastindex-org.github.io/docs-api/
 * No npm dependencies - uses Node crypto
 */

import crypto from 'crypto';
import { getCached, setCached, CacheKeys, CacheTTL } from '@/lib/cache';
import { createLogger } from '@/lib/logger';
import type {
  PodcastIndexFeed,
  PodcastIndexEpisode,
  PodcastIndexSearchResponse,
  PodcastIndexEpisodesResponse,
  PodcastIndexTrendingResponse,
  PodcastIndexPodcastResponse,
} from '@/types/podcast-index';
import type { Podcast, PodcastEpisode } from '@/types/podcast';

const log = createLogger('podcast');

const PI_BASE_URL = 'https://api.podcastindex.org/api/1.0';

function getAuthHeaders(): Record<string, string> {
  const apiKey = process.env.PODCAST_INDEX_API_KEY;
  const apiSecret = process.env.PODCAST_INDEX_API_SECRET;

  if (!apiKey || !apiSecret) {
    throw new Error('Missing PODCAST_INDEX_API_KEY or PODCAST_INDEX_API_SECRET');
  }

  const now = Math.floor(Date.now() / 1000);
  const hash = crypto
    .createHash('sha1')
    .update(apiKey + apiSecret + now)
    .digest('hex');

  return {
    'X-Auth-Key': apiKey,
    'X-Auth-Date': String(now),
    'Authorization': hash,
    'User-Agent': 'Yedapo/1.0',
  };
}

async function piRequest<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${PI_BASE_URL}${path}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }

  const response = await fetch(url.toString(), {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Unauthorized');
    }
    throw new Error(`Podcastindex API returned ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

// --- Transform functions ---

export function transformFeed(feed: PodcastIndexFeed): Podcast {
  const categories = feed.categories
    ? Object.values(feed.categories)
    : [];

  return {
    id: feed.itunesId ? `apple:${feed.itunesId}` : `pi:${feed.id}`,
    source: feed.itunesId ? 'apple' : 'podcastindex',
    title: feed.title,
    author: feed.author || feed.ownerName,
    description: feed.description,
    artworkUrl: feed.artwork || feed.image,
    feedUrl: feed.url,
    genres: categories,
    episodeCount: feed.episodeCount,
    itunesId: feed.itunesId || undefined,
    podcastIndexId: feed.id,
    language: feed.language,
    explicit: feed.explicit,
  };
}

export function transformEpisode(episode: PodcastIndexEpisode, podcastId: string): PodcastEpisode {
  return {
    id: String(episode.id),
    podcastId,
    title: episode.title,
    description: episode.description,
    publishedAt: new Date(episode.datePublished * 1000),
    duration: episode.duration,
    audioUrl: episode.enclosureUrl,
    artworkUrl: episode.image || episode.feedImage,
    episodeNumber: episode.episode || undefined,
    seasonNumber: episode.season || undefined,
  };
}

// --- API functions ---

export async function searchPodcasts(term: string, limit: number = 20): Promise<Podcast[]> {
  const cacheKey = CacheKeys.piSearch(term, limit);
  const cached = await getCached<Podcast[]>(cacheKey);
  if (cached) return cached;

  const data = await piRequest<PodcastIndexSearchResponse>('/search/byterm', {
    q: term,
    max: String(limit),
  });

  const podcasts = data.feeds.map(transformFeed);
  await setCached(cacheKey, podcasts, CacheTTL.PI_SEARCH);
  return podcasts;
}

export async function getTrendingPodcasts(limit: number = 20, category?: string): Promise<Podcast[]> {
  const cacheKey = CacheKeys.piTrending(limit, category);
  const cached = await getCached<Podcast[]>(cacheKey);
  if (cached) return cached;

  const params: Record<string, string> = { max: String(limit) };
  if (category) params.cat = category;

  const data = await piRequest<PodcastIndexTrendingResponse>('/podcasts/trending', params);

  const podcasts = data.feeds.map(transformFeed);
  await setCached(cacheKey, podcasts, CacheTTL.PI_TRENDING);
  return podcasts;
}

export async function getPodcastByFeedId(feedId: string): Promise<Podcast | null> {
  const cacheKey = CacheKeys.piPodcast(feedId);
  const cached = await getCached<Podcast>(cacheKey);
  if (cached) return cached;

  try {
    const data = await piRequest<PodcastIndexPodcastResponse>('/podcasts/byfeedid', {
      id: feedId,
    });

    const podcast = transformFeed(data.feed);
    await setCached(cacheKey, podcast, CacheTTL.PI_PODCAST);
    return podcast;
  } catch (error) {
    if ((error as Error).message === 'Unauthorized') {
      return null;
    }
    log.error(`Failed to fetch podcast by feedId ${feedId}`, error);
    return null;
  }
}

export async function getPodcastByItunesId(itunesId: string): Promise<Podcast | null> {
  const cacheKey = CacheKeys.piPodcast(`itunes:${itunesId}`);
  const cached = await getCached<Podcast>(cacheKey);
  if (cached) return cached;

  try {
    const data = await piRequest<PodcastIndexPodcastResponse>('/podcasts/byitunesid', {
      id: itunesId,
    });

    const podcast = transformFeed(data.feed);
    await setCached(cacheKey, podcast, CacheTTL.PI_PODCAST);
    return podcast;
  } catch (error) {
    if ((error as Error).message === 'Unauthorized') {
      return null;
    }
    log.error(`Failed to fetch podcast by itunesId ${itunesId}`, error);
    return null;
  }
}

export async function getEpisodesByFeedId(feedId: string): Promise<PodcastEpisode[]> {
  const cacheKey = CacheKeys.piEpisodes(feedId);
  const cached = await getCached<PodcastEpisode[]>(cacheKey);
  // Only trust cache if it has a reasonable number of episodes;
  // tiny cached results likely came from an earlier partial fetch.
  if (cached && cached.length >= 10) return cached;

  // Fetch a large batch and cache all; callers apply offset/limit slicing
  const data = await piRequest<PodcastIndexEpisodesResponse>('/episodes/byfeedid', {
    id: feedId,
    max: '1000',
  });

  const podcastId = `pi:${feedId}`;
  const episodes = data.items.map((ep) => transformEpisode(ep, podcastId));
  await setCached(cacheKey, episodes, CacheTTL.PI_EPISODES);
  return episodes;
}

/**
 * Check if Podcastindex API is configured
 */
export function isPodcastIndexConfigured(): boolean {
  return !!(process.env.PODCAST_INDEX_API_KEY && process.env.PODCAST_INDEX_API_SECRET);
}
