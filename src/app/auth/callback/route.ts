import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createAdminClient } from '@/lib/supabase/admin';
import { createLogger } from '@/lib/logger';

const log = createLogger('auth');

function sanitizeNext(next: string | null): string {
  if (!next) return '/discover';
  if (!next.startsWith('/') || next.startsWith('//')) return '/discover';
  return next;
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = sanitizeNext(searchParams.get('next'));

  if (code) {
    // Capture cookies Supabase wants to set so we can apply them to the redirect response.
    // Using next/headers cookieStore.set() doesn't transfer to NextResponse.redirect()
    // because they are separate response objects.
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

    log.info('Exchanging code for session...');
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    let redirectUrl = `${origin}/discover`;

    if (error) {
      log.error('Session exchange error', { message: error.message });
    }

    if (!error && data?.user) {
      log.success('User authenticated', { email: data.user.email, userId: data.user.id.slice(0, 8) });
      const admin = createAdminClient();

      // Store provider tokens for YouTube API access
      const providerToken = data.session?.provider_token;
      const providerRefreshToken = data.session?.provider_refresh_token;

      if (providerToken) {
        try {
          await admin
            .from('user_provider_tokens')
            .upsert(
              {
                user_id: data.user.id,
                provider: 'google',
                access_token: providerToken,
                refresh_token: providerRefreshToken || null,
                expires_at: new Date(Date.now() + 3600 * 1000).toISOString(), // ~1hr from now
                updated_at: new Date().toISOString(),
              },
              { onConflict: 'user_id,provider' }
            );
        } catch (err) {
          log.error('Failed to store provider tokens', err);
        }
      }

      const { data: profile } = await admin
        .from('user_profiles')
        .select('onboarding_completed')
        .eq('id', data.user.id)
        .single();

      const shouldOnboard = !profile || !profile.onboarding_completed;
      redirectUrl = shouldOnboard
        ? `${origin}/onboarding`
        : `${origin}${next}`;
      log.info('Redirecting', { onboarding: shouldOnboard ? 'needed' : 'done', redirectUrl });
    }

    const response = NextResponse.redirect(redirectUrl);

    // Apply session cookies directly onto the redirect response
    pendingCookies.forEach(({ name, value, options }) => {
      response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2]);
    });

    return response;
  }

  return NextResponse.redirect(`${origin}/discover`);
}
