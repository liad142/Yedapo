/**
 * GET /api/discover/todays-insights
 * Returns categorized brief items from today's (or most recent) summaries
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCached, setCached } from '@/lib/cache';
import type { QuickSummaryContent, DeepSummaryContent, ActionItem, ChronologicalSection } from '@/types/database';
import type { BriefItem, BriefCategory, TodaysBriefResponse } from '@/types/brief';

const CACHE_HEADERS = { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600' };
const METRIC_RE = /\b(\$?\d[\d,.]*[%MBKmb]|\d+x)\b/;
const MAX_ITEMS = 8;
const MAX_PER_EPISODE = 2;

/** Map ActionItem.category → BriefCategory */
function mapCategory(cat: ActionItem['category'], text: string): BriefCategory {
  if (METRIC_RE.test(text)) return 'metric';
  switch (cat) {
    case 'tool': return 'tool';
    case 'repo': return 'repo';
    case 'strategy': return 'company';
    case 'resource':
    case 'concept':
    case 'habit':
    default: return 'insight';
  }
}

/** Truncate text at word boundary */
function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.lastIndexOf(' ', max);
  return text.slice(0, cut > 0 ? cut : max) + '...';
}

/** Cross-reference takeaway text with chronological sections to find timestamps */
function findTimestamp(
  text: string,
  sections: ChronologicalSection[]
): { timestamp?: string; timestampSeconds?: number } {
  const needle = text.slice(0, 60).toLowerCase();
  for (const sec of sections) {
    if (sec.content.toLowerCase().includes(needle) && sec.timestamp) {
      return { timestamp: sec.timestamp, timestampSeconds: sec.timestamp_seconds };
    }
  }
  return {};
}

interface RawBriefItem extends Omit<BriefItem, 'source'> {
  episodeId: string;
  priority: number; // 0=high, 1=medium, 2=low, 3=unset
  hasResources: boolean;
  hasTimestamp: boolean;
}

