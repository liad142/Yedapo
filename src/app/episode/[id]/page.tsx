import { notFound } from 'next/navigation';
import {
  fetchEpisodeWithPodcast,
  fetchEpisodeSummaries,
} from '@/lib/server/fetch-episode';
import { podcastEpisodeJsonLd } from '@/lib/server/json-ld';
import EpisodePageClient from './EpisodePageClient';

export default async function EpisodePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [episode, summaries] = await Promise.all([
    fetchEpisodeWithPodcast(id),
    fetchEpisodeSummaries(id),
  ]);

  if (!episode) {
    notFound();
  }

  const jsonLd = podcastEpisodeJsonLd(episode, episode.podcast);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <EpisodePageClient
        episode={episode}
        podcast={episode.podcast}
        summaries={summaries}
      />
    </>
  );
}
