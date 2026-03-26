import type { Metadata } from 'next';
import { createAdminClient } from '@/lib/supabase/admin';
import type { QuickSummaryContent, DeepSummaryContent } from '@/types/database';

function getBaseUrl() {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'https://www.yedapo.com';
}

async function getEpisodeData(id: string) {
  const supabase = createAdminClient();

  const [{ data: episode }, { data: quickSummary }, { data: deepSummary }] =
    await Promise.all([
      supabase
        .from('episodes')
        .select(
          'title, description, audio_url, published_at, duration_seconds, podcasts(title, image_url)'
        )
        .eq('id', id)
        .single(),
      supabase
        .from('summaries')
        .select('content_json')
        .eq('episode_id', id)
        .eq('level', 'quick')
        .eq('status', 'ready')
        .single(),
      supabase
        .from('summaries')
        .select('content_json')
        .eq('episode_id', id)
        .eq('level', 'deep')
        .eq('status', 'ready')
        .single(),
    ]);

  return { episode, quickSummary, deepSummary };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const { episode, quickSummary } = await getEpisodeData(id);

  if (!episode) {
    return { title: 'Episode Not Found — Yedapo' };
  }

  const podcastRaw = episode.podcasts;
  const podcast = (Array.isArray(podcastRaw) ? podcastRaw[0] : podcastRaw) as {
    title: string;
    image_url: string | null;
  } | null;
  const quick = quickSummary?.content_json as QuickSummaryContent | null;

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

export default async function InsightsLayout({
  params,
  children,
}: {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
}) {
  const { id } = await params;
  const { episode, quickSummary, deepSummary } = await getEpisodeData(id);

  if (!episode) {
    return <>{children}</>;
  }

  const podcastRaw = episode.podcasts;
  const podcast = (Array.isArray(podcastRaw) ? podcastRaw[0] : podcastRaw) as {
    title: string;
    image_url: string | null;
  } | null;
  const quick = quickSummary?.content_json as QuickSummaryContent | null;
  const deep = deepSummary?.content_json as DeepSummaryContent | null;
  const baseUrl = getBaseUrl();

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'PodcastEpisode',
    name: episode.title,
    description:
      quick?.executive_brief ||
      episode.description?.substring(0, 300) ||
      undefined,
    url: `${baseUrl}/episode/${id}/insights`,
    datePublished: episode.published_at || undefined,
    ...(episode.duration_seconds && {
      timeRequired: `PT${Math.floor(episode.duration_seconds / 60)}M${episode.duration_seconds % 60}S`,
    }),
    ...(episode.audio_url && {
      associatedMedia: {
        '@type': 'MediaObject',
        contentUrl: episode.audio_url,
      },
    }),
    ...(podcast && {
      partOfSeries: {
        '@type': 'PodcastSeries',
        name: podcast.title,
        ...(podcast.image_url && { image: podcast.image_url }),
      },
    }),
    ...(podcast?.image_url && { image: podcast.image_url }),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* Server-rendered summary content for SEO crawlers */}
      {(quick || deep) && (
        <div className="sr-only" aria-hidden="false">
          <h2>{episode.title} — AI Summary</h2>
          {quick?.executive_brief && (
            <section>
              <h3>Summary</h3>
              <p>{quick.executive_brief}</p>
            </section>
          )}
          {deep?.core_concepts && deep.core_concepts.length > 0 && (
            <section>
              <h3>Key Topics</h3>
              <ul>
                {deep.core_concepts.map((concept, i) => (
                  <li key={i}>
                    <strong>{concept.concept}</strong>: {concept.explanation}
                  </li>
                ))}
              </ul>
            </section>
          )}
          {deep?.actionable_takeaways &&
            deep.actionable_takeaways.length > 0 && (
              <section>
                <h3>Key Takeaways</h3>
                <ul>
                  {deep.actionable_takeaways.map((item, i) => (
                    <li key={i}>
                      {typeof item === 'string' ? item : item.text}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          {quick?.tags && quick.tags.length > 0 && (
            <p>Topics: {quick.tags.join(', ')}</p>
          )}
        </div>
      )}
      {children}
    </>
  );
}