export async function GET(request: NextRequest) {
  try {
    const lang = request.nextUrl.searchParams.get('lang')?.toLowerCase() || '';
    const cacheKey = `discover:insights:${lang || 'all'}`;
    const cached = await getCached<TodaysBriefResponse>(cacheKey);
    if (cached) {
      return NextResponse.json(cached, { headers: CACHE_HEADERS });
    }

    const admin = createAdminClient();

    // 2a. Fallback query logic
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();
    let isStale = false;
    let dataDate = new Date().toISOString().split('T')[0];

    let { data: summaries, error } = await admin
      .from('summaries')
      .select('episode_id, level, language, content_json, updated_at')
      .eq('status', 'ready')
      .in('level', ['quick', 'deep'])
      .gte('updated_at', todayISO)
      .order('updated_at', { ascending: false })
      .limit(50);

    if (error || !summaries?.length) {
      // Fallback: most recent summaries regardless of date
      const fallback = await admin
        .from('summaries')
        .select('episode_id, level, language, content_json, updated_at')
        .eq('status', 'ready')
        .in('level', ['quick', 'deep'])
        .order('updated_at', { ascending: false })
        .limit(50);

      summaries = fallback.data;
      if (!summaries?.length) {
        return NextResponse.json({ items: [], date: dataDate, isStale: false } satisfies TodaysBriefResponse, { headers: CACHE_HEADERS });
      }
      isStale = true;
      dataDate = summaries[0].updated_at.split('T')[0];
    }

    // Filter by language if requested (prefer matching language, fall back to all)
    if (lang && lang !== 'en' && summaries?.length) {
      const matched = summaries.filter((s: any) => s.language === lang);
      if (matched.length > 0) summaries = matched;
    }

    // 2b. Build episode summary map
    const episodeSummaries = new Map<string, { quick?: QuickSummaryContent; deep?: DeepSummaryContent }>();
    for (const s of summaries) {
      if (!s.content_json) continue;
      const entry = episodeSummaries.get(s.episode_id) || {};
      if (s.level === 'deep') entry.deep = s.content_json as DeepSummaryContent;
      else if (s.level === 'quick') entry.quick = s.content_json as QuickSummaryContent;
      episodeSummaries.set(s.episode_id, entry);
    }

    // 2c. Extract BriefItems from deep summaries
    const rawItems: RawBriefItem[] = [];
    let globalIndex = 0;
    const episodesWithDeepItems = new Set<string>();

    for (const [episodeId, sums] of episodeSummaries) {
      if (!sums.deep?.actionable_takeaways) continue;
      const sections = sums.deep.chronological_breakdown || [];

      for (const item of sums.deep.actionable_takeaways) {
        if (typeof item === 'string') {
          rawItems.push({
            id: `${episodeId}-${globalIndex++}`,
            headline: truncate(item, 80),
            whyItMatters: sums.quick?.executive_brief || '',
            category: 'insight',
            priority: 3,
            hasResources: false,
            hasTimestamp: false,
            episodeId,
          });
          episodesWithDeepItems.add(episodeId);
        } else {
          const a = item as ActionItem;
          const category = mapCategory(a.category, a.text);

          // Build headline: prefix with first resource name if available
          let headline: string;
          if (a.resources?.length) {
            headline = `${a.resources[0].name}: ${truncate(a.text, 70)}`;
          } else {
            headline = truncate(a.text, 80);
          }

          // Build whyItMatters
          let whyItMatters = '';
          if (a.resources?.[0]?.context) {
            whyItMatters = a.resources[0].context;
          } else if (sums.quick?.executive_brief) {
            whyItMatters = truncate(sums.quick.executive_brief, 120);
          } else {
            whyItMatters = truncate(a.text.slice(headline.length), 120);
          }

          // Cross-reference timestamps
          const ts = findTimestamp(a.text, sections);

          const priorityNum = a.priority === 'high' ? 0 : a.priority === 'medium' ? 1 : a.priority === 'low' ? 2 : 3;

          rawItems.push({
            id: `${episodeId}-${globalIndex++}`,
            headline,
            whyItMatters,
            category,
            priority: priorityNum,
            hasResources: !!(a.resources?.length),
            hasTimestamp: !!ts.timestamp,
            episodeId,
            timestamp: ts.timestamp,
            timestampSeconds: ts.timestampSeconds,
            resources: a.resources,
          });
          episodesWithDeepItems.add(episodeId);
        }
      }
    }

    // 2d. Extract BriefItems from quick summaries (for episodes without deep items)
    for (const [episodeId, sums] of episodeSummaries) {
      if (episodesWithDeepItems.has(episodeId)) continue;
      if (!sums.quick?.hook_headline) continue;

      rawItems.push({
        id: `${episodeId}-${globalIndex++}`,
        headline: sums.quick.hook_headline,
        whyItMatters: sums.quick.golden_nugget || '',
        category: 'insight',
        priority: 3,
        hasResources: false,
        hasTimestamp: false,
        episodeId,
      });
    }

    // 2e. Sort and limit
    rawItems.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      if (a.hasResources !== b.hasResources) return a.hasResources ? -1 : 1;
      if (a.hasTimestamp !== b.hasTimestamp) return a.hasTimestamp ? -1 : 1;
      return 0;
    });

    // Max 2 per episode, top MAX_ITEMS total
    const episodeCounts = new Map<string, number>();
    const selected: RawBriefItem[] = [];
    for (const item of rawItems) {
      if (selected.length >= MAX_ITEMS) break;
      const count = episodeCounts.get(item.episodeId) || 0;
      if (count >= MAX_PER_EPISODE) continue;
      episodeCounts.set(item.episodeId, count + 1);
      selected.push(item);
    }

    // Get episode + podcast info
    const episodeIds = [...new Set(selected.map(i => i.episodeId))];
    const { data: episodes } = await admin
      .from('episodes')
      .select('id, title, podcast_id, audio_url, podcasts(id, title, image_url, rss_feed_url)')
      .in('id', episodeIds);

    const episodeMap = new Map(
      (episodes || []).map((ep: any) => [ep.id, ep])
    );

    // 2f. Build final response
    const items: BriefItem[] = selected.map(raw => {
      const ep: any = episodeMap.get(raw.episodeId);
      const podcast = ep ? (Array.isArray(ep.podcasts) ? ep.podcasts[0] : ep.podcasts) : null;
      const isYouTube = podcast?.rss_feed_url?.startsWith('youtube:channel:');

      return {
        id: raw.id,
        headline: raw.headline,
        whyItMatters: raw.whyItMatters,
        category: raw.category,
        source: {
          name: podcast?.title || 'Unknown Source',
          episodeTitle: ep?.title || '',
          episodeId: raw.episodeId,
          imageUrl: podcast?.image_url || undefined,
          type: isYouTube ? 'youtube' : 'podcast',
        },
        timestamp: raw.timestamp,
        timestampSeconds: raw.timestampSeconds,
        resources: raw.resources,
      };
    });

    const result = { items, date: dataDate, isStale } satisfies TodaysBriefResponse;
    await setCached(cacheKey, result, 1800);

    return NextResponse.json(result, { headers: CACHE_HEADERS });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get insights' },
      { status: 500 }
    );
  }
}
