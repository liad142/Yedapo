import type { Metadata } from 'next';
import { createAdminClient } from '@/lib/supabase/admin';
import type { QuickSummaryContent } from '@/types/database';

function getBaseUrl() {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:3000';
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const supabase = createAdminClient();

  const [{ data: episode }, { data: summary }] = await Promise.all([
    supabase
      .from('episodes')
      .select('title, description, podcasts(title, image_url)')
      .eq('id', id)
      .single(),
    supabase
      .from('summaries')
      .select('content_json')
      .eq('episode_id', id)
      .eq('level', 'quick')
      .eq('status', 'ready')
      .single(),
  ]);

  if (!episode) {
    return { title: 'Episode Not Found — Yedapo' };
  }

  const podcastRaw = episode.podcasts;
  const podcast = (Array.isArray(podcastRaw) ? podcastRaw[0] : podcastRaw) as { title: string; image_url: string | null } | null;
  const quick = summary?.content_json as QuickSummaryContent | null;

  const title = `${episode.title} — Yedapo`;
  const description =
    quick?.executive_brief ||
    episode.description?.substring(0, 200) ||
    `AI-powered insights for this episode from ${podcast?.title || 'a podcast'}`;

  const baseUrl = getBaseUrl();
  const ogImageUrl = `${baseUrl}/api/og/${id}`;
  const pageUrl = `${baseUrl}/episode/${id}/insights`;

  return {
    title,
    description,
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
          alt: `${episode.title} — Episode Insights`,
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

export default function InsightsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
