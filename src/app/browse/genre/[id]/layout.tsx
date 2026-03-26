import type { Metadata } from 'next';
import { APPLE_PODCAST_GENRES } from '@/types/apple-podcasts';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const genre = APPLE_PODCAST_GENRES.find((g) => g.id === id);
  const genreName = genre?.name || 'Podcasts';

  return {
    title: `${genreName} Podcasts — Yedapo`,
    description: `Discover the best ${genreName.toLowerCase()} podcasts. Browse top-rated shows with AI-powered summaries and insights.`,
    openGraph: {
      title: `${genreName} Podcasts — Yedapo`,
      description: `Top ${genreName.toLowerCase()} podcasts with AI-powered summaries.`,
      type: 'website',
      siteName: 'Yedapo',
    },
  };
}

export default function GenreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
