import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthUser } from '@/lib/auth-helpers';
import { getUserPlan } from '@/lib/user-plan';
import { summaryToMarkdown } from '@/lib/summary-to-markdown';
import { createSummaryPage } from '@/lib/notion';
import { createLogger } from '@/lib/logger';
import type { QuickSummaryContent, DeepSummaryContent } from '@/types/database';

const log = createLogger('export-notion');

interface RouteParams {
  params: Promise<{ id: string }>;
}

function formatDuration(seconds: number | null | undefined): string | null {
  if (!seconds) return null;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

/**
 * POST /api/episodes/:id/export/notion
 *
 * Sends the episode summary to the user's connected Notion workspace as a
 * new page in the Yedapo Summaries database.
 *
 * Errors:
 *   401 — not authenticated
 *   403 — not a Pro plan user
 *   404 — episode or summary not found
 *   412 — Notion not connected, or no database (user needs to share a page)
 *   500 — unexpected failure
 */
export async function POST(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id: episodeId } = await params;

    // ── Auth ──
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ── Plan gate ──
    const plan = await getUserPlan(user.id, user.email ?? undefined);
    if (plan !== 'pro') {
      return NextResponse.json(
        { error: 'Pro plan required', upgrade_url: '/pricing' },
        { status: 403 },
      );
    }

    const supabase = createAdminClient();

    // ── Notion connection ──
    const { data: connection, error: connErr } = await supabase
      .from('notion_connections')
      .select('access_token, database_id, database_url, workspace_name')
      .eq('user_id', user.id)
      .maybeSingle();

    if (connErr) {
      log.error('Notion connection lookup failed', { error: connErr.message });
      return NextResponse.json(
        { error: 'Failed to load Notion connection' },
        { status: 500 },
      );
    }

    if (!connection) {
      return NextResponse.json(
        {
          error: 'Notion not connected',
          connect_url: '/settings/connections',
        },
        { status: 412 },
      );
    }

    if (!connection.database_id) {
      return NextResponse.json(
        {
          error: 'Share a Notion page with the Yedapo integration first',
          code: 'no_database',
        },
        { status: 412 },
      );
    }

    // ── Episode + podcast ──
    const { data: episode, error: episodeError } = await supabase
      .from('episodes')
      .select('id, title, published_at, duration_seconds, podcast_id, podcasts(title)')
      .eq('id', episodeId)
      .single();

    if (episodeError || !episode) {
      log.warn('Episode not found for notion export', { episodeId });
      return NextResponse.json({ error: 'Episode not found' }, { status: 404 });
    }

    const podcastTitle =
      (episode.podcasts as unknown as { title: string } | null)?.title ||
      'Unknown Podcast';

    // ── Summaries ──
    const { data: summaries } = await supabase
      .from('summaries')
      .select('level, content_json, status')
      .eq('episode_id', episodeId)
      .eq('status', 'ready')
      .in('level', ['quick', 'deep']);

    if (!summaries || summaries.length === 0) {
      return NextResponse.json(
        { error: 'No summary available for this episode' },
        { status: 404 },
      );
    }

    const quickRow = summaries.find((s) => s.level === 'quick');
    const deepRow = summaries.find((s) => s.level === 'deep');

    const episodeUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://yedapo.com'}/episode/${episodeId}/insights`;

    // ── Markdown ──
    const markdown = summaryToMarkdown({
      episodeTitle: episode.title,
      podcastName: podcastTitle,
      publishedAt: episode.published_at,
      durationSeconds: episode.duration_seconds,
      quickSummary: quickRow?.content_json as QuickSummaryContent | null,
      deepSummary: deepRow?.content_json as DeepSummaryContent | null,
      url: episodeUrl,
    });

    // ── Send to Notion ──
    let page: { id: string; url: string };
    try {
      page = await createSummaryPage(
        connection.access_token,
        connection.database_id,
        {
          title: episode.title,
          podcastName: podcastTitle,
          publishedAt: episode.published_at,
          duration: formatDuration(episode.duration_seconds),
          episodeUrl,
          markdown,
        },
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log.error('Notion createSummaryPage failed', {
        episodeId,
        error: message,
      });

      // Token revoked / unauthorised → ask the user to reconnect
      if (/401|unauthor/i.test(message)) {
        return NextResponse.json(
          {
            error: 'Notion authorization expired. Please reconnect.',
            code: 'reauth_required',
            connect_url: '/settings/connections',
          },
          { status: 412 },
        );
      }

      return NextResponse.json(
        { error: 'Failed to send to Notion' },
        { status: 502 },
      );
    }

    log.success('Notion export successful', {
      episodeId,
      userId: user.id.slice(0, 8),
      pageId: page.id.slice(0, 8),
    });

    return NextResponse.json({
      url: page.url,
      message: 'Sent to Notion',
    });
  } catch (err) {
    log.error('Notion export failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: 'Failed to export summary to Notion' },
      { status: 500 },
    );
  }
}
