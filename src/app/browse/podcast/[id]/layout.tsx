import type { Metadata } from 'next';
import { getPodcastById } from '@/lib/apple-podcasts';
import { getPodcastByFeedId } from '@/lib/podcast-index';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;

  // UUIDs redirect to /podcast/[id] — no metadata needed
  if (UUID_RE.test(id)) {
    return { title: 'Redirecting — Yedapo' };
  }

  let podcastName = 'Podcast';
  let description = '';
  let artworkUrl: string | undefined;

  try {
    if (id.startsWith('pi:')) {
      const feedId = id.slice(3);
      const podcast = await getPodcastByFeedId(feedId);
      if (podcast) {
        podcastName = podcast.title;
        description = podcast.description;
        artworkUrl = podcast.artworkUrl;
      }
    } else {
      const podcast = await getPodcastById(id, 'us');
      if (podcast) {
        podcastName = podcast.name;
        description = podcast.description;
        artworkUrl = podcast.artworkUrl;
      }
    }
  } catch {
    // Fall through with defaults
  }

  const title = `${podcastName} — Yedapo`;
  const desc =
    description?.substring(0, 200) ||
    `Listen to ${podcastName} with AI-powered summaries and insights.`;

  return {
    title,
    description: desc,
    openGraph: {
      title: podcastName,
      description: desc,
      type: 'website',
      siteName: 'Yedapo',
      ...(artworkUrl && {
        images: [{ url: artworkUrl, alt: podcastName }],
      }),
    },
    twitter: {
      card: 'summary',
      title: podcastName,
      description: desc,
      ...(artworkUrl && { images: [artworkUrl] }),
    },
  };
}

export default function BrowsePodcastLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
