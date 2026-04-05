/**
 * Centralized Cache Utility
 * Uses Upstash Redis via Vercel Marketplace integration
 * 
 * Env vars (auto-injected by Vercel):
 * - UPSTASH_REDIS_REST_URL
 * - UPSTASH_REDIS_REST_TOKEN
 */

import { Redis } from '@upstash/redis';
import { createLogger } from '@/lib/logger';

const log = createLogger('cache');

// Singleton Redis client
let redis: Redis | null = null;

function getRedis(): Redis {
  if (!redis) {
    const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
    const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();

    if (!url || !token) {
      throw new Error('Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN environment variables');
    }

    redis = new Redis({ url, token });
  }
  return redis;
}

/**
 * Get cached value from Redis
 * Returns null on cache miss or error (graceful degradation)
 */
export async function getCached<T>(key: string): Promise<T | null> {
  try {
    const client = getRedis();
    const cached = await client.get<T>(key);
    
    log.info(cached ? 'HIT' : 'MISS', { key });
    return cached;
  } catch (error) {
    log.error('Failed to get', { key, error: String(error) });
    return null; // Graceful fallback - don't break the app
  }
}

/**
 * Set cached value in Redis with TTL
 * @param key - Cache key
 * @param value - Value to cache (will be JSON serialized)
 * @param ttlSeconds - Time to live in seconds (default: 1 hour)
 */
export async function setCached<T>(
  key: string,
  value: T,
  ttlSeconds = 3600
): Promise<void> {
  try {
    const client = getRedis();
    await client.set(key, value, { ex: ttlSeconds });
    log.info('SET', { key, ttlSeconds });
  } catch (error) {
    log.error('Failed to set', { key, error: String(error) });
    // Don't throw - cache failures shouldn't break the app
  }
}

/**
 * Delete cached value
 */
export async function deleteCached(key: string): Promise<void> {
  try {
    const client = getRedis();
    await client.del(key);
    log.info('DELETE', { key });
  } catch (error) {
    log.error('Failed to delete', { key, error: String(error) });
  }
}

/**
 * Check if key exists in cache
 */
export async function hasCached(key: string): Promise<boolean> {
  try {
    const client = getRedis();
    const exists = await client.exists(key);
    return exists === 1;
  } catch (error) {
    log.error('Failed to check existence', { key, error: String(error) });
    return false;
  }
}

/**
 * Get multiple cached values at once
 */
export async function getCachedMulti<T>(keys: string[]): Promise<(T | null)[]> {
  if (keys.length === 0) return [];
  
  try {
    const client = getRedis();
    const values = await client.mget<T[]>(...keys);
    
    keys.forEach((key, i) => {
      log.info(values[i] ? 'HIT' : 'MISS', { key });
    });

    return values;
  } catch (error) {
    log.error('Failed to mget', { keyCount: keys.length, error: String(error) });
    return keys.map(() => null);
  }
}

/**
 * Acquire a distributed lock using Redis SET NX EX.
 * Returns true if the lock was acquired, false if already held.
 *
 * IMPORTANT: Fails OPEN on Redis errors — if Redis is down, we allow the
 * operation to proceed rather than blocking it. Duplicate work is better
 * than zero work.
 */
export async function acquireLock(key: string, ttlSeconds: number): Promise<boolean> {
  try {
    const client = getRedis();
    // SET NX returns 'OK' if the key was set, null if it already exists
    const result = await client.set(key, Date.now(), { nx: true, ex: ttlSeconds });
    if (result !== 'OK') {
      log.warn('Lock already held', { key });
    }
    return result === 'OK';
  } catch (error) {
    log.error('Redis unavailable for lock — failing OPEN (allowing operation)', { key, error: String(error) });
    return true; // Fail open: allow the operation to proceed without a lock
  }
}

/**
 * Release a distributed lock.
 */
export async function releaseLock(key: string): Promise<void> {
  try {
    const client = getRedis();
    await client.del(key);
  } catch (error) {
    log.error('Failed to release lock', { key, error: String(error) });
  }
}

/**
 * Cache key builders for consistent naming
 */
export const CacheKeys = {
  searchPodcasts: (country: string, term: string, limit: number) =>
    `apple:search:${country.toLowerCase()}:${term}:${limit}`,

  topPodcasts: (country: string, genreId: string | undefined, limit: number) =>
    `apple:top:${country.toLowerCase()}:${genreId || 'all'}:${limit}`,

  podcastEpisodes: (podcastId: string) =>
    `apple:episodes:${podcastId}`,

  podcastDetails: (podcastId: string, country: string) =>
    `apple:podcast:${podcastId}:${country.toLowerCase()}`,

  youtubeFeed: (channelIdOrHandle: string) =>
    `youtube:${channelIdOrHandle}`,

  youtubeTrending: (country: string, limit: number) =>
    `youtube:trending:${country}:${limit}`,

  batchEpisodes: (country: string, hash: string) =>
    `batch:episodes:${country}:${hash}`,

  // Podcastindex cache keys
  piSearch: (term: string, limit: number) =>
    `pi:search:${term}:${limit}`,

  piTrending: (limit: number, category?: string) =>
    `pi:trending:${limit}:${category || 'all'}`,

  piEpisodes: (feedId: string) =>
    `pi:episodes:${feedId}`,

  piPodcast: (feedId: string) =>
    `pi:podcast:${feedId}`,

  unifiedSearch: (term: string, country: string, limit: number) =>
    `unified:search:${country.toLowerCase()}:${term}:${limit}`,

  episodeDetail: (episodeId: string) =>
    `episode:${episodeId}`,

  summaryStatus: (episodeId: string, language: string) =>
    `summary:status:${episodeId}:${language}`,

  insightsStatus: (episodeId: string, language: string) =>
    `insights:status:${episodeId}:${language}`,

  // Per-resource refresh markers — first user to hit a stale marker triggers
  // the expensive external fetch (YouTube API / RSS). TTL: 24h.
  youtubeChannelRefresh: (channelId: string) =>
    `yt:ch:${channelId}:refreshed`,

  podcastFeedRefresh: (podcastId: string) =>
    `pod:feed:${podcastId}:refreshed`,

};

