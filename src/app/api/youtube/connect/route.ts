import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth-helpers';
import { createLogger } from '@/lib/logger';

const log = createLogger('youtube');

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;

/**
 * GET /api/youtube/connect
 * Returns the Google OAuth URL for YouTube permission
 */
export async function GET(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const origin = new URL(request.url).origin;
  const redirectUri = `${origin}/api/youtube/connect/callback`;
  const loginHint = request.nextUrl.searchParams.get('login_hint') || '';

  // Generate a random state to prevent CSRF attacks
  const state = crypto.randomUUID();

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/youtube.readonly',
    access_type: 'offline',
    prompt: 'consent',
    state,
    ...(loginHint && { login_hint: loginHint }),
  });

  log.info('YouTube connect URL generated', { userId: user.id.slice(0, 8) });

  const response = NextResponse.json({
    url: `https://accounts.google.com/o/oauth2/v2/auth?${params}`,
  });

  // Store state in a short-lived httpOnly cookie for validation in the callback
  response.cookies.set('yt_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 600, // 10 minutes
  });

  return response;
}
