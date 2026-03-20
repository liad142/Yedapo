import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createAdminClient } from '@/lib/supabase/admin';
import { createLogger } from '@/lib/logger';
import type { EmailOtpType } from '@supabase/supabase-js';

const log = createLogger('auth');

function sanitizeNext(next: string | null): string {
  if (!next) return '/discover';
  if (!next.startsWith('/') || next.startsWith('//')) return '/discover';
  return next;
}

function createSupabaseClient(request: NextRequest) {
  const pendingCookies: Array<{ name: string; value: string; options: Record<string, unknown> }> = [];

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          cookiesToSet.forEach((cookie) => pendingCookies.push(cookie));
        },
      },
    }
  );

  return { supabase, pendingCookies };
}

async function handlePostAuth(userId: string, origin: string, next: string): Promise<string> {
  const admin = createAdminClient();

  const { data: profile } = await admin
    .from('user_profiles')
    .select('onboarding_completed')
    .eq('id', userId)
    .single();

  const shouldOnboard = !profile || !profile.onboarding_completed;
  const redirectUrl = shouldOnboard
    ? `${origin}/onboarding`
    : `${origin}${next}`;
  log.info('Redirecting', { onboarding: shouldOnboard ? 'needed' : 'done', redirectUrl });
  return redirectUrl;
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const token_hash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const next = sanitizeNext(searchParams.get('next'));

  // --- Flow 1: Email confirmation (token_hash + type) ---
  if (token_hash && type) {
    log.info('Verifying email OTP...', { type });
    const { supabase, pendingCookies } = createSupabaseClient(request);

    const { data, error } = await supabase.auth.verifyOtp({ token_hash, type });

    let redirectUrl = `${origin}/discover`;

    if (error) {
      log.error('OTP verification error', { message: error.message });
    }

    if (!error && data?.user) {
      log.success('Email verified', { email: data.user.email, userId: data.user.id.slice(0, 8) });
      redirectUrl = await handlePostAuth(data.user.id, origin, next);
    }

    const response = NextResponse.redirect(redirectUrl);
    pendingCookies.forEach(({ name, value, options }) => {
      response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2]);
    });
    return response;
  }

  // --- Flow 2: OAuth / PKCE code exchange ---
  if (code) {
    log.info('Exchanging code for session...');
    const { supabase, pendingCookies } = createSupabaseClient(request);

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    let redirectUrl = `${origin}/discover`;

    if (error) {
      log.error('Session exchange error', { message: error.message });
    }

    if (!error && data?.user) {
      log.success('User authenticated', { email: data.user.email, userId: data.user.id.slice(0, 8) });

      // Store provider tokens for YouTube API access
      const providerToken = data.session?.provider_token;
      const providerRefreshToken = data.session?.provider_refresh_token;

      if (providerToken) {
        try {
          const admin = createAdminClient();
          await admin
            .from('user_provider_tokens')
            .upsert(
              {
                user_id: data.user.id,
                provider: 'google',
                access_token: providerToken,
                refresh_token: providerRefreshToken || null,
                expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
                updated_at: new Date().toISOString(),
              },
              { onConflict: 'user_id,provider' }
            );
        } catch (err) {
          log.error('Failed to store provider tokens', err);
        }
      }

      redirectUrl = await handlePostAuth(data.user.id, origin, next);
    }

    const response = NextResponse.redirect(redirectUrl);
    pendingCookies.forEach(({ name, value, options }) => {
      response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2]);
    });
    return response;
  }

  // No auth params — redirect to discover
  log.warn('Auth callback called without code or token_hash', {
    params: Object.fromEntries(searchParams.entries()),
  });
  return NextResponse.redirect(`${origin}/discover`);
}