/**
 * TTL constants (in seconds)
 */
export const CacheTTL = {
  SEARCH: 1800,            // 30 minutes
  TOP_PODCASTS: 3600,      // 1 hour
  EPISODES: 3600,          // 1 hour
  PODCAST_DETAILS: 3600,   // 1 hour
  YOUTUBE_FEED: 1800,      // 30 minutes
  YOUTUBE_TRENDING: 1800,  // 30 minutes
  BATCH_REQUESTS: 3600,    // 1 hour (aligned with TOP_PODCASTS TTL)

  // Podcastindex TTLs
  PI_SEARCH: 1800,           // 30 minutes
  PI_TRENDING: 3600,         // 1 hour
  PI_EPISODES: 3600,         // 1 hour
  PI_PODCAST: 3600,          // 1 hour
  UNIFIED_SEARCH: 900,       // 15 minutes

  // Episode detail & status caching
  EPISODE_DETAIL_READY: 86400,   // 24 hours (summary ready)
  EPISODE_DETAIL_SHORT: 300,     // 5 minutes (still processing)
  STATUS_TERMINAL: 3600,         // 1 hour (safety net — routes invalidate on retry)
};

/**
 * Distributed rate limiter using Redis
 * Uses fixed-window counters keyed by time bucket.
 * Each window gets its own key that auto-expires, so the counter
 * resets naturally — even if denied requests keep arriving.
 */
export async function checkRateLimit(
  identifier: string,
  maxRequests: number = 30,
  windowSeconds: number = 60,
  failOpen: boolean = true
): Promise<boolean> {
  try {
    const client = getRedis();
    const windowId = Math.floor(Date.now() / 1000 / windowSeconds);
    const key = `ratelimit:${identifier}:${windowId}`;

    const pipeline = client.pipeline();
    pipeline.incr(key);
    // TTL slightly longer than window to avoid premature expiry at boundary
    pipeline.expire(key, windowSeconds + 5);
    const results = await pipeline.exec();

    const count = results[0] as number;
    return count <= maxRequests;
  } catch (error) {
    log.error('Rate limit check failed', { identifier, error: String(error) });
    // failOpen=true: if Redis is down, don't block users (default for non-critical)
    // failOpen=false: if Redis is down, block requests (for high-cost AI endpoints)
    return failOpen;
  }
}

/**
 * Per-user daily quota tracking using Redis
 * Key pattern: quota:{feature}:{userId}:{YYYY-MM-DD}
 * Auto-expires at end of day (max 48h TTL to handle timezone edge cases)
 */
export async function checkQuota(
  userId: string,
  feature: string,
  maxPerDay: number
): Promise<{ allowed: boolean; used: number; limit: number }> {
  try {
    const client = getRedis();
    const today = new Date().toISOString().slice(0, 10);
    const key = `quota:${feature}:${userId}:${today}`;

    // Check current usage first
    const current = await client.get<number>(key);
    const used = current || 0;

    if (used >= maxPerDay) {
      return { allowed: false, used, limit: maxPerDay };
    }

    // Increment only if allowed
    const newCount = await client.incr(key);
    // Set TTL on first use (48h for timezone edges)
    if (newCount === 1) {
      await client.expire(key, 172800);
    }

    return { allowed: true, used: newCount, limit: maxPerDay };
  } catch (error) {
    log.error('Quota check failed — failing OPEN (Redis unavailable)', { feature, userId: userId.slice(0, 8), error: String(error) });
    // Fail open: if Redis is down, allow the request rather than blocking all users
    return { allowed: true, used: 0, limit: maxPerDay };
  }
}

/**
 * Get current quota usage without incrementing
 */
export async function getQuotaUsage(
  userId: string,
  feature: string
): Promise<number> {
  try {
    const client = getRedis();
    const today = new Date().toISOString().slice(0, 10);
    const key = `quota:${feature}:${userId}:${today}`;
    const count = await client.get<number>(key);
    return count || 0;
  } catch {
    return 0;
  }
}

/**
 * Plan-aware quota check.
 * For unlimited plans (Infinity), skips Redis entirely.
 */
export async function checkPlanQuota(
  userId: string,
  feature: string,
  maxPerDay: number
): Promise<{ allowed: boolean; used: number; limit: number }> {
  if (!isFinite(maxPerDay)) {
    return { allowed: true, used: 0, limit: maxPerDay };
  }
  return checkQuota(userId, feature, maxPerDay);
}

/**
 * Get Redis health info for admin dashboard
 */
export async function getCacheHealth(): Promise<{
  connected: boolean;
  latencyMs: number;
  cacheKeys: number;
}> {
  try {
    const client = getRedis();
    const start = Date.now();
    await client.ping();
    const latencyMs = Date.now() - start;
    const cacheKeys = await client.dbsize();
    return { connected: true, latencyMs, cacheKeys };
  } catch {
    return { connected: false, latencyMs: -1, cacheKeys: 0 };
  }
}
