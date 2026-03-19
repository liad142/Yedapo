/**
 * GET /api/feed
 * Get unified feed with filters, enriched with summary preview data
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFeed } from '@/lib/rsshub-db';
import { getAuthUser } from '@/lib/auth-helpers';
import { createAdminClient } from '@/lib/supabase/admin';
import { createLogger } from '@/lib/logger';
import { getCachedMulti, setCached } from '@/lib/cache';
import type { QuickSummaryContent, DeepSummaryContent } from '@/types/database';

const log = createLogger('feed');

export async function GET(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const sourceType = searchParams.get('sourceType') as 'youtube' | 'podcast' | 'all' || 'all';
    const mode = searchParams.get('mode') as 'following' | 'latest' | 'mixed' || 'latest';
    const bookmarkedOnly = searchParams.get('bookmarked') === 'true';
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10) || 20, 100);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    log.info('Fetching', { userId: user.id.slice(0, 8), sourceType, mode, limit, offset });

    const items = await getFeed({
      userId: user.id,
      sourceType,
      mode,
      bookmarkedOnly,
      limit,
      offset,
    });

    const admin = createAdminClient();

    // --- Enrich with source metadata ---
    const youtubeSourceIds: string[] = [];
    const podcastSourceIds: string[] = [];
    for (const item of items) {
      if (!item.sourceId) continue;
      if (item.sourceType === 'youtube') youtubeSourceIds.push(item.sourceId);
      else if (item.sourceType === 'podcast') podcastSourceIds.push(item.sourceId);
    }

    const sourceMap = new Map<string, {
      sourceName: string;
      sourceArtwork: string;
      sourceAppleId?: string;
      podcastFeedUrl?: string;
    }>();

    // Check Redis cache first, collect uncached IDs
    const uniqueYt = [...new Set(youtubeSourceIds)];
    const uniquePod = [...new Set(podcastSourceIds)];

    const ytCacheKeys = uniqueYt.map(id => `src:yt:${id}`);
    const podCacheKeys = uniquePod.map(id => `src:pod:${id}`);

    const [ytCached, podCached] = await Promise.all([
      ytCacheKeys.length > 0 ? getCachedMulti<{ sourceName: string; sourceArtwork: string }>(ytCacheKeys) : [],
      podCacheKeys.length > 0 ? getCachedMulti<{ sourceName: string; sourceArtwork: string; sourceAppleId?: string; podcastFeedUrl?: string }>(podCacheKeys) : [],
    ]);

    const uncachedYt: string[] = [];
    const uncachedPod: string[] = [];

    uniqueYt.forEach((id, i) => {
      if (ytCached[i]) {
        sourceMap.set(id, ytCached[i]!);
      } else {
        uncachedYt.push(id);
      }
    });
    uniquePod.forEach((id, i) => {
      if (podCached[i]) {
        sourceMap.set(id, podCached[i]!);
      } else {
        uncachedPod.push(id);
      }
    });

    // Batch fetch uncached sources in parallel
    const [ytChannels, podcastSources] = await Promise.all([
      uncachedYt.length > 0
        ? admin
            .from('youtube_channels')
            .select('id, channel_name, thumbnail_url')
            .in('id', uncachedYt)
            .then(r => r.data || [])
        : [],
      uncachedPod.length > 0
        ? admin
            .from('podcasts')
            .select('id, title, image_url, apple_podcast_id, rss_feed_url')
            .in('id', uncachedPod)
            .then(r => r.data || [])
        : [],
    ]);

    for (const ch of ytChannels) {
      const meta = {
        sourceName: ch.channel_name || '',
        sourceArtwork: ch.thumbnail_url || '',
      };
      sourceMap.set(ch.id, meta);
      setCached(`src:yt:${ch.id}`, meta, 3600);
    }

    for (const pod of podcastSources) {
      const meta = {
        sourceName: pod.title || '',
        sourceArtwork: pod.image_url || '',
        sourceAppleId: pod.apple_podcast_id || undefined,
        podcastFeedUrl: pod.rss_feed_url || undefined,
      };
      sourceMap.set(pod.id, meta);
      setCached(`src:pod:${pod.id}`, meta, 3600);
    }

    // --- Enrich with summary preview data ---
    const episodeIds = items
      .map(item => item.episodeId)
      .filter((id): id is string => !!id);

    let summaryMap = new Map<string, {
      hookHeadline?: string;
      executiveBrief?: string;
      tags?: string[];
      takeawayCount?: number;
      chapterCount?: number;
      status: 'none' | 'ready';
    }>();

    if (episodeIds.length > 0) {
      const { data: summaries } = await admin
        .from('summaries')
        .select('episode_id, level, content_json, status')
        .in('episode_id', episodeIds)
        .eq('status', 'ready')
        .in('level', ['quick', 'deep']);

      if (summaries) {
        for (const s of summaries) {
          if (!s.content_json) continue;
          const existing = summaryMap.get(s.episode_id) || { status: 'ready' as const };

          if (s.level === 'quick') {
            const q = s.content_json as QuickSummaryContent;
            summaryMap.set(s.episode_id, {
              ...existing,
              tags: q.tags,
              hookHeadline: q.hook_headline,
              executiveBrief: q.executive_brief,
              status: 'ready',
            });
          } else if (s.level === 'deep') {
            const d = s.content_json as DeepSummaryContent;
            summaryMap.set(s.episode_id, {
              ...existing,
              ...(!existing.hookHeadline && {
                tags: (d.core_concepts || []).map(c => c.concept),
                executiveBrief: d.comprehensive_overview?.slice(0, 300),
              }),
              takeawayCount: d.actionable_takeaways?.length ?? 0,
              chapterCount: d.chronological_breakdown?.length ?? 0,
              status: 'ready',
            });
          }
        }
      }
    }

    // Attach summary + source data to items
    const enrichedItems = items.map(item => {
      const preview = item.episodeId ? summaryMap.get(item.episodeId) : undefined;
      const source = item.sourceId ? sourceMap.get(item.sourceId) : undefined;
      return {
        ...item,
        sourceName: source?.sourceName || '',
        sourceArtwork: source?.sourceArtwork || item.thumbnailUrl || '',
        sourceAppleId: source?.sourceAppleId,
        podcastFeedUrl: source?.podcastFeedUrl,
        summaryPreview: preview ? {
          hookHeadline: preview.hookHeadline,
          executiveBrief: preview.executiveBrief,
          tags: preview.tags,
          takeawayCount: preview.takeawayCount,
          chapterCount: preview.chapterCount,
        } : undefined,
        summaryStatus: preview ? 'ready' : 'none',
      };
    });

    log.success('Returned items', { count: enrichedItems.length, hasMore: enrichedItems.length === limit });

    return NextResponse.json({
      success: true,
      items: enrichedItems,
      total: enrichedItems.length,
      hasMore: enrichedItems.length === limit,
    }, {
      headers: { 'Cache-Control': 'private, no-cache' },
    });
  } catch (error) {
    log.error('Error', error);
    return NextResponse.json(
      {
        error: 'Failed to get feed',
      },
      { status: 500 }
    );
  }
}
