import type { DbPodcast, Episode, QuickSummaryContent } from '@/types/database';

/**
 * JSON-LD structured data helpers for SEO.
 * Only import from Server Components.
 */

function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'https://www.yedapo.com';
}

export function podcastSeriesJsonLd(podcast: DbPodcast) {
  const baseUrl = getBaseUrl();

  return {
    '@context': 'https://schema.org',
    '@type': 'PodcastSeries',
    name: podcast.title,
    description: podcast.description?.substring(0, 300) || undefined,
    url: `${baseUrl}/podcast/${podcast.id}`,
    ...(podcast.author && { author: { '@type': 'Person', name: podcast.author } }),
    ...(podcast.image_url && { image: podcast.image_url }),
    ...(podcast.language && { inLanguage: podcast.language }),
  };
}

export function podcastEpisodeJsonLd(
  episode: Episode,
  podcast: DbPodcast | null,
  summary?: { content_json?: QuickSummaryContent | null } | null
) {
  const baseUrl = getBaseUrl();
  const quick = summary?.content_json;

  return {
    '@context': 'https://schema.org',
    '@type': 'PodcastEpisode',
    name: episode.title,
    description:
      quick?.executive_brief ||
      episode.description?.substring(0, 300) ||
      undefined,
    url: `${baseUrl}/episode/${episode.id}`,
    datePublished: episode.published_at || undefined,
    ...(episode.duration_seconds && {
      timeRequired: `PT${Math.floor(episode.duration_seconds / 60)}M${episode.duration_seconds % 60}S`,
    }),
    ...(episode.audio_url && {
      associatedMedia: {
        '@type': 'MediaObject',
        contentUrl: episode.audio_url,
      },
    }),
    ...(podcast && {
      partOfSeries: {
        '@type': 'PodcastSeries',
        name: podcast.title,
        ...(podcast.image_url && { image: podcast.image_url }),
      },
    }),
    ...(podcast?.image_url && { image: podcast.image_url }),
  };
}
