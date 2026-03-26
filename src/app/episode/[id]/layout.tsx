import type { Metadata } from 'next';
import { fetchEpisodeWithPodcast } from '@/lib/server/fetch-episode';
import { podcastEpisodeJsonLd } from '@/lib/server/json-ld';

function getBaseUrl() {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'https://www.yedapo.com';
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const episode = await fetchEpisodeWithPodcast(id);

  if (!episode) {
    return { title: 'Episode Not Found — Yedapo' };
  }

  const title = `${episode.title} — Yedapo`;
  const description =
    episode.description?.substring(0, 200) ||
    `Listen to ${episode.title}${episode.podcast ? ` from ${episode.podcast.title}` : ''} with AI-powered summaries and insights.`;

  const baseUrl = getBaseUrl();
  const ogImageUrl = `${baseUrl}/api/og/${id}`;
  const pageUrl = `${baseUrl}/episode/${id}`;

  return {
    title,
    description,
    alternates: {
      canonical: pageUrl,
    },
    openGraph: {
      title: episode.title,
      description,
      type: 'article',
      url: pageUrl,
      siteName: 'Yedapo',
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: `${episode.title} — Episode`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: episode.title,
      description,
      images: [ogImageUrl],
    },
  };
}

export default async function EpisodeLayout({
  params,
  children,
}: {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
}) {
  const { id } = await params;
  const episode = await fetchEpisodeWithPodcast(id);

  return (
    <>
      {episode && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(
              podcastEpisodeJsonLd(episode, episode.podcast)
            ),
          }}
        />
      )}
      {children}
    </>
  );
}
