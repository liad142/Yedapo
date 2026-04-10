import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth-helpers';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  exchangeNotionCode,
  searchSharedPages,
  createYedapoDatabase,
  getNotionRedirectUri,
} from '@/lib/notion';
import { createLogger } from '@/lib/logger';

const log = createLogger('notion');

/**
 * GET /api/integrations/notion/callback
 *
 * Notion redirects here after the user approves the integration.
 * Flow:
 *   1. Validate state cookie (CSRF)
 *   2. Exchange the auth code for an access token
 *   3. Try to find a page the user shared with the integration
 *   4. If found → create "Yedapo Summaries" database inside it
 *   5. Upsert the connection row, redirect back to settings
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const state = searchParams.get('state');

  const settingsUrl = `${origin}/settings/connections`;

  // User denied / Notion returned error
  if (error || !code) {
    log.info('Notion connect cancelled', { error });
    const res = NextResponse.redirect(`${settingsUrl}?notion=cancelled`);
    res.cookies.delete('notion_oauth_state');
    return res;
  }

  // CSRF state check
  const expectedState = request.cookies.get('notion_oauth_state')?.value;
  if (!state || !expectedState || state !== expectedState) {
    log.error('Notion connect CSRF state mismatch', {
      hasState: !!state,
      hasExpected: !!expectedState,
    });
    const res = NextResponse.redirect(`${settingsUrl}?notion=error`);
    res.cookies.delete('notion_oauth_state');
    return res;
  }

  const user = await getAuthUser();
  if (!user) {
    const res = NextResponse.redirect(`${settingsUrl}?notion=unauthorized`);
    res.cookies.delete('notion_oauth_state');
    return res;
  }

  try {
    const tokens = await exchangeNotionCode(code, getNotionRedirectUri());

    // Try to auto-create the database if the user has shared any page
    let databaseId: string | null = null;
    let databaseUrl: string | null = null;
    let needsShare = false;

    try {
      const pages = await searchSharedPages(tokens.access_token);
      if (pages.length > 0) {
        const parent = pages[0];
        const db = await createYedapoDatabase(tokens.access_token, parent.id);
        databaseId = db.id;
        databaseUrl = db.url;
        log.success('Yedapo database created', {
          userId: user.id.slice(0, 8),
          parentPageId: parent.id.slice(0, 8),
        });
      } else {
        needsShare = true;
        log.info('No shared pages found, user must share one', {
          userId: user.id.slice(0, 8),
        });
      }
    } catch (dbErr) {
      log.warn('Failed to auto-create Yedapo database', {
        error: dbErr instanceof Error ? dbErr.message : String(dbErr),
      });
      needsShare = true;
    }

    const admin = createAdminClient();
    const { error: upsertError } = await admin
      .from('notion_connections')
      .upsert(
        {
          user_id: user.id,
          access_token: tokens.access_token,
          workspace_id: tokens.workspace_id,
          workspace_name: tokens.workspace_name,
          workspace_icon: tokens.workspace_icon,
          bot_id: tokens.bot_id,
          database_id: databaseId,
          database_url: databaseUrl,
          connected_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      );

    if (upsertError) {
      log.error('Failed to persist notion connection', {
        error: upsertError.message,
      });
      const res = NextResponse.redirect(`${settingsUrl}?notion=error`);
      res.cookies.delete('notion_oauth_state');
      return res;
    }

    const status = needsShare ? 'needs_share' : 'connected';
    log.success('Notion connected', {
      userId: user.id.slice(0, 8),
      workspace: tokens.workspace_name,
      status,
    });

    const res = NextResponse.redirect(`${settingsUrl}?notion=${status}`);
    res.cookies.delete('notion_oauth_state');
    return res;
  } catch (err) {
    log.error('Notion callback error', {
      error: err instanceof Error ? err.message : String(err),
    });
    const res = NextResponse.redirect(`${settingsUrl}?notion=error`);
    res.cookies.delete('notion_oauth_state');
    return res;
  }
}
