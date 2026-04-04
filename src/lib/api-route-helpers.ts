import { createLogger } from '@/lib/logger';
import { createAdminClient } from '@/lib/supabase/admin';

const log = createLogger('api-route-helpers');

export const SUBSCRIBED_EPISODE_LOOKBACK_DAYS = 90;
export const SUBSCRIBED_EPISODE_FETCH_LIMIT = 500;

export async function getRecentEpisodeIdsForPodcasts(
  podcastIds: string[],
  options?: {
    limit?: number;
    lookbackDays?: number;
  }
): Promise<string[]> {
  if (podcastIds.length === 0) return [];

  const limit = options?.limit ?? SUBSCRIBED_EPISODE_FETCH_LIMIT;
  const lookbackDays = options?.lookbackDays ?? SUBSCRIBED_EPISODE_LOOKBACK_DAYS;
  const since = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString();

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('episodes')
      .select('id')
      .in('podcast_id', podcastIds)
      .gte('published_at', since)
      .order('published_at', { ascending: false })
      .limit(limit);

    if (error) {
      log.error('Failed to fetch recent episode ids', {
        podcastCount: podcastIds.length,
        message: error.message,
      });
      return [];
    }

    return (data || []).map((episode: { id: string }) => episode.id);
  } catch (error) {
    log.error('Unexpected error fetching recent episode ids', {
      podcastCount: podcastIds.length,
      error: String(error),
    });
    return [];
  }
}
