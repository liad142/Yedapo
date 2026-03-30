/**
 * GET /api/discover/todays-insights
 * Returns categorized brief items from today's (or most recent) summaries
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCached, setCached } from '@/lib/cache';
import { getCountryLanguages } from '@/lib/region-data';
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
    const country = request.nextUrl.searchParams.get('country')?.toLowerCase() || '';
    const cacheKey = `discover:insights:${country || lang || 'all'}`;
    const cached = await getCached<TodaysBriefResponse>(cacheKey);
    if (cached) {
      return NextResponse.json(cached, { headers: CACHE_HEADERS });
    }

    const admin = createAdminClient();

    // 2a. Query last 3 days, fall back to most recent if empty
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();
    const threeDaysAgo = new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000);
    const recentISO = threeDaysAgo.toISOString();
    let isStale = false;
    let dataDate = new Date().toISOString().split('T')[0];

    let { data: summaries, error } = await admin
      .from('summaries')
      .select('episode_id, level, language, content_json, updated_at')
      .eq('status', 'ready')
      .in('level', ['quick', 'deep'])
      .gte('updated_at', recentISO)
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
    } else {
      // Mark stale only if no items are from today
      const hasToday = summaries.some(s => s.updated_at >= todayISO);
      if (!hasToday) {
        isStale = true;
      }
      dataDate = summaries[0].updated_at.split('T')[0];
    }

    // Filter by country languages (uses same pattern as daily-mix)
    const allowedLanguages = country ? getCountryLanguages(country) : null;
    if (allowedLanguages && summaries?.length) {
      const matched = summaries.filter((s: any) => {
        const sLang = (s.language || 'en').toLowerCase();
        return allowedLanguages.includes(sLang);
      });
      if (matched.length > 0) summaries = matched;
    } else if (lang && lang !== 'en' && summaries?.length) {
      // Legacy fallback: filter by lang param
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

    // 2e. Sort and select with diversity constraints
    rawItems.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      if (a.hasResources !== b.hasResources) return a.hasResources ? -1 : 1;
      if (a.hasTimestamp !== b.hasTimestamp) return a.hasTimestamp ? -1 : 1;
      return 0;
    });

    // Dynamic per-episode cap: fewer sources → fewer items per source
    const uniqueSources = new Set(rawItems.map(i => i.episodeId)).size;
    const effectiveMaxPerEpisode = uniqueSources <= 2 ? 1 : uniqueSources <= 4 ? 2 : MAX_PER_EPISODE;
    const MIN_SOURCES = 3;

    // Pass 1: select with per-episode cap
    const episodeCounts = new Map<string, number>();
    const selected: RawBriefItem[] = [];
    for (const item of rawItems) {
      if (selected.length >= MAX_ITEMS) break;
      const count = episodeCounts.get(item.episodeId) || 0;
      if (count >= effectiveMaxPerEpisode) continue;
      episodeCounts.set(item.episodeId, count + 1);
      selected.push(item);
    }

    // Pass 2: ensure minimum source diversity — swap in items from new sources
    const selectedSources = new Set(selected.map(i => i.episodeId));
    if (selectedSources.size < MIN_SOURCES && selected.length >= MAX_ITEMS) {
      const unseenItems = rawItems.filter(i => !selectedSources.has(i.episodeId));
      for (const newItem of unseenItems) {
        if (selectedSources.size >= MIN_SOURCES) break;
        // Replace the last item from the most-represented source
        let replaceIdx = -1;
        let maxCount = 0;
        for (let i = selected.length - 1; i >= 0; i--) {
          const cnt = episodeCounts.get(selected[i].episodeId) || 0;
          if (cnt > maxCount) { maxCount = cnt; replaceIdx = i; }
        }
        if (replaceIdx === -1 || maxCount <= 1) break;
        const removed = selected[replaceIdx];
        episodeCounts.set(removed.episodeId, (episodeCounts.get(removed.episodeId) || 1) - 1);
        selected[replaceIdx] = newItem;
        episodeCounts.set(newItem.episodeId, 1);
        selectedSources.add(newItem.episodeId);
      }
    }

    // Get episode + podcast info
    const episodeIds = [...new Set(selected.map(i => i.episodeId))];
    const { data: episodes } = await admin
      .from('episodes')
      .select('id, title, podcast_id, audio_url, podcasts(id, title, image_url, rss_feed_url)')
      .in('id', episodeIds);

    // Backfill YouTube channel thumbnails for episodes missing image_url
    const ytEps = (episodes || []).filter((ep: any) => {
      const p = Array.isArray(ep.podcasts) ? ep.podcasts[0] : ep.podcasts;
      return !p?.image_url && p?.rss_feed_url?.startsWith('youtube:channel:');
    });
    if (ytEps.length > 0) {
      const chIds = ytEps.map((ep: any) => {
        const p = Array.isArray(ep.podcasts) ? ep.podcasts[0] : ep.podcasts;
        return p.rss_feed_url.replace('youtube:channel:', '');
      });
      const { data: ytChannels } = await admin
        .from('youtube_channels')
        .select('channel_id, thumbnail_url')
        .in('channel_id', chIds);
      if (ytChannels?.length) {
        const thumbMap = new Map(ytChannels.map((ch: any) => [ch.channel_id, ch.thumbnail_url]));
        for (const ep of ytEps) {
          const p = Array.isArray(ep.podcasts) ? ep.podcasts[0] : ep.podcasts;
          const chId = p.rss_feed_url.replace('youtube:channel:', '');
          if (thumbMap.has(chId)) p.image_url = thumbMap.get(chId);
        }
      }
    }

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
