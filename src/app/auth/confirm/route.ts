import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createAdminClient } from '@/lib/supabase/admin';
import { createLogger } from '@/lib/logger';
import type { EmailOtpType } from '@supabase/supabase-js';

const log = createLogger('auth');

/**
 * GET /auth/confirm
 *
 * Handles email confirmation links from Supabase.
 * Supabase email templates should use:
 *   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email
 *
 * This avoids the PKCE code-verifier-cookie dependency and hash-fragment
 * issues that break the /auth/callback flow for email signups.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const next = searchParams.get('next') ?? '/discover';

  log.info('Email confirm request', { hasTokenHash: !!token_hash, type });

  if (token_hash && type) {
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

    const { data, error } = await supabase.auth.verifyOtp({ token_hash, type });

    if (error) {
      log.error('Email verification failed', { message: error.message });
      const response = NextResponse.redirect(`${origin}/discover`);
      return response;
    }

    if (data?.user) {
      log.success('Email verified', { email: data.user.email, userId: data.user.id.slice(0, 8) });

      const admin = createAdminClient();
      const { data: profile } = await admin
        .from('user_profiles')
        .select('onboarding_completed')
        .eq('id', data.user.id)
        .single();

      const shouldOnboard = !profile || !profile.onboarding_completed;
      const redirectUrl = shouldOnboard
        ? `${origin}/onboarding`
        : `${origin}${next}`;

      log.info('Redirecting after email confirm', { onboarding: shouldOnboard, redirectUrl });

      const response = NextResponse.redirect(redirectUrl);
      pendingCookies.forEach(({ name, value, options }) => {
        response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2]);
      });
      return response;
    }
  }

  log.warn('Email confirm called without valid params', {
    params: Object.fromEntries(searchParams.entries()),
  });
  return NextResponse.redirect(`${origin}/discover`);
}
