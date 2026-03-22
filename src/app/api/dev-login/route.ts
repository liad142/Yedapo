import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';

export async function GET() {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not available' }, { status: 404 });
  }

  const email = process.env.DEV_LOGIN_EMAIL;
  const password = process.env.DEV_LOGIN_PASSWORD;

  if (!email || !password) {
    return NextResponse.json(
      { error: 'Set DEV_LOGIN_EMAIL and DEV_LOGIN_PASSWORD in .env.local' },
      { status: 500 }
    );
  }

  const response = NextResponse.redirect(new URL('/discover', 'http://localhost:3000'));

  // Use @supabase/ssr so cookies are set in exactly the format the middleware expects
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return [];
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }

  return response;
}
