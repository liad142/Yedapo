import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { checkRateLimit } from '@/lib/cache';

// GET: Lookup podcast by RSS URL
export async function GET(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const rlAllowed = await checkRateLimit(`podcasts-lookup:${ip}`, 60, 60);
  if (!rlAllowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

  const { searchParams } = new URL(request.url);
  const rssUrl = searchParams.get('rss_url');

  if (!rssUrl) {
    return NextResponse.json({ error: 'rss_url is required' }, { status: 400 });
  }

  try {
    const { data: podcast, error } = await createAdminClient()
      .from('podcasts')
      .select('id')
      .eq('rss_feed_url', rssUrl)
      .single();

    if (error || !podcast) {
      return NextResponse.json({ error: 'Podcast not found' }, { status: 404 });
    }

    return NextResponse.json({ podcastId: podcast.id }, {
      headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200' },
    });
  } catch (error) {
    console.error('Error looking up podcast:', error);
    return NextResponse.json({ error: 'Failed to lookup podcast' }, { status: 500 });
  }
}
