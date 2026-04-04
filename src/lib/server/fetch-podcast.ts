import { cache } from 'react';
import { createAdminClient } from '@/lib/supabase/admin';
import type { DbPodcast, Episode } from '@/types/database';
import type { PodcastDetailEpisode } from '@/types/podcast';

/**
 * Server-side podcast data fetching helpers.
 * Uses createAdminClient() — only import from Server Components.
 *
 * Wrapped in React.cache() to deduplicate calls within a single request
 * (e.g. layout.tsx generateMetadata + page.tsx both call the same function).
 */

export const fetchPodcast = cache(async function fetchPodcast(id: string): Promise<DbPodcast | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('podcasts')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) return null;
  return data as DbPodcast;
});

export const fetchPodcastEpisodes = cache(async function fetchPodcastEpisodes(
  podcastId: string
): Promise<PodcastDetailEpisode[]> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('episodes')
    .select(
      'id, podcast_id, title, description, audio_url, duration_seconds, published_at, created_at'
    )
    .eq('podcast_id', podcastId)
    .order('published_at', { ascending: false })
    .limit(100);

  if (error || !data) return [];

  return data.map((ep: any) => ({
    id: ep.id,
    podcastId: ep.podcast_id,
    title: ep.title,
    description: ep.description || '',
    publishedAt: ep.published_at || ep.created_at,
    duration: ep.duration_seconds || 0,
    audioUrl: ep.audio_url,
    isFromDb: true,
  }));
});
