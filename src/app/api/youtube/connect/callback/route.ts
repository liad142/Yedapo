import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth-helpers';
import { createAdminClient } from '@/lib/supabase/admin';
import { createLogger } from '@/lib/logger';

const log = createLogger('youtube');

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

/**
 * GET /api/youtube/connect/callback
 * Google redirects here after user grants YouTube permission.
 * Exchanges the code for tokens, stores them, and redirects to /settings.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  // User denied or cancelled
  if (error || !code) {
    log.info('YouTube connect cancelled', { error });
    return NextResponse.redirect(`${origin}/settings`);
  }

  const user = await getAuthUser();
  if (!user) {
    return NextResponse.redirect(`${origin}/settings`);
  }

  const redirectUri = `${origin}/api/youtube/connect/callback`;

  try {
    const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      log.error('YouTube token exchange failed', { status: tokenRes.status, body: err });
      return NextResponse.redirect(`${origin}/settings`);
    }

    const tokens = await tokenRes.json();
    log.success('YouTube tokens received', { userId: user.id.slice(0, 8), hasRefresh: !!tokens.refresh_token });

    const admin = createAdminClient();
    await admin
      .from('user_provider_tokens')
      .upsert(
        {
          user_id: user.id,
          provider: 'google',
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token || null,
          expires_at: new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,provider' }
      );

    return NextResponse.redirect(`${origin}/settings?yt=connected`);
  } catch (err) {
    log.error('YouTube connect error', err);
    return NextResponse.redirect(`${origin}/settings`);
  }
}
