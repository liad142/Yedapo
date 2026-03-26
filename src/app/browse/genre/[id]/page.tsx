import { getPodcastsByGenre } from '@/lib/apple-podcasts';
import { APPLE_PODCAST_GENRES } from '@/types/apple-podcasts';
import GenrePageClient from './GenrePageClient';

const DEFAULT_COUNTRY = 'us';
const FETCH_LIMIT = 200;

export default async function GenrePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: genreId } = await params;

  const genreName =
    APPLE_PODCAST_GENRES.find((g) => g.id === genreId)?.name || 'Unknown Genre';

  let initialPodcasts: any[] = [];
  try {
    initialPodcasts = await getPodcastsByGenre(
      genreId,
      DEFAULT_COUNTRY,
      FETCH_LIMIT
    );
  } catch (error) {
    console.error('Failed to fetch genre podcasts server-side:', error);
  }

  return (
    <GenrePageClient
      genreId={genreId}
      genreName={genreName}
      initialPodcasts={initialPodcasts}
      initialCountry={DEFAULT_COUNTRY}
    />
  );
}
