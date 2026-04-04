import { createAdminClient } from '@/lib/supabase/admin';
import { createLogger } from '@/lib/logger';

const log = createLogger('token');

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

/**
 * Get a valid YouTube access token for a user.
 * Reads from DB, checks expiry, refreshes via Google OAuth2 if expired.
 * Returns null if user has no Google tokens.
 */
export async function getYouTubeAccessToken(userId: string): Promise<string | null> {
  const supabase = createAdminClient();

  const { data: tokenRow, error } = await supabase
    .from('user_provider_tokens')
    .select('*')
    .eq('user_id', userId)
    .eq('provider', 'google')
    .single();

  if (error || !tokenRow) return null;

  // Check if token is still valid (with 5-min buffer)
  const expiresAt = tokenRow.expires_at ? new Date(tokenRow.expires_at) : null;
  const isExpired = !expiresAt || expiresAt.getTime() < Date.now() + 5 * 60 * 1000;

  if (!isExpired) {
    return tokenRow.access_token;
  }

  // Token expired — attempt refresh
  if (!tokenRow.refresh_token) {
    return null;
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    log.error('GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET not set');
    return null;
  }

  try {
    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: tokenRow.refresh_token,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      log.error('Token refresh failed', { status: response.status });
      return null;
    }

    const data = await response.json();
    const newAccessToken = data.access_token as string;
    const expiresIn = (data.expires_in as number) || 3600;

    // Update stored token — check for errors to avoid silent DB desync
    const { error: updateError } = await supabase
      .from('user_provider_tokens')
      .update({
        access_token: newAccessToken,
        expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('provider', 'google');

    if (updateError) {
      log.error('Failed to persist refreshed token', { userId: userId.slice(0, 8), error: updateError.message });
    }

    return newAccessToken;
  } catch (err) {
    log.error('Token refresh error', err);
    return null;
  }
}
