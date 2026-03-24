import type { MetadataRoute } from 'next';
import { createAdminClient } from '@/lib/supabase/admin';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://pod-catch.vercel.app';
  const supabase = createAdminClient();

  const [
    { data: episodes },
    { data: podcasts },
    { data: youtubeChannels },
  ] = await Promise.all([
    supabase
      .from('episodes')
      .select('id, published_at, created_at, podcast_id')
      .order('published_at', { ascending: false })
      .limit(5000),
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

  // Fetch episodes that have ready summaries for higher priority
  const { data: readySummaries } = await supabase
    .from('summaries')
    .select('episode_id')
    .eq('status', 'ready')
    .eq('level', 'deep');

  const episodesWithSummaries = new Set(
    readySummaries?.map((s) => s.episode_id) || []
  );

  // Static pages
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

  // Episode pages — episodes with summaries get higher priority
  const episodePages: MetadataRoute.Sitemap = (episodes || []).map((ep) => ({
    url: `${baseUrl}/episode/${ep.id}/insights`,
    lastModified: new Date(ep.published_at || ep.created_at),
    changeFrequency: 'weekly' as const,
    priority: episodesWithSummaries.has(ep.id) ? 0.8 : 0.5,
  }));

  // Podcast pages
  const podcastPages: MetadataRoute.Sitemap = (podcasts || []).map((p) => ({
    url: `${baseUrl}/podcast/${p.id}`,
    lastModified: new Date(p.latest_episode_date || p.created_at),
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }));

  // YouTube channel pages
  const channelPages: MetadataRoute.Sitemap = (youtubeChannels || []).map(
    (ch) => ({
      url: `${baseUrl}/browse/youtube/${ch.id}`,
      lastModified: new Date(ch.updated_at || ch.created_at),
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    })
  );

  return [...staticPages, ...episodePages, ...podcastPages, ...channelPages];
}
