import type { Metadata } from 'next';
import { createAdminClient } from '@/lib/supabase/admin';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const supabase = createAdminClient();

  const { data: podcast } = await supabase
    .from('podcasts')
    .select('title, author, description, image_url')
    .eq('id', id)
    .single();

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

export default function PodcastLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
