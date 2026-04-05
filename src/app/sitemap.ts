import type { MetadataRoute } from 'next';
import { createAdminClient } from '@/lib/supabase/admin';

// Google recommends max 50,000 URLs per sitemap. We use 1,000 per chunk
// so each sitemap stays under 50KB (fast crawl, easy to diagnose).
const EPISODES_PER_SITEMAP = 1000;

/**
 * Next.js calls generateSitemaps() to determine how many sitemap files to
 * emit. For each { id } returned, it calls sitemap({ id }) and serves the
 * result at /sitemap/{id}.xml. A sitemap index at /sitemap.xml ties them
 * together automatically.
 */
export async function generateSitemaps() {
  const supabase = createAdminClient();
  const { count } = await supabase
    .from('episodes')
    .select('*', { count: 'exact', head: true });

  const episodeCount = count ?? 0;
  const chunkCount = Math.max(1, Math.ceil(episodeCount / EPISODES_PER_SITEMAP));

  return Array.from({ length: chunkCount }, (_, id) => ({ id }));
}

export default async function sitemap({
  id,
}: {
  id: number;
}): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.yedapo.com';
  const supabase = createAdminClient();

  // Fetch this chunk's episodes (most recent first)
  const offset = id * EPISODES_PER_SITEMAP;
  const { data: episodes } = await supabase
    .from('episodes')
    .select('id, published_at, created_at')
    .order('published_at', { ascending: false })
    .range(offset, offset + EPISODES_PER_SITEMAP - 1);

  // Fetch which episodes have ready summaries (higher priority in sitemap)
  const episodeIds = (episodes || []).map((e) => e.id);
  const { data: readySummaries } = episodeIds.length
    ? await supabase
        .from('summaries')
        .select('episode_id')
        .in('episode_id', episodeIds)
        .eq('status', 'ready')
        .eq('level', 'deep')
    : { data: [] };

  const episodesWithSummaries = new Set(
    (readySummaries || []).map((s) => s.episode_id)
  );

  const episodePages: MetadataRoute.Sitemap = (episodes || []).map((ep) => ({
    url: `${baseUrl}/episode/${ep.id}/insights`,
    lastModified: new Date(ep.published_at || ep.created_at),
    changeFrequency: 'weekly' as const,
    priority: episodesWithSummaries.has(ep.id) ? 0.8 : 0.5,
  }));

  // First chunk (id === 0) ALSO includes static pages, podcasts, and channels.
  // Subsequent chunks are episode-only.
  if (id !== 0) {
    return episodePages;
  }

  const [{ data: podcasts }, { data: youtubeChannels }] = await Promise.all([
    supabase
      .from('podcasts')
      .select('id, latest_episode_date, created_at')
      .order('latest_episode_date', { ascending: false, nullsFirst: false })
      .limit(1000),
    supabase
      .from('youtube_channels')
      .select('id, updated_at, created_at')
      .limit(500),
  ]);

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${baseUrl}/discover`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/summaries`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/pricing`,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/privacy`,
      changeFrequency: 'yearly',
      priority: 0.2,
    },
    {
      url: `${baseUrl}/terms`,
      changeFrequency: 'yearly',
      priority: 0.2,
    },
  ];

  const podcastPages: MetadataRoute.Sitemap = (podcasts || []).map((p) => ({
    url: `${baseUrl}/podcast/${p.id}`,
    lastModified: new Date(p.latest_episode_date || p.created_at),
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }));

  const channelPages: MetadataRoute.Sitemap = (youtubeChannels || []).map(
    (ch) => ({
      url: `${baseUrl}/browse/youtube/${ch.id}`,
      lastModified: new Date(ch.updated_at || ch.created_at),
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    })
  );

  return [...staticPages, ...podcastPages, ...channelPages, ...episodePages];
}
