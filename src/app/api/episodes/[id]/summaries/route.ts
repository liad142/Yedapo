import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { createAdminClient } from "@/lib/supabase/admin";
import { requestSummary, checkExistingSummary, getSummariesStatus } from "@/lib/summary-service";
import { getAuthUser } from "@/lib/auth-helpers";
import { resolvePodcastLanguage } from "@/lib/language-utils";
import { checkPlanQuota, isAdminEmail, checkRateLimit, deleteCached, CacheKeys } from "@/lib/cache";
import { getUserPlan } from "@/lib/user-plan";
import { PLAN_LIMITS } from "@/lib/plans";
import { createLogger } from "@/lib/logger";
import type { SummaryLevel } from "@/types/database";

const log = createLogger('summary');

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/episodes/:id/summaries - Get both summary levels with statuses
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    log.info('GET request', { episodeId: id });
    const result = await getSummariesStatus(id);
    log.info('GET completed', { episodeId: id });
    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
    });
  } catch (error) {
    log.error('Error fetching summaries', error);
    return NextResponse.json({ error: 'Failed to fetch summaries' }, { status: 500 });
  }
}

// POST /api/episodes/:id/summaries - Request summary generation (idempotent)
export async function POST(request: NextRequest, { params }: RouteParams) {
  const startTime = Date.now();
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isAdmin = isAdminEmail(user.email ?? '');

    // Rate limit: 5 requests/min per user (skip for admins)
    if (!isAdmin) {
      const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
      const rlAllowed = await checkRateLimit(`summary:${user.id || ip}`, 5, 60);
      if (!rlAllowed) {
        return NextResponse.json({ error: 'Too many requests. Try again in a minute.' }, { status: 429 });
      }
    }

    // Fetch user's plan for dynamic quotas
    const plan = await getUserPlan(user.id, user.email ?? undefined);

    const { id } = await params;
    const body = await request.json();
    const level: SummaryLevel = body.level || 'quick';

    if (!['quick', 'deep'].includes(level)) {
      return NextResponse.json({ error: 'Invalid level. Must be "quick" or "deep".' }, { status: 400 });
    }

    log.info('POST request', { episodeId: id, level });

    // Invalidate stale insights cache so polling picks up new generation state
    await deleteCached(CacheKeys.insightsStatus(id, 'en')).catch(() => {});

    // Get episode with podcast info - language comes from RSS feed
    log.info('Fetching episode and podcast from DB...');
    const { data: episode, error: episodeError } = await supabase
      .from('episodes')
      .select(`
        audio_url,
        transcript_url,
        title,
        podcasts!inner (id, title, language, rss_feed_url)
      `)
      .eq('id', id)
      .single();

    if (episodeError || !episode) {
      log.warn('Episode not found', { episodeId: id });
      return NextResponse.json({ error: 'Episode not found' }, { status: 404 });
    }

    // Self-healing language detection via shared utility
    const podcastData = episode.podcasts as unknown as { id: string; title: string; language: string | null; rss_feed_url: string } | null;
    const language = await resolvePodcastLanguage(podcastData, supabase);

    // Build metadata for Apple Podcasts transcript lookup
    const metadata = podcastData?.title && episode.title
      ? { podcastTitle: podcastData.title, episodeTitle: episode.title }
      : undefined;

    log.info('Episode found, checking existing summary...', {
      transcriptUrl: episode.transcript_url ? 'YES (FREE!)' : 'NO',
      hasAppleMetadata: !!metadata,
      language
    });

    // Quick check: if summary already exists and is ready/in-progress, return immediately
    // Cached reads are FREE — no quota consumed.
    const existing = await checkExistingSummary(id, level, language || 'en');
    if (existing) {
      log.info('Returning existing summary (cached, free)', { status: existing.status });
      return NextResponse.json({ episodeId: id, level, source: 'cached', ...existing });
    }

    // Per-user daily quota — only consumed for NEW generations (skip for admins)
    if (!isAdmin) {
      const quota = await checkPlanQuota(user.id, 'summary', PLAN_LIMITS[plan].summariesPerDay);
      if (!quota.allowed) {
        return NextResponse.json({
          error: 'Daily summary limit reached',
          limit: quota.limit,
          used: quota.used,
          upgrade_url: '/pricing',
        }, { status: 429 });
      }
    }

    // Fire off the heavy generation in the background (non-blocking)
    // The frontend polls GET /summaries to track progress
    const userId = user.id;
    const resolvedLanguage = language || undefined;
    requestSummary(
      id,
      level,
      episode.audio_url,
      resolvedLanguage,
      episode.transcript_url || undefined,
      metadata
    ).then(async (result) => {
      // Record user ownership after completion (non-blocking)
      if (result.status === 'ready') {
        try {
          const admin = createAdminClient();
          const { data: summaryRecord } = await admin
            .from('summaries')
            .select('id')
            .eq('episode_id', id)
            .eq('level', level)
            .eq('language', language || 'en')
            .order('updated_at', { ascending: false })
            .limit(1)
            .single();

          if (summaryRecord) {
            await admin
              .from('user_summaries')
              .upsert({
                user_id: userId,
                summary_id: summaryRecord.id,
                episode_id: id,
              }, { onConflict: 'user_id,summary_id', ignoreDuplicates: true });
          }
        } catch (err) {
          log.warn('Failed to record user_summary (non-blocking)', { error: String(err) });
        }
      }
      log.success('Background generation completed', {
        episodeId: id,
        level,
        status: result.status,
        totalDurationMs: Date.now() - startTime,
      });
    }).catch((err) => {
      log.error('Background generation FAILED', { episodeId: id, level, error: String(err) });
    });

    // Return immediately — the summary record was created by requestSummary's
    // initial upsert, so polling will find it with status "transcribing"
    log.info('POST returning immediately (background generation started)', { episodeId: id, level });
    return NextResponse.json({
      episodeId: id,
      level,
      source: 'generated',
      status: 'transcribing',
    });
  } catch (error) {
    log.error('POST request FAILED', {
      error: error instanceof Error ? error.message : String(error),
      totalDurationMs: Date.now() - startTime
    });
    return NextResponse.json({ error: 'Failed to request summary' }, { status: 500 });
  }
}
