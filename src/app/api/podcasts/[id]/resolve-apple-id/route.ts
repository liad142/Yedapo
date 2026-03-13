import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

const ITUNES_API_BASE = 'https://itunes.apple.com';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Resolves a podcast's Apple ID from its Supabase record.
 * If apple_id is already set, returns it immediately.
 * Otherwise, looks it up via iTunes Search API using the RSS feed URL,
 * backfills the DB, and returns it.
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id: podcastId } = await params;
    const supabase = createAdminClient();

    // Fetch podcast from DB
    const { data: podcast, error } = await supabase
      .from('podcasts')
      .select('apple_id, rss_feed_url, title')
      .eq('id', podcastId)
      .single();

    if (error || !podcast) {
      return NextResponse.json({ apple_id: null }, { status: 404 });
    }

    // Already has apple_id
    if (podcast.apple_id) {
      return NextResponse.json({ apple_id: podcast.apple_id });
    }

    // Extract from apple: prefix
    if (podcast.rss_feed_url?.startsWith('apple:')) {
      const appleId = podcast.rss_feed_url.replace('apple:', '');
      await supabase.from('podcasts').update({ apple_id: appleId }).eq('id', podcastId);
      return NextResponse.json({ apple_id: appleId });
    }

    // YouTube — no Apple ID
    if (podcast.rss_feed_url?.startsWith('youtube:')) {
      return NextResponse.json({ apple_id: null });
    }

    // Look up via iTunes Search API using the podcast title
    // (iTunes doesn't support direct feedUrl lookup in the public API)
    if (podcast.title) {
      try {
        const url = new URL(`${ITUNES_API_BASE}/search`);
        url.searchParams.set('term', podcast.title);
        url.searchParams.set('entity', 'podcast');
        url.searchParams.set('limit', '5');

        const res = await fetch(url.toString());
        if (res.ok) {
          const data = await res.json();
          // Find a match by feed URL or title
          const match = data.results?.find((r: Record<string, unknown>) =>
            r.feedUrl === podcast.rss_feed_url ||
            (r.collectionName as string)?.toLowerCase() === podcast.title?.toLowerCase()
          );

          if (match) {
            const appleId = String(match.collectionId || match.trackId);
            // Backfill in DB
            await supabase.from('podcasts').update({ apple_id: appleId }).eq('id', podcastId);
            return NextResponse.json({ apple_id: appleId });
          }
        }
      } catch {
        // iTunes lookup failed — non-critical
      }
    }

    return NextResponse.json({ apple_id: null });
  } catch (err) {
    console.error('Error resolving Apple ID:', err);
    return NextResponse.json({ apple_id: null }, { status: 500 });
  }
}
