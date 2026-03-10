import { NextRequest, NextResponse } from 'next/server';
import { searchPodcasts } from '@/lib/podcast-search';
import { checkRateLimit } from '@/lib/cache';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const term = searchParams.get('q');
    const country = searchParams.get('country') || 'us';
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 50);

    if (!term || !term.trim()) {
      return NextResponse.json(
        { error: 'Search query is required (use ?q=term)' },
        { status: 400 }
      );
    }

    // Rate limit per IP
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || 'unknown';
    const allowed = await checkRateLimit(`search:${ip}`, 30, 60);
    if (!allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429 }
      );
    }

    const result = await searchPodcasts(term.trim(), country, limit);

    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=1800' },
    });
  } catch (error) {
    console.error('Unified search error:', error);
    return NextResponse.json(
      { error: 'Search failed' },
      { status: 500 }
    );
  }
}
