/**
 * GET /api/feed
 * Get unified feed with filters, enriched with summary preview data
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFeed } from '@/lib/rsshub-db';
import { getAuthUser } from '@/lib/auth-helpers';
import { createAdminClient } from '@/lib/supabase/admin';
import { createLogger } from '@/lib/logger';
import type { QuickSummaryContent, DeepSummaryContent } from '@/types/database';

const log = createLogger('feed');

// Simple in-memory cache for source metadata (rarely changes)
const sourceMetadataCache = new Map<string, { data: any; expiry: number }>();
const SOURCE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

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
    const limit = parseInt(searchParams.get('limit') || '20', 10);
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

    // Check cache first, collect uncached IDs
    const uncachedYt: string[] = [];
    const uncachedPod: string[] = [];
    const now = Date.now();

    for (const id of [...new Set(youtubeSourceIds)]) {
      const cached = sourceMetadataCache.get(id);
      if (cached && cached.expiry > now) {
        sourceMap.set(id, cached.data);
      } else {
        uncachedYt.push(id);
      }
    }
    for (const id of [...new Set(podcastSourceIds)]) {
      const cached = sourceMetadataCache.get(id);
      if (cached && cached.expiry > now) {
        sourceMap.set(id, cached.data);
      } else {
        uncachedPod.push(id);
      }
    }

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
      sourceMetadataCache.set(ch.id, { data: meta, expiry: now + SOURCE_CACHE_TTL });
    }

    for (const pod of podcastSources) {
      const meta = {
        sourceName: pod.title || '',
        sourceArtwork: pod.image_url || '',
        sourceAppleId: pod.apple_podcast_id || undefined,
        podcastFeedUrl: pod.rss_feed_url || undefined,
      };
      sourceMap.set(pod.id, meta);
      sourceMetadataCache.set(pod.id, { data: meta, expiry: now + SOURCE_CACHE_TTL });
    }

    // --- Resolve missing episode_ids for YouTube items ---
    const youtubeWithoutEpisode = items.filter(
      (item) => item.sourceType === 'youtube' && !item.episodeId && item.videoId
    );
    if (youtubeWithoutEpisode.length > 0) {
      const videoUrls = youtubeWithoutEpisode.map(
        (item) => `https://www.youtube.com/watch?v=${item.videoId}`
      );
      const { data: resolvedEpisodes } = await admin
        .from('episodes')
        .select('id, audio_url')
        .in('audio_url', videoUrls);

      if (resolvedEpisodes) {
        const urlToId = new Map(resolvedEpisodes.map((e) => [e.audio_url, e.id]));
        for (const item of youtubeWithoutEpisode) {
          const url = `https://www.youtube.com/watch?v=${item.videoId}`;
          const episodeId = urlToId.get(url);
          if (episodeId) {
            (item as any).episodeId = episodeId;
          }
        }
      }
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
