/**
 * GET /api/discover/personalized
 * Returns personalized podcast recommendations based on user's genre preferences.
 * Falls back to general top charts for guests or users without preferences.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthUser } from '@/lib/auth-helpers';
import { getCached, setCached, checkRateLimit } from '@/lib/cache';
import { APPLE_PODCAST_GENRES } from '@/types/apple-podcasts';

interface ApplePodcast {
  id: string;
  name: string;
  artistName: string;
  artworkUrl: string;
  genres: string[];
  [key: string]: any;
}

export async function GET(request: NextRequest) {
  // Rate limit: 10 req/min per IP
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const rlAllowed = await checkRateLimit(`personalized:${ip}`, 10, 60);
  if (!rlAllowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const ALLOWED_COUNTRIES = new Set([
    'dz','ao','ai','ag','ar','am','au','at','az','bs','bh','bb','be','bz','bm',
    'bo','bw','br','bn','bg','ca','ky','cl','co','cr','hr','cy','cz','dk','dm',
    'do','ec','eg','sv','ee','fi','fr','de','gh','gr','gd','gt','gy','hn','hk',
    'hu','is','in','id','ie','il','it','jm','jp','jo','kz','ke','kr','kw','kg',
    'la','lv','lb','lt','lu','mo','my','mv','mt','mu','mx','md','mn','ms','mz',
    'mm','na','np','nl','nz','ni','ng','mk','no','om','pk','pa','pg','py','pe',
    'ph','pl','pt','qa','ro','sa','sn','sg','sk','si','za','es','lk','kn','lc',
    'vc','sr','se','ch','tw','tz','th','tt','tn','tr','tc','ug','ua','ae','gb',
    'us','uy','uz','ve','vn','vg','ye','zw',
  ]);

  const { searchParams } = new URL(request.url);
  const rawCountry = searchParams.get('country') || 'us';
  const country = ALLOWED_COUNTRIES.has(rawCountry.toLowerCase()) ? rawCountry.toLowerCase() : 'us';
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '30', 10) || 30, 1), 100);

  const user = await getAuthUser();

  // If not authenticated, return empty (caller will use general discovery)
  if (!user) {
    return NextResponse.json({ personalized: false, sections: [] });
  }

  try {
    // Check cache first
    const cacheKey = `personalized:${user.id}:${country}`;
    const cached = await getCached<{ personalized: boolean; sections: unknown[] }>(cacheKey);
    if (cached) {
      return NextResponse.json(cached, {
        headers: { 'Cache-Control': 'private, s-maxage=3600, stale-while-revalidate=7200' },
      });
    }

    // Get user's genre preferences
    const { data: profile } = await createAdminClient()
      .from('user_profiles')
      .select('preferred_genres')
      .eq('id', user.id)
      .single();

    const preferredGenres = profile?.preferred_genres || [];

    if (preferredGenres.length === 0) {
      return NextResponse.json({ personalized: false, sections: [] });
    }

    // Fetch top podcasts for each preferred genre
    const genreResults = await Promise.allSettled(
      preferredGenres.slice(0, 5).map(async (genreId: string) => {
        const response = await fetch(
          `https://itunes.apple.com/${country}/rss/toppodcasts/genre=${genreId}/limit=15/json`
        );
        if (!response.ok) return { genreId, podcasts: [] };
        const data = await response.json();

        const entries = data?.feed?.entry || [];
        const podcasts: ApplePodcast[] = entries.map((entry: any) => ({
          id: entry.id?.attributes?.['im:id'] || '',
          name: entry['im:name']?.label || '',
          artistName: entry['im:artist']?.label || '',
          artworkUrl: entry['im:image']?.[2]?.label || entry['im:image']?.[0]?.label || '',
          genres: [entry.category?.attributes?.label || ''].filter(Boolean),
        }));

        return { genreId, podcasts };
      })
    );

    // Build personalized sections
    const sections: Array<{
      genreId: string;
      genreName: string;
      label: string;
      podcasts: ApplePodcast[];
    }> = [];
    const seenIds = new Set<string>();

    for (const result of genreResults) {
      if (result.status !== 'fulfilled') continue;
      const { genreId, podcasts } = result.value;
      const genre = APPLE_PODCAST_GENRES.find(g => g.id === genreId);
      if (!genre) continue;

      // Deduplicate across sections
      const uniquePodcasts = podcasts.filter((p: ApplePodcast) => {
        if (seenIds.has(p.id)) return false;
        seenIds.add(p.id);
        return true;
      });

      if (uniquePodcasts.length > 0) {
        sections.push({
          genreId,
          genreName: genre.name,
          label: `Because you like ${genre.name}`,
          podcasts: uniquePodcasts.slice(0, 10),
        });
      }
    }

    const responseData = {
      personalized: true,
      sections,
    };

    // Cache for 1 hour (setCached handles JSON serialization)
    await setCached(cacheKey, responseData, 3600);

    return NextResponse.json(responseData, {
      headers: { 'Cache-Control': 'private, s-maxage=3600, stale-while-revalidate=7200' },
    });
  } catch (error) {
    console.error('Error fetching personalized feed:', error);
    return NextResponse.json({ personalized: false, sections: [] });
  }
}
