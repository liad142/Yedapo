import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth-helpers';
import { createAdminClient } from '@/lib/supabase/admin';
import { createLogger } from '@/lib/logger';

const log = createLogger('notion');

/**
 * GET /api/integrations/notion/status
 *
 * Auth required. Returns whether the user has a Notion connection and
 * whether the Yedapo Summaries database has been created yet.
 */
export async function GET(_request: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('notion_connections')
      .select('workspace_name, workspace_icon, database_id, database_url, connected_at')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      log.error('Notion status DB error', { error: error.message });
      return NextResponse.json(
        { error: 'Failed to load Notion status' },
        { status: 500 },
      );
    }

    if (!data) {
      return NextResponse.json({
        connected: false,
        has_database: false,
      });
    }

    return NextResponse.json({
      connected: true,
      workspace_name: data.workspace_name ?? null,
      workspace_icon: data.workspace_icon ?? null,
      has_database: !!data.database_id,
      database_url: data.database_url ?? null,
      connected_at: data.connected_at ?? null,
    });
  } catch (err) {
    log.error('Notion status failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: 'Failed to load Notion status' },
      { status: 500 },
    );
  }
}
