import { NextRequest, NextResponse } from 'next/server';
import { getPodcastEpisodes, getPodcastById } from '@/lib/apple-podcasts';
import { deleteCached, CacheKeys } from '@/lib/cache';
import { isPodcastIndexConfigured, getPodcastByItunesId, getEpisodesByFeedId } from '@/lib/podcast-index';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: podcastId } = await params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const country = searchParams.get('country') || 'us';

    // First get the podcast to get the feed URL
    const podcast = await getPodcastById(podcastId, country);

    if (!podcast) {
      return NextResponse.json(
        { error: 'Podcast not found' },
        { status: 404 }
      );
    }

    let { episodes, totalCount, hasMore } = await getPodcastEpisodes(podcastId, podcast.feedUrl, limit, offset);

    // If we got suspiciously few episodes (e.g. from a limited RSS feed)
    // but the Apple metadata says there are more, bust the cache and retry
    // via the Podcastindex path which has the full catalogue.
    if (totalCount < 10 && podcast.trackCount > totalCount && isPodcastIndexConfigured()) {
      await deleteCached(CacheKeys.podcastEpisodes(podcastId));

      try {
        const piPodcast = await getPodcastByItunesId(podcastId);
        if (piPodcast?.podcastIndexId) {
          const piEpisodes = await getEpisodesByFeedId(String(piPodcast.podcastIndexId));
          if (piEpisodes.length > totalCount) {
            const allEpisodes = piEpisodes.map((ep) => ({
              id: ep.id,
              podcastId,
              title: ep.title,
              description: ep.description,
              publishedAt: ep.publishedAt,
              duration: ep.duration,
              audioUrl: ep.audioUrl,
              artworkUrl: ep.artworkUrl,
              episodeNumber: ep.episodeNumber,
              seasonNumber: ep.seasonNumber,
            }));
            const sliced = allEpisodes.slice(offset, offset + limit);
            episodes = sliced;
            totalCount = allEpisodes.length;
            hasMore = offset + limit < allEpisodes.length;
          }
        }
      } catch (piErr) {
        console.error('[episodes] PI retry failed:', piErr);
      }
    }

    return NextResponse.json({
      episodes,
      podcastId,
      totalCount,
      hasMore,
      count: episodes.length,
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
    });
  } catch (error) {
    console.error('Apple podcast episodes error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch episodes' },
      { status: 500 }
    );
  }
}
