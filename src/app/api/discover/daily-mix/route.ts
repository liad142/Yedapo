import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthUser } from '@/lib/auth-helpers';
import { getCountryLanguages } from '@/lib/region-data';
import { getCached, setCached } from '@/lib/cache';
import type { QuickSummaryContent, DeepSummaryContent } from '@/types/database';

// Map each Apple genre to expanded keyword sets for matching
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

// Extract searchable text from either quick or deep summary
function getSummaryText(summary: any, level: string): { tags: string[]; perfectFor: string; hookHeadline: string; brief: string } {
  if (!summary) return { tags: [], perfectFor: '', hookHeadline: '', brief: '' };

  if (level === 'quick') {
    const q = summary as QuickSummaryContent;
    return {
      tags: q.tags || [],
      perfectFor: q.perfect_for || '',
      hookHeadline: q.hook_headline || '',
      brief: q.executive_brief || '',
    };
  }

  // Deep summary — extract keywords from core_concepts and overview
  const d = summary as DeepSummaryContent;
  const tags = (d.core_concepts || []).map(c => c.concept);
  return {
    tags,
    perfectFor: '',
    hookHeadline: '',
    brief: d.comprehensive_overview || '',
  };
}

function getDisplayDescription(summary: any, level: string, fallback: string): string {
  if (!summary) return fallback;
  if (level === 'quick') {
    const q = summary as QuickSummaryContent;
    return q.hook_headline || q.executive_brief || fallback;
  }
  // Deep summary — use first sentence of overview
  const d = summary as DeepSummaryContent;
  const overview = d.comprehensive_overview || '';
  const firstSentence = overview.split(/[.!?]\s/)[0];
  return firstSentence ? firstSentence + '.' : fallback;
}

function scoreEpisode(
  summaryText: { tags: string[]; perfectFor: string; hookHeadline: string; brief: string },
  podcastTitle: string,
  episodeTitle: string,
  episodeDescription: string,
  genreKeywords: string[],
): number {
  if (genreKeywords.length === 0) return 0;

  let score = 0;
  const podcastLower = podcastTitle.toLowerCase();
  const titleLower = episodeTitle.toLowerCase();
  const descLower = (episodeDescription || '').toLowerCase().slice(0, 500);
  const tags = summaryText.tags.map(t => t.toLowerCase());
  const perfectFor = summaryText.perfectFor.toLowerCase();
  const hookHeadline = summaryText.hookHeadline.toLowerCase();
  const brief = summaryText.brief.toLowerCase().slice(0, 500);

  for (const keyword of genreKeywords) {
    if (podcastLower.includes(keyword)) score += 5;
    for (const tag of tags) {
      if (tag.includes(keyword) || keyword.includes(tag)) score += 3;
    }
    if (titleLower.includes(keyword)) score += 2;
    if (perfectFor.includes(keyword)) score += 2;
    if (hookHeadline.includes(keyword)) score += 1;
    if (brief.includes(keyword)) score += 1;
    if (descLower.includes(keyword)) score += 1;
  }

  return score;
}

