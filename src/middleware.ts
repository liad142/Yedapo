import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);

export async function middleware(request: NextRequest) {
  const { response, user } = await updateSession(request);

  // Server-side admin guard — reuses user from updateSession (no double getUser call)
  if (request.nextUrl.pathname.startsWith('/admin')) {
    if (!user || !user.email || !adminEmails.includes(user.email.toLowerCase())) {
      return NextResponse.redirect(new URL('/discover', request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico (favicon)
     * - public folder assets
     */
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
