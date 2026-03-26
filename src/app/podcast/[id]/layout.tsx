import type { Metadata } from 'next';
import { fetchPodcast } from '@/lib/server/fetch-podcast';
import { podcastSeriesJsonLd } from '@/lib/server/json-ld';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const podcast = await fetchPodcast(id);

  if (!podcast) {
    return { title: 'Podcast Not Found — Yedapo' };
  }

  const title = `${podcast.title} — Yedapo`;
  const description =
    podcast.description?.substring(0, 200) ||
    `Listen to ${podcast.title}${podcast.author ? ` by ${podcast.author}` : ''} with AI-powered summaries and insights.`;

  return {
    title,
    description,
    openGraph: {
      title: podcast.title,
      description,
      type: 'website',
      siteName: 'Yedapo',
      ...(podcast.image_url && {
        images: [{ url: podcast.image_url, alt: podcast.title }],
      }),
    },
    twitter: {
      card: 'summary',
      title: podcast.title,
      description,
      ...(podcast.image_url && { images: [podcast.image_url] }),
    },
  };
}

export default async function PodcastLayout({
  params,
  children,
}: {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
}) {
  const { id } = await params;
  const podcast = await fetchPodcast(id);

  return (
    <>
      {podcast && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(podcastSeriesJsonLd(podcast)),
          }}
        />
      )}
      {children}
    </>
  );
}