export async function GET(request: NextRequest) {
  const admin = createAdminClient();
  const country = request.nextUrl.searchParams.get('country')?.toLowerCase() || '';
  const limitParam = parseInt(request.nextUrl.searchParams.get('limit') || '20', 10);
  const limit = Math.min(Math.max(limitParam, 1), 50); // clamp 1-50
  const cursor = request.nextUrl.searchParams.get('cursor'); // ISO date string for pagination

  // Resolve auth early so the cache key includes the user ID when personalized
  let authUser: { id: string; email?: string | null } | null = null;
  try {
    authUser = await getAuthUser({ silent: true });
  } catch {
    // Not authenticated — use guest cache key
  }

  // Include userId in cache key to prevent one user's personalized feed from being served to another
  const cacheKey = `daily-mix:${authUser?.id || 'guest'}:${country}:${limit}`;
  if (!cursor) {
    const cached = await getCached<{ episodes: any[]; nextCursor: string | null }>(cacheKey);
    if (cached) {
      return NextResponse.json(cached, {
        headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300' },
      });
    }
  }

  // 1. Get episode_ids with ANY ready summary (quick or deep)
  // Only fetch display fields for scoring — NOT full content_json
  const { data: summaries, error: summariesError } = await admin
    .from('summaries')
    .select('episode_id, level, content_json, updated_at')
    .eq('status', 'ready')
    .in('level', ['quick', 'deep'])
    .order('updated_at', { ascending: false })
    .limit(100);

  if (summariesError || !summaries?.length) {
    return NextResponse.json({ episodes: [], nextCursor: null });
  }

  // 2. Deduplicate: keep quick for scoring, extract only lightweight display fields
  const summaryMap = new Map<string, { level: string; content: any }>();
  const displaySummaryMap = new Map<string, { tags?: string[]; hookHeadline?: string; executiveBrief?: string; takeawayCount?: number; chapterCount?: number }>();
  for (const s of summaries) {
    if (!s.content_json) continue;
    // For scoring: prefer quick over deep
    const existing = summaryMap.get(s.episode_id);
    if (!existing || (existing.level === 'deep' && s.level === 'quick')) {
      summaryMap.set(s.episode_id, { level: s.level, content: s.content_json });
    }
    // Extract lightweight display fields only (no full content_json in response)
    if (s.level === 'quick') {
      const q = s.content_json as QuickSummaryContent;
      const existing = displaySummaryMap.get(s.episode_id);
      displaySummaryMap.set(s.episode_id, {
        ...existing,
        tags: q.tags,
        hookHeadline: q.hook_headline,
        executiveBrief: q.executive_brief,
      });
    } else if (s.level === 'deep') {
      const d = s.content_json as DeepSummaryContent;
      const existing = displaySummaryMap.get(s.episode_id);
      displaySummaryMap.set(s.episode_id, {
        ...existing,
        // Only set text fields if no quick summary exists yet
        ...(!existing?.hookHeadline && {
          tags: (d.core_concepts || []).map(c => c.concept),
          executiveBrief: d.comprehensive_overview?.slice(0, 300),
        }),
        // Always add counts from deep summary
        takeawayCount: d.actionable_takeaways?.length ?? 0,
        chapterCount: d.chronological_breakdown?.length ?? 0,
      });
    } else if (!displaySummaryMap.has(s.episode_id)) {
      // Fallback to deep summary display fields if no quick exists
      const d = s.content_json as DeepSummaryContent;
      displaySummaryMap.set(s.episode_id, {
        tags: (d.core_concepts || []).map(c => c.concept),
        executiveBrief: d.comprehensive_overview?.slice(0, 300),
      });
    }
  }

  const episodeIds = Array.from(summaryMap.keys());

  // 3. Get episodes with podcast info (including language for country filtering)
  const { data: episodes, error: episodesError } = await admin
    .from('episodes')
    .select('id, title, description, published_at, podcast_id, audio_url, duration_seconds, podcasts(id, title, image_url, language, rss_feed_url)')
    .in('id', episodeIds)
    .order('published_at', { ascending: false });

  if (episodesError || !episodes?.length) {
    return NextResponse.json({ episodes: [], nextCursor: null });
  }

  // Backfill YouTube channel thumbnails for episodes missing image_url
  const ytMissing = episodes.filter((ep: any) => {
    const p = Array.isArray(ep.podcasts) ? ep.podcasts[0] : ep.podcasts;
    return !p?.image_url && p?.rss_feed_url?.startsWith('youtube:channel:');
  });
  if (ytMissing.length > 0) {
    const chIds = ytMissing.map((ep: any) => {
      const p = Array.isArray(ep.podcasts) ? ep.podcasts[0] : ep.podcasts;
      return p.rss_feed_url.replace('youtube:channel:', '');
    });
    const { data: ytChs } = await admin
      .from('youtube_channels')
      .select('channel_id, thumbnail_url')
      .in('channel_id', [...new Set(chIds)]);
    if (ytChs?.length) {
      const thumbMap = new Map(ytChs.map((ch: any) => [ch.channel_id, ch.thumbnail_url]));
      for (const ep of ytMissing) {
        const p = Array.isArray(ep.podcasts) ? ep.podcasts[0] : ep.podcasts;
        const chId = p.rss_feed_url.replace('youtube:channel:', '');
        if (thumbMap.has(chId)) p.image_url = thumbMap.get(chId);
      }
    }
  }

  // 4. Get user's preferred genres for filtering (reuse authUser resolved above)
  let genreKeywords: string[] = [];
  let hasPreferences = false;
  if (authUser) {
    try {
      const { data: profile } = await admin
        .from('user_profiles')
        .select('preferred_genres')
        .eq('id', authUser.id)
        .single();

      const preferredGenres: string[] = profile?.preferred_genres || [];
      if (preferredGenres.length > 0) {
        hasPreferences = true;
        genreKeywords = preferredGenres.flatMap(id => GENRE_KEYWORDS[id] || []);
      }
    } catch {
      // Profile fetch failed — no filtering
    }
  }

  // 4b. Filter by country/language if provided
  const allowedLanguages = country ? getCountryLanguages(country) : null;
  const languageFiltered = allowedLanguages
    ? episodes.filter((ep: any) => {
        const podcast = Array.isArray(ep.podcasts) ? ep.podcasts[0] : ep.podcasts;
        const lang = (podcast?.language || '').toLowerCase().split('-')[0]; // "en-US" → "en"
        return !lang || allowedLanguages.includes(lang);
      })
    : episodes;

  // If filtering removed everything, fall back to unfiltered
  const languagePool = languageFiltered.length > 0 ? languageFiltered : episodes;

  // Filter out episodes with missing podcast data
  const episodesPool = languagePool.filter((ep: any) => {
    const podcast = Array.isArray(ep.podcasts) ? ep.podcasts[0] : ep.podcasts;
    return podcast && podcast.title;
  });

  // 5. Score all episodes
  const scored = episodesPool.map((ep: any) => {
    const podcast = Array.isArray(ep.podcasts) ? ep.podcasts[0] : ep.podcasts;
    const summaryInfo = summaryMap.get(ep.id);
    const summaryText = getSummaryText(summaryInfo?.content, summaryInfo?.level || 'quick');
    const score = scoreEpisode(
      summaryText,
      podcast?.title || '',
      ep.title || '',
      ep.description || '',
      genreKeywords,
    );
    const display = displaySummaryMap.get(ep.id);

    const rssUrl: string = podcast?.rss_feed_url || '';
    const podcastAppleId = rssUrl.startsWith('apple:') ? rssUrl.replace('apple:', '') : null;
    const isYouTube = rssUrl.startsWith('youtube:channel:');
    const channelId = isYouTube ? rssUrl.replace('youtube:channel:', '') : null;

    return {
      id: ep.id,
      title: ep.title,
      description: getDisplayDescription(summaryInfo?.content, summaryInfo?.level || 'quick', ep.description || ''),
      publishedAt: ep.published_at,
      podcastId: podcast?.id || ep.podcast_id,
      podcastAppleId,
      podcastName: podcast?.title || '',
      podcastArtwork: podcast?.image_url || '',
      audioUrl: ep.audio_url || '',
      durationSeconds: ep.duration_seconds || null,
      sourceType: isYouTube ? 'youtube' : 'podcast',
      channelId,
      // Lightweight summary display fields only — full content fetched on-demand via /insights
      summaryPreview: display || {},
      _score: score,
      _publishedAt: new Date(ep.published_at || 0).getTime(),
    };
  });

  // 6. Filter: only matching episodes when user has genre preferences
  let filtered = scored;
  if (hasPreferences) {
    const matching = scored.filter(ep => ep._score > 0);
    if (matching.length > 0) {
      filtered = matching;
    }
  }

  // 7. Sort by date DESC (recent first), then by score DESC as tiebreaker
  filtered.sort((a, b) => {
    if (a._publishedAt !== b._publishedAt) return b._publishedAt - a._publishedAt;
    return b._score - a._score;
  });

  // 7b. Limit per-source to prevent single podcast dominating the feed
  const MAX_PER_SOURCE = 2;
  const sourceCounts = new Map<string, number>();
  const diversified = filtered.filter(ep => {
    const source = ep.podcastName || ep.podcastId;
    const count = sourceCounts.get(source) || 0;
    if (count >= MAX_PER_SOURCE) return false;
    sourceCounts.set(source, count + 1);
    return true;
  });

  // 8. Apply cursor-based pagination (cursor format: "ISO_DATE|EPISODE_ID" for tiebreaking)
  let startIndex = 0;
  if (cursor) {
    const [cursorDateStr, cursorEpisodeId] = cursor.split('|');
    const cursorTime = new Date(cursorDateStr).getTime();
    if (cursorEpisodeId) {
      // Find the exact episode after the cursor (handles duplicate timestamps)
      const cursorIdx = diversified.findIndex(
        ep => ep._publishedAt === cursorTime && ep.id === cursorEpisodeId
      );
      startIndex = cursorIdx !== -1 ? cursorIdx + 1 : diversified.findIndex(ep => ep._publishedAt < cursorTime);
    } else {
      // Legacy cursor format (date only) — find first episode at or below cursor time
      startIndex = diversified.findIndex(ep => ep._publishedAt <= cursorTime);
    }
    if (startIndex === -1) startIndex = diversified.length;
  }

  const page = diversified.slice(startIndex, startIndex + limit);
  const hasMore = startIndex + limit < diversified.length;
  const lastItem = page[page.length - 1];
  const nextCursor = hasMore && lastItem
    ? `${new Date(lastItem._publishedAt).toISOString()}|${lastItem.id}`
    : null;

  // 9. Strip internal fields and return
  const result = page.map(({ _score, _publishedAt, ...ep }) => ep);

  const responseBody = { episodes: result, nextCursor };

  // Cache first page in Redis (10 min TTL)
  if (!cursor) {
    setCached(cacheKey, responseBody, 600);
  }

  return NextResponse.json(responseBody, {
    headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300' },
  });
}
