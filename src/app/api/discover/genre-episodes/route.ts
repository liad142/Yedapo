/**
 * GET /api/discover/genre-episodes
 * Returns episodes matching a specific genre, scored from existing daily-mix data
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCached, setCached } from '@/lib/cache';
import type { QuickSummaryContent, DeepSummaryContent } from '@/types/database';

// Genre keywords (same as daily-mix)
const GENRE_KEYWORDS: Record<string, string[]> = {
  '1301': ['arts', 'art', 'design', 'creative', 'photography', 'visual'],
  '1321': ['business', 'entrepreneurship', 'startup', 'finance', 'marketing', 'sales', 'leadership', 'investing', 'economy', 'management', 'money', 'founder', 'ceo', 'revenue', 'growth'],
  '1303': ['comedy', 'humor', 'funny', 'stand-up', 'improv'],
  '1304': ['education', 'learning', 'teaching', 'courses', 'school', 'university'],
  '1483': ['fiction', 'story', 'storytelling', 'narrative', 'drama'],
  '1511': ['government', 'politics', 'policy', 'political', 'election', 'democracy'],
  '1512': ['history', 'historical', 'ancient', 'war', 'civilization'],
  '1305': ['health', 'fitness', 'wellness', 'nutrition', 'mental health', 'exercise', 'meditation'],
  '1307': ['kids', 'family', 'parenting', 'children'],
  '1309': ['music', 'musical', 'song', 'album', 'artist', 'band'],
  '1489': ['news', 'current events', 'journalism', 'breaking', 'headlines'],
  '1314': ['religion', 'spirituality', 'faith', 'church', 'bible', 'prayer'],
  '1533': ['science', 'scientific', 'research', 'biology', 'physics', 'chemistry', 'space', 'nature'],
  '1324': ['society', 'culture', 'social', 'relationships', 'philosophy', 'psychology'],
  '1545': ['sports', 'sport', 'football', 'basketball', 'soccer', 'athlete', 'nba', 'nfl'],
  '1318': ['technology', 'tech', 'software', 'programming', 'ai', 'artificial intelligence', 'coding', 'developer', 'data', 'machine learning', 'cybersecurity', 'blockchain', 'crypto', 'saas', 'app', 'startup'],
  '1481': ['true crime', 'crime', 'murder', 'investigation', 'detective', 'criminal'],
  '1310': ['tv', 'film', 'movie', 'television', 'cinema', 'series', 'streaming'],
};

export async function GET(request: NextRequest) {
  const genreId = request.nextUrl.searchParams.get('genreId');
  const limit = Math.min(parseInt(request.nextUrl.searchParams.get('limit') || '5', 10), 10);

  if (!genreId) {
    return NextResponse.json({ error: 'genreId is required' }, { status: 400 });
  }

  const keywords = GENRE_KEYWORDS[genreId] || [];
  if (keywords.length === 0) {
    return NextResponse.json({ episodes: [] });
  }

  const cacheKey = `discover:genre:${genreId}`;
  const cached = await getCached<{ episodes: any[] }>(cacheKey);
  if (cached) {
    return NextResponse.json(cached, {
      headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200' },
    });
  }

  try {
    const admin = createAdminClient();

    // Get recent ready summaries (within last 7 days)
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const { data: summaries } = await admin
      .from('summaries')
      .select('episode_id, level, content_json')
      .eq('status', 'ready')
      .in('level', ['quick', 'deep'])
      .gte('updated_at', oneWeekAgo.toISOString())
      .order('updated_at', { ascending: false })
      .limit(100);

    if (!summaries?.length) {
      return NextResponse.json({ episodes: [] });
    }

    // Build summary maps
    const summaryMap = new Map<string, { level: string; content: any }>();
    const displayMap = new Map<string, any>();

    for (const s of summaries) {
      if (!s.content_json) continue;

      const existing = summaryMap.get(s.episode_id);
      if (!existing || (existing.level === 'deep' && s.level === 'quick')) {
        summaryMap.set(s.episode_id, { level: s.level, content: s.content_json });
      }

      if (s.level === 'quick') {
        const q = s.content_json as QuickSummaryContent;
        const ex = displayMap.get(s.episode_id) || {};
        displayMap.set(s.episode_id, {
          ...ex,
          tags: q.tags,
          hookHeadline: q.hook_headline,
          executiveBrief: q.executive_brief,
        });
      } else if (s.level === 'deep') {
        const d = s.content_json as DeepSummaryContent;
        const ex = displayMap.get(s.episode_id) || {};
        displayMap.set(s.episode_id, {
          ...ex,
          ...(!ex.hookHeadline && {
            tags: (d.core_concepts || []).map(c => c.concept),
            executiveBrief: d.comprehensive_overview?.slice(0, 300),
          }),
          takeawayCount: d.actionable_takeaways?.length ?? 0,
          chapterCount: d.chronological_breakdown?.length ?? 0,
        });
      }
    }

    const episodeIds = Array.from(summaryMap.keys());

    // Get episodes
    const { data: episodes } = await admin
      .from('episodes')
      .select('id, title, description, published_at, podcast_id, audio_url, duration_seconds, podcasts(id, title, image_url, rss_feed_url)')
      .in('id', episodeIds)
      .order('published_at', { ascending: false });

    if (!episodes?.length) {
      return NextResponse.json({ episodes: [] });
    }

    // Backfill YouTube channel thumbnails for episodes missing image_url
    const ytMissing = episodes.filter((ep: any) => {
      const p = Array.isArray(ep.podcasts) ? ep.podcasts[0] : ep.podcasts;
      return !p?.image_url && p?.rss_feed_url?.startsWith('youtube:channel:');
    });
    if (ytMissing.length > 0) {
      const chIds = [...new Set(ytMissing.map((ep: any) => {
        const p = Array.isArray(ep.podcasts) ? ep.podcasts[0] : ep.podcasts;
        return p.rss_feed_url.replace('youtube:channel:', '');
      }))];
      const { data: ytChs } = await admin
        .from('youtube_channels')
        .select('channel_id, thumbnail_url')
        .in('channel_id', chIds);
      if (ytChs?.length) {
        const thumbMap = new Map(ytChs.map((ch: any) => [ch.channel_id, ch.thumbnail_url]));
        for (const ep of ytMissing) {
          const p = Array.isArray(ep.podcasts) ? ep.podcasts[0] : ep.podcasts;
          const chId = p.rss_feed_url.replace('youtube:channel:', '');
          if (thumbMap.has(chId)) p.image_url = thumbMap.get(chId);
        }
      }
    }

    // Score episodes against genre keywords
    const scored = episodes.map((ep: any) => {
      const podcast = Array.isArray(ep.podcasts) ? ep.podcasts[0] : ep.podcasts;
      const summaryInfo = summaryMap.get(ep.id);
      const tags = (() => {
        if (!summaryInfo?.content) return [];
        if (summaryInfo.level === 'quick') return (summaryInfo.content as QuickSummaryContent).tags || [];
        return (summaryInfo.content as DeepSummaryContent).core_concepts?.map(c => c.concept) || [];
      })();

      let score = 0;
      const podcastLower = (podcast?.title || '').toLowerCase();
      const titleLower = (ep.title || '').toLowerCase();
      const descLower = (ep.description || '').toLowerCase().slice(0, 500);
      const tagsLower = tags.map((t: string) => t.toLowerCase());

      for (const keyword of keywords) {
        if (podcastLower.includes(keyword)) score += 5;
        for (const tag of tagsLower) {
          if (tag.includes(keyword) || keyword.includes(tag)) score += 3;
        }
        if (titleLower.includes(keyword)) score += 2;
        if (descLower.includes(keyword)) score += 1;
      }

      const rssUrl: string = podcast?.rss_feed_url || '';
      const podcastAppleId = rssUrl.startsWith('apple:') ? rssUrl.replace('apple:', '') : null;

      return {
        id: ep.id,
        title: ep.title,
        description: ep.description || '',
        publishedAt: ep.published_at,
        podcastId: podcast?.id || ep.podcast_id,
        podcastAppleId,
        podcastName: podcast?.title || '',
        podcastArtwork: podcast?.image_url || '',
        audioUrl: ep.audio_url || '',
        durationSeconds: ep.duration_seconds || null,
        summaryPreview: displayMap.get(ep.id),
        _score: score,
      };
    });

    // Filter to matching episodes and sort by score
    const matching = scored
      .filter(ep => ep._score > 0)
      .sort((a, b) => b._score - a._score)
      .slice(0, limit)
      .map(({ _score, ...ep }) => ep);

    const result = { episodes: matching };
    await setCached(cacheKey, result, 3600);

    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200' },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get genre episodes' },
      { status: 500 }
    );
  }
}
