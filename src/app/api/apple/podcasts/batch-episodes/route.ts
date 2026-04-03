import { NextRequest, NextResponse } from 'next/server';
import { getPodcastEpisodes } from '@/lib/apple-podcasts';
import { getCached, setCached, CacheKeys, CacheTTL, checkRateLimit } from '@/lib/cache';
import crypto from 'crypto';

interface PodcastEpisodesRequest {
  podcastId: string;
  limit: number;
}

// Create a stable cache key from request parameters
function createCacheKey(podcasts: PodcastEpisodesRequest[], country: string): string {
  const sortedPodcasts = [...podcasts].sort((a, b) => a.podcastId.localeCompare(b.podcastId));
  const payload = JSON.stringify({ podcasts: sortedPodcasts, country });
  const hash = crypto.createHash('md5').update(payload).digest('hex').substring(0, 16);
  return CacheKeys.batchEpisodes(country, hash);
}

export async function POST(request: NextRequest) {
  // IP-based rate limit since this endpoint has no auth guard
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const rlAllowed = await checkRateLimit(`batch-episodes:${ip}`, 10, 60);
  if (!rlAllowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

  try {
    const body = await request.json();
    const { podcasts, country = 'us' } = body as {
      podcasts: PodcastEpisodesRequest[];
      country?: string;
    };

    if (!podcasts || !Array.isArray(podcasts) || podcasts.length === 0) {
      return NextResponse.json(
        { error: 'podcasts array is required' },
        { status: 400 }
      );
    }

    // Limit batch size to prevent abuse
    if (podcasts.length > 20) {
      return NextResponse.json(
        { error: 'Maximum 20 podcasts per batch' },
        { status: 400 }
      );
    }

    // Check Redis cache for this exact batch request
    const cacheKey = createCacheKey(podcasts, country);
    const cached = await getCached<{ results: any[]; count: number }>(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }

    // Fetch episodes for all podcasts in parallel with timeout protection
    // Use Promise.allSettled to prevent one failure from blocking others
    const episodesPromises = podcasts.map(async ({ podcastId, limit }) => {
      try {
        // Add 8-second timeout per podcast to prevent slow feeds from blocking
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout after 8 seconds')), 8000)
        );

        const episodesPromise = getPodcastEpisodes(podcastId, undefined, limit);

        const result = await Promise.race([episodesPromise, timeoutPromise]) as any;

        return {
          podcastId,
          episodes: result.episodes,
          success: true,
        };
      } catch (error) {
        console.error(`Error fetching episodes for podcast ${podcastId}:`, error);
        return {
          podcastId,
          episodes: [],
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    // Use allSettled to ensure we get partial results even if some fail
    const settledResults = await Promise.allSettled(episodesPromises);

    // Extract fulfilled values, treating rejected promises as failed fetches
    const results = settledResults.map(result => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        // If the promise itself was rejected, return a failed result
        return {
          podcastId: 'unknown',
          episodes: [],
          success: false,
          error: result.reason?.message || 'Promise rejected',
        };
      }
    });

    const responseData = { results, count: results.length };

    // Only cache if all results were successful (don't cache partial failures)
    const allSuccess = results.every(r => r.success);
    if (allSuccess) {
      await setCached(cacheKey, responseData, CacheTTL.BATCH_REQUESTS);
    }

    return NextResponse.json(responseData);
  } catch (error) {
    console.error('Batch episodes error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch episodes' },
      { status: 500 }
    );
  }
}
