import { redirect, notFound } from 'next/navigation';
import { fetchPodcast, fetchPodcastEpisodes } from '@/lib/server/fetch-podcast';
import { podcastSeriesJsonLd } from '@/lib/server/json-ld';
import PodcastPageClient from './PodcastPageClient';

export default async function PodcastPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const podcast = await fetchPodcast(id);

  if (!podcast) {
    notFound();
  }

  // Apple podcasts should use the browse page for full episode catalog
  if (podcast.rss_feed_url?.startsWith('apple:')) {
    const appleId = podcast.rss_feed_url.replace('apple:', '');
    redirect(`/browse/podcast/${appleId}`);
  }

  const episodes = await fetchPodcastEpisodes(id);

  const jsonLd = podcastSeriesJsonLd(podcast);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <PodcastPageClient podcast={podcast} initialEpisodes={episodes} />
    </>
  );
}
