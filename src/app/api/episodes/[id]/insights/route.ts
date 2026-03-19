import { NextRequest, NextResponse, after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requestInsights, getInsightsStatus } from "@/lib/insights-service";
import { resolvePodcastLanguage } from "@/lib/language-utils";
import { deleteCached, CacheKeys, checkRateLimit, checkPlanQuota } from "@/lib/cache";
import { getAuthUser } from "@/lib/auth-helpers";
import { isAdminEmail } from "@/lib/admin";
import { getUserPlan } from "@/lib/user-plan";
import { PLAN_LIMITS } from "@/lib/plans";
import { createLogger } from "@/lib/logger";

export const maxDuration = 300;

const log = createLogger('insights');

// GET /api/episodes/[id]/insights - Get insights status and content
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    
    // Language is auto-detected from existing transcripts in getInsightsStatus
    const status = await getInsightsStatus(id);

    return NextResponse.json(status, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
    });
  } catch (error) {
    console.error("Error fetching insights:", error);
    return NextResponse.json(
      { error: "Failed to fetch insights" },
      { status: 500 }
    );
  }
}

// POST /api/episodes/[id]/insights - Generate insights
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const isAdmin = isAdminEmail(user.email ?? '');

    // Rate limit: 5 requests/min per user (skip for admins)
    if (!isAdmin) {
      const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
      const rlAllowed = await checkRateLimit(`insights:${user.id || ip}`, 5, 60);
      if (!rlAllowed) {
        return NextResponse.json({ error: 'Too many requests. Try again in a minute.' }, { status: 429 });
      }
    }

    // Per-user daily quota (reuse summary limits, skip for admins)
    if (!isAdmin) {
      const plan = await getUserPlan(user.id, user.email ?? undefined);
      const quota = await checkPlanQuota(user.id, 'insights', PLAN_LIMITS[plan].summariesPerDay);
      if (!quota.allowed) {
        return NextResponse.json({
          error: 'Daily insights limit reached',
          limit: quota.limit,
          used: quota.used,
          upgrade_url: '/pricing',
        }, { status: 429 });
      }
    }

    const { id: episodeId } = await context.params;

    // Invalidate stale insights cache so polling picks up the new state
    await deleteCached(CacheKeys.insightsStatus(episodeId, 'en')).catch(() => {});

    const supabase = createAdminClient();

    // Fetch episode with podcast info - language comes from RSS feed
    const { data: episode, error: episodeError } = await supabase
      .from("episodes")
      .select(`
        audio_url,
        transcript_url,
        title,
        podcasts!inner (id, title, language, rss_feed_url)
      `)
      .eq("id", episodeId)
      .single();

    if (episodeError || !episode) {
      return NextResponse.json(
        { error: "Episode not found" },
        { status: 404 }
      );
    }

    // Self-healing language detection via shared utility
    const podcastData = episode.podcasts as unknown as { id: string; title: string; language: string | null; rss_feed_url: string } | null;
    const language = await resolvePodcastLanguage(podcastData, supabase);

    // Build metadata for Apple Podcasts transcript lookup
    const metadata = podcastData?.title && episode.title
      ? { podcastTitle: podcastData.title, episodeTitle: episode.title }
      : undefined;

    // Eagerly upsert status as 'queued' so the client sees it immediately
    await supabase
      .from('summaries')
      .upsert({
        episode_id: episodeId,
        level: 'insights',
        language: language || 'en',
        status: 'queued',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'episode_id,level,language' });

    // Push generation into after() so the response returns immediately
    const resolvedLanguage = language || undefined;
    const audioUrl = episode.audio_url;
    const transcriptUrl = episode.transcript_url || undefined;

    after(async () => {
      try {
        await requestInsights(
          episodeId,
          audioUrl,
          resolvedLanguage,
          transcriptUrl,
          metadata
        );
      } catch (err) {
        log.error('Background insights generation failed', { episodeId, error: String(err) });
        await createAdminClient()
          .from('summaries')
          .update({ status: 'failed', error_message: String(err) })
          .eq('episode_id', episodeId)
          .eq('level', 'insights');
      }
    });

    return NextResponse.json({
      episode_id: episodeId,
      status: 'queued',
    });
  } catch (error) {
    console.error("Error generating insights:", error);
    return NextResponse.json(
      { error: "Failed to generate insights" },
      { status: 500 }
    );
  }
}
