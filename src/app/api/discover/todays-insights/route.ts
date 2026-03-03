/**
 * GET /api/discover/todays-insights
 * Returns 3-5 distilled insights from today's summaries
 */

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { QuickSummaryContent, DeepSummaryContent, ActionItem } from '@/types/database';

export interface TodayInsight {
  text: string;
  sourceName: string;
  episodeTitle: string;
  episodeId: string;
  timestamp?: string;
  timestampSeconds?: number;
  type: 'podcast' | 'youtube';
}

export async function GET() {
  try {
    const admin = createAdminClient();

    // Get summaries updated today with status='ready'
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();

    const { data: summaries, error: summariesError } = await admin
      .from('summaries')
      .select('episode_id, level, content_json, updated_at')
      .eq('status', 'ready')
      .in('level', ['quick', 'deep'])
      .gte('updated_at', todayISO)
      .order('updated_at', { ascending: false })
      .limit(50);

    if (summariesError || !summaries?.length) {
      return NextResponse.json({ insights: [] }, {
        headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600' },
      });
    }

    // Extract insights from summaries
    const rawInsights: Array<{
      text: string;
      episodeId: string;
      timestamp?: string;
      timestampSeconds?: number;
      updatedAt: string;
    }> = [];

    for (const s of summaries) {
      if (!s.content_json) continue;

      if (s.level === 'deep') {
        const d = s.content_json as DeepSummaryContent;
        // Extract high-priority actionable takeaways
        if (d.actionable_takeaways) {
          for (const item of d.actionable_takeaways) {
            if (typeof item === 'string') {
              rawInsights.push({ text: item, episodeId: s.episode_id, updatedAt: s.updated_at });
            } else {
              const a = item as ActionItem;
              if (a.priority === 'high') {
                rawInsights.push({ text: a.text, episodeId: s.episode_id, updatedAt: s.updated_at });
              }
            }
          }
        }
      } else if (s.level === 'quick') {
        const q = s.content_json as QuickSummaryContent;
        // Extract golden nugget
        if (q.golden_nugget) {
          rawInsights.push({ text: q.golden_nugget, episodeId: s.episode_id, updatedAt: s.updated_at });
        }
      }
    }

    if (rawInsights.length === 0) {
      return NextResponse.json({ insights: [] }, {
        headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600' },
      });
    }

    // Deduplicate by episode_id (keep first per episode)
    const seenEpisodes = new Set<string>();
    const uniqueInsights = rawInsights.filter(i => {
      if (seenEpisodes.has(i.episodeId)) return false;
      seenEpisodes.add(i.episodeId);
      return true;
    });

    // Take top 5
    const topInsights = uniqueInsights.slice(0, 5);

    // Get episode + podcast info for these insights
    const episodeIds = topInsights.map(i => i.episodeId);
    const { data: episodes } = await admin
      .from('episodes')
      .select('id, title, podcast_id, audio_url, podcasts(id, title, rss_feed_url)')
      .in('id', episodeIds);

    const episodeMap = new Map(
      (episodes || []).map((ep: any) => [ep.id, ep])
    );

    // Determine type based on audio_url presence
    const insights: TodayInsight[] = topInsights.map(raw => {
      const ep: any = episodeMap.get(raw.episodeId);
      const podcast = ep ? (Array.isArray(ep.podcasts) ? ep.podcasts[0] : ep.podcasts) : null;
      const hasAudio = !!ep?.audio_url;

      return {
        text: raw.text,
        sourceName: podcast?.title || 'Unknown Source',
        episodeTitle: ep?.title || '',
        episodeId: raw.episodeId,
        timestamp: raw.timestamp,
        timestampSeconds: raw.timestampSeconds,
        type: hasAudio ? 'podcast' : 'youtube',
      };
    });

    return NextResponse.json({ insights }, {
      headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600' },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get insights' },
      { status: 500 }
    );
  }
}
