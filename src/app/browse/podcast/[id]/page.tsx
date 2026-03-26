import { redirect, notFound } from 'next/navigation';
import { getPodcastById, getPodcastEpisodes } from '@/lib/apple-podcasts';
import { getPodcastByFeedId, getEpisodesByFeedId } from '@/lib/podcast-index';
import BrowsePodcastClient from './BrowsePodcastClient';

// UUID v4 pattern — redirect to the internal podcast page
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const DEFAULT_COUNTRY = 'us';
const EPISODES_PER_PAGE = 50;

export default async function BrowsePodcastPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: podcastId } = await params;

  // Supabase UUIDs should be handled by /podcast/[id]
  if (UUID_RE.test(podcastId)) {
    redirect(`/podcast/${podcastId}`);
  }

  const isPodcastIndex = podcastId.startsWith('pi:');
  const piFeedId = isPodcastIndex ? podcastId.slice(3) : null;

  let initialPodcast: any = null;
  let initialEpisodes: any[] = [];
  let initialHasMore = false;
  let initialTotalCount = 0;

  try {
    if (isPodcastIndex && piFeedId) {
      const [podcast, allEpisodes] = await Promise.all([
        getPodcastByFeedId(piFeedId),
        getEpisodesByFeedId(piFeedId),
      ]);

      if (podcast) {
        initialPodcast = {
          id: podcastId,
          name: podcast.title,
          artistName: podcast.author,
          description: podcast.description,
          artworkUrl: podcast.artworkUrl,
          feedUrl: podcast.feedUrl,
          genres: [],
          trackCount: podcast.episodeCount,
        };
      }

      if (allEpisodes) {
        initialEpisodes = allEpisodes.slice(0, EPISODES_PER_PAGE);
        initialHasMore = allEpisodes.length > EPISODES_PER_PAGE;
        initialTotalCount = allEpisodes.length;
      }
    } else {
      const [podcast, episodesResult] = await Promise.all([
        getPodcastById(podcastId, DEFAULT_COUNTRY),
        getPodcastEpisodes(podcastId, undefined, EPISODES_PER_PAGE, 0),
      ]);

      if (podcast) {
        initialPodcast = {
          id: podcast.id,
          name: podcast.name,
          artistName: podcast.artistName,
          description: podcast.description,
          artworkUrl: podcast.artworkUrl,
          feedUrl: podcast.feedUrl,
          genres: podcast.genres || [],
          trackCount: podcast.trackCount,
          contentAdvisoryRating: podcast.contentAdvisoryRating,
        };
      }

      if (episodesResult) {
        initialEpisodes = episodesResult.episodes || [];
        initialHasMore = episodesResult.hasMore ?? false;
        initialTotalCount =
          episodesResult.totalCount ?? initialEpisodes.length;
      }
    }
  } catch (error) {
    console.error('Failed to fetch podcast data server-side:', error);
    // Client will handle the fallback fetch
  }

  return (
    <BrowsePodcastClient
      podcastId={podcastId}
      isPodcastIndex={isPodcastIndex}
      initialPodcast={initialPodcast}
      initialEpisodes={initialEpisodes}
      initialHasMore={initialHasMore}
      initialTotalCount={initialTotalCount}
      initialCountry={DEFAULT_COUNTRY}
    />
  );
}
