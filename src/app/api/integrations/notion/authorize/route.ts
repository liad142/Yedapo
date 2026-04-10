import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth-helpers';
import { buildNotionAuthorizeUrl } from '@/lib/notion';
import { createLogger } from '@/lib/logger';

const log = createLogger('notion');

/**
 * POST /api/integrations/notion/authorize
 *
 * Auth required. Generates an OAuth state token, stores it in an httpOnly
 * cookie, and returns the Notion authorize URL the client should navigate to.
 */
export async function POST(_request: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!process.env.NOTION_CLIENT_ID) {
    log.error('NOTION_CLIENT_ID not set');
    return NextResponse.json(
      { error: 'Notion integration not configured' },
      { status: 500 },
    );
  }

  const state = crypto.randomUUID();

  let url: string;
  try {
    url = buildNotionAuthorizeUrl(state);
  } catch (err) {
    log.error('Failed to build Notion authorize URL', {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: 'Notion integration not configured' },
      { status: 500 },
    );
  }

  log.info('Notion authorize URL generated', { userId: user.id.slice(0, 8) });

  const response = NextResponse.json({ url });
  response.cookies.set('notion_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 600, // 10 minutes
  });
  return response;
}
