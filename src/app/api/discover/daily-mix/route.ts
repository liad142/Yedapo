import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthUser } from '@/lib/auth-helpers';
import type { QuickSummaryContent, DeepSummaryContent } from '@/types/database';

// Map country codes to primary language codes for filtering podcasts
const COUNTRY_TO_LANGUAGES: Record<string, string[]> = {
  il: ['he', 'iw'], // Hebrew
  us: ['en'],
  gb: ['en'],
  au: ['en'],
  ca: ['en', 'fr'],
  de: ['de'],
  at: ['de'],
  ch: ['de', 'fr', 'it'],
  fr: ['fr'],
  es: ['es'],
  mx: ['es'],
  ar: ['es'],
  br: ['pt'],
  pt: ['pt'],
  it: ['it'],
  nl: ['nl'],
  be: ['nl', 'fr'],
  se: ['sv'],
  no: ['no', 'nb', 'nn'],
  dk: ['da'],
  fi: ['fi'],
  pl: ['pl'],
  ru: ['ru'],
  jp: ['ja'],
  kr: ['ko'],
  cn: ['zh'],
  tw: ['zh'],
  in: ['hi', 'en'],
  tr: ['tr'],
  sa: ['ar'],
  ae: ['ar'],
  eg: ['ar'],
};

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

  // 1. Get episode_ids with ANY ready summary (quick or deep)
  // Only fetch display fields for scoring — NOT full content_json
  const { data: summaries, error: summariesError } = await admin
    .from('summaries')
    .select('episode_id, level, content_json, updated_at')
    .eq('status', 'ready')
    .in('level', ['quick', 'deep'])
    .order('updated_at', { ascending: false })
    .limit(200);

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

  // 4. Get user's preferred genres for filtering
  let genreKeywords: string[] = [];
  let hasPreferences = false;
  try {
    const user = await getAuthUser();
    if (user) {
      const { data: profile } = await admin
        .from('user_profiles')
        .select('preferred_genres')
        .eq('id', user.id)
        .single();

      const preferredGenres: string[] = profile?.preferred_genres || [];
      if (preferredGenres.length > 0) {
        hasPreferences = true;
        genreKeywords = preferredGenres.flatMap(id => GENRE_KEYWORDS[id] || []);
      }
    }
  } catch {
    // Not authenticated — no filtering
  }

  // 4b. Filter by country/language if provided
  const allowedLanguages = country ? COUNTRY_TO_LANGUAGES[country] : null;
  const languageFiltered = allowedLanguages
    ? episodes.filter((ep: any) => {
        const podcast = Array.isArray(ep.podcasts) ? ep.podcasts[0] : ep.podcasts;
        const lang = (podcast?.language || '').toLowerCase().split('-')[0]; // "en-US" → "en"
        return !lang || allowedLanguages.includes(lang);
      })
    : episodes;

  // If filtering removed everything, fall back to unfiltered
  const episodesPool = languageFiltered.length > 0 ? languageFiltered : episodes;

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

  // 8. Apply cursor-based pagination
  let startIndex = 0;
  if (cursor) {
    const cursorTime = new Date(cursor).getTime();
    startIndex = filtered.findIndex(ep => ep._publishedAt <= cursorTime);
    if (startIndex === -1) startIndex = filtered.length;
  }

  const page = filtered.slice(startIndex, startIndex + limit);
  const hasMore = startIndex + limit < filtered.length;
  const nextCursor = hasMore && page.length > 0
    ? new Date(page[page.length - 1]._publishedAt).toISOString()
    : null;

  // 9. Strip internal fields and return
  const result = page.map(({ _score, _publishedAt, ...ep }) => ep);

  return NextResponse.json({ episodes: result, nextCursor }, {
    headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300' },
  });
}
