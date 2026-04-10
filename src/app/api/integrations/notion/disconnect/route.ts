import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth-helpers';
import { createAdminClient } from '@/lib/supabase/admin';
import { createLogger } from '@/lib/logger';

const log = createLogger('notion');

/**
 * POST /api/integrations/notion/disconnect
 *
 * Auth required. Deletes the user's `notion_connections` row.
 */
export async function POST(_request: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const admin = createAdminClient();
    const { error } = await admin
      .from('notion_connections')
      .delete()
      .eq('user_id', user.id);

    if (error) {
      log.error('Notion disconnect DB error', { error: error.message });
      return NextResponse.json(
        { error: 'Failed to disconnect Notion' },
        { status: 500 },
      );
    }

    log.success('Notion disconnected', { userId: user.id.slice(0, 8) });
    return NextResponse.json({ ok: true });
  } catch (err) {
    log.error('Notion disconnect failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: 'Failed to disconnect Notion' },
      { status: 500 },
    );
  }
}
