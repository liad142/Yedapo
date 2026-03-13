import { NextRequest, NextResponse } from 'next/server';
import { getPodcastById } from '@/lib/apple-podcasts';
import { createAdminClient } from '@/lib/supabase/admin';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: podcastId } = await params;
    const { searchParams } = new URL(request.url);
    const country = searchParams.get('country') || 'us';

    const podcast = await getPodcastById(podcastId, country);

    if (!podcast) {
      return NextResponse.json(
        { error: 'Podcast not found' },
        { status: 404 }
      );
    }

    // Backfill apple_id for existing podcasts that were created before the column was added.
    // Use separate queries to avoid URL special chars breaking PostgREST .or() filters.
    try {
      const supabase = createAdminClient();

      // Match by apple: convention
      await supabase
        .from('podcasts')
        .update({ apple_id: podcastId })
        .eq('rss_feed_url', `apple:${podcastId}`)
        .is('apple_id', null);

      // Match by real RSS feed URL (if available from Apple API)
      if (podcast.feedUrl) {
        await supabase
          .from('podcasts')
          .update({ apple_id: podcastId })
          .eq('rss_feed_url', podcast.feedUrl)
          .is('apple_id', null);
      }
    } catch {
      // Non-critical — don't fail the response if backfill fails
    }

    return NextResponse.json({ podcast }, {
      headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200' },
    });
  } catch (error) {
    console.error('Apple podcast lookup error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch podcast' },
      { status: 500 }
    );
  }
}
