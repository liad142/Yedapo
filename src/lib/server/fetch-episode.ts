import { cache } from 'react';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Episode, DbPodcast, SummaryStatus } from '@/types/database';

/**
 * Server-side episode data fetching helpers.
 * Uses createAdminClient() — only import from Server Components.
 *
 * Wrapped in React.cache() to deduplicate calls within a single request
 * (e.g. layout.tsx generateMetadata + page.tsx both call the same function).
 */

export interface EpisodeWithPodcast extends Episode {
  podcast: DbPodcast | null;
}

export interface EpisodeSummaries {
  quick: { status: SummaryStatus } | null;
  deep: { status: SummaryStatus } | null;
}

export const fetchEpisodeWithPodcast = cache(async function fetchEpisodeWithPodcast(
  id: string
): Promise<EpisodeWithPodcast | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('episodes')
    .select('*, podcasts(*)')
    .eq('id', id)
    .single();

  if (error || !data) return null;

  const podcastRaw = data.podcasts;
  const podcast = Array.isArray(podcastRaw) ? podcastRaw[0] : podcastRaw;

  return {
    ...data,
    podcast: podcast || null,
  } as EpisodeWithPodcast;
});

export const fetchEpisodeSummaries = cache(async function fetchEpisodeSummaries(
  episodeId: string
): Promise<EpisodeSummaries> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('summaries')
    .select('level, status')
    .eq('episode_id', episodeId)
    .in('level', ['quick', 'deep']);

  if (error || !data) {
    return { quick: null, deep: null };
  }

  const quick = data.find((s: any) => s.level === 'quick');
  const deep = data.find((s: any) => s.level === 'deep');

  return {
    quick: quick ? { status: quick.status as SummaryStatus } : null,
    deep: deep ? { status: deep.status as SummaryStatus } : null,
  };
});
