import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthUser } from '@/lib/auth-helpers';
import { getUserPlan } from '@/lib/user-plan';
import { summaryToMarkdown } from '@/lib/summary-to-markdown';
import { createLogger } from '@/lib/logger';
import type { QuickSummaryContent, DeepSummaryContent } from '@/types/database';

const log = createLogger('export');

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/episodes/:id/export
 *
 * Returns the episode summary as a downloadable Markdown file.
 * Requires authentication and a Pro plan.
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
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

    // ── Fetch episode + podcast ──
    const supabase = createAdminClient();

    const { data: episode, error: episodeError } = await supabase
      .from('episodes')
      .select('id, title, published_at, duration_seconds, podcast_id, podcasts(title)')
      .eq('id', episodeId)
      .single();

    if (episodeError || !episode) {
      log.warn('Episode not found for export', { episodeId });
      return NextResponse.json({ error: 'Episode not found' }, { status: 404 });
    }

    const podcastTitle =
      (episode.podcasts as unknown as { title: string } | null)?.title ||
      'Unknown Podcast';

    // ── Fetch summaries (quick + deep) ──
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

    // ── Generate markdown ──
    const markdown = summaryToMarkdown({
      episodeTitle: episode.title,
      podcastName: podcastTitle,
      publishedAt: episode.published_at,
      durationSeconds: episode.duration_seconds,
      quickSummary: quickRow?.content_json as QuickSummaryContent | null,
      deepSummary: deepRow?.content_json as DeepSummaryContent | null,
      url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://yedapo.com'}/episode/${episodeId}/insights`,
    });

    // ── Sanitize filename ──
    const safeTitle = episode.title
      .replace(/[^a-zA-Z0-9\s\-_]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 80)
      .replace(/-+$/, '');
    const filename = `${safeTitle || 'episode-summary'}.md`;

    log.info('Export successful', { episodeId, userId: user.id.slice(0, 8) });

    return new NextResponse(markdown, {
      status: 200,
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'private, no-cache',
      },
    });
  } catch (error) {
    log.error('Export failed', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Failed to export summary' }, { status: 500 });
  }
}
