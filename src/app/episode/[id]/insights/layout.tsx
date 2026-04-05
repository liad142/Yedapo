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
          'title, description, audio_url, published_at, duration_seconds, podcast_id, podcasts(title, image_url)'
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
  const { episode, quickSummary, deepSummary } = await getEpisodeData(id);

  if (!episode) {
    return { title: 'Episode Not Found — Yedapo' };
  }

  const podcastRaw = episode.podcasts;
  const podcast = (Array.isArray(podcastRaw) ? podcastRaw[0] : podcastRaw) as {
    title: string;
    image_url: string | null;
  } | null;
  const quick = quickSummary?.content_json as QuickSummaryContent | null;
  const deep = deepSummary?.content_json as DeepSummaryContent | null;

  // Title format: "{Episode Title} — {Podcast Name} | Yedapo"
  // Podcast name in the title tag is a strong keyword signal for branded
  // podcast searches ("lex fridman ai agents" picks up the podcast name).
  const title = podcast?.title
    ? `${episode.title} — ${podcast.title} | Yedapo`
    : `${episode.title} — Yedapo`;
  const description =
    quick?.executive_brief ||
    episode.description?.substring(0, 200) ||
    `AI-powered insights for this episode from ${podcast?.title || 'a podcast'}`;

  // Assemble keywords from tags, topic_tags, and core concept names.
  // Google gives `keywords` meta tag minimal weight, but it's free signal.
  const quickTags = quick?.tags ?? [];
  const deepTopicTags = deep?.topic_tags ?? [];
  const concepts = (deep?.core_concepts ?? [])
    .slice(0, 5)
    .map((c) => c.concept);
  const keywordSet = Array.from(
    new Set(
      [...quickTags, ...deepTopicTags, ...concepts, podcast?.title ?? '']
        .filter(Boolean)
        .map((k) => k.toLowerCase().trim())
    )
  );

  const baseUrl = getBaseUrl();
  const ogImageUrl = `${baseUrl}/api/og/${id}`;
  const pageUrl = `${baseUrl}/episode/${id}/insights`;

  return {
    title,
    description,
    keywords: keywordSet.length > 0 ? keywordSet : undefined,
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

  // Detect YouTube-sourced episodes via audio_url. When audio_url points at
  // youtube.com/watch?v=X, we emit a VideoObject schema instead of (or in
  // addition to) PodcastEpisode — gets YouTube Rich Results treatment.
  const ytMatch = episode.audio_url?.match(/youtube\.com\/watch\?v=([\w-]{11})/);
  const isYouTube = !!ytMatch;
  const youtubeVideoId = ytMatch?.[1];
  const episodeUrl = `${baseUrl}/episode/${id}/insights`;
  const episodeDescription =
    quick?.executive_brief ||
    episode.description?.substring(0, 300) ||
    undefined;

  // Keywords from topic_tags + core concepts for JSON-LD (modest Google signal)
  const jsonLdKeywords = Array.from(
    new Set(
      [
        ...(quick?.tags ?? []),
        ...(deep?.topic_tags ?? []),
        ...(deep?.core_concepts ?? []).slice(0, 5).map((c) => c.concept),
      ]
        .filter(Boolean)
        .map((k) => k.trim())
    )
  );

  const podcastEpisodeLd = {
    '@context': 'https://schema.org',
    '@type': 'PodcastEpisode',
    name: episode.title,
    description: episodeDescription,
    url: episodeUrl,
    datePublished: episode.published_at || undefined,
    ...(jsonLdKeywords.length > 0 && { keywords: jsonLdKeywords.join(', ') }),
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

  // VideoObject schema for YouTube-sourced episodes — eligible for
  // YouTube Rich Results (thumbnail carousel) in Google SERP.
  const videoObjectLd = isYouTube
    ? {
        '@context': 'https://schema.org',
        '@type': 'VideoObject',
        name: episode.title,
        description: episodeDescription,
        thumbnailUrl: youtubeVideoId
          ? [`https://i.ytimg.com/vi/${youtubeVideoId}/maxresdefault.jpg`]
          : undefined,
        uploadDate: episode.published_at || undefined,
        contentUrl: episode.audio_url,
        embedUrl: youtubeVideoId
          ? `https://www.youtube.com/embed/${youtubeVideoId}`
          : undefined,
        ...(episode.duration_seconds && {
          duration: `PT${Math.floor(episode.duration_seconds / 60)}M${episode.duration_seconds % 60}S`,
        }),
      }
    : null;

  // BreadcrumbList — Google SERP shows breadcrumbs, lifts CTR ~20%.
  const podcastId = (episode as { podcast_id?: string }).podcast_id;
  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Yedapo',
        item: baseUrl,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Discover',
        item: `${baseUrl}/discover`,
      },
      ...(podcast && podcastId
        ? [
            {
              '@type': 'ListItem',
              position: 3,
              name: podcast.title,
              item: `${baseUrl}/browse/podcast/${podcastId}`,
            },
            {
              '@type': 'ListItem',
              position: 4,
              name: episode.title,
              item: episodeUrl,
            },
          ]
        : [
            {
              '@type': 'ListItem',
              position: 3,
              name: episode.title,
              item: episodeUrl,
            },
          ]),
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(podcastEpisodeLd) }}
      />
      {videoObjectLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(videoObjectLd) }}
        />
      )}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
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
