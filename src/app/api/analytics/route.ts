import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthUser } from '@/lib/auth-helpers';
import { checkRateLimit } from '@/lib/cache';
import { createLogger } from '@/lib/logger';

const log = createLogger('analytics');

export async function POST(req: NextRequest) {
  try {
    // Rate limit: 60/min per IP
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const rlAllowed = await checkRateLimit(`analytics:${ip}`, 60, 60);
    if (!rlAllowed) {
      return new NextResponse(null, { status: 429 });
    }

    const body = await req.json();
    const { event, params } = body;

    if (!event || typeof event !== 'string') {
      return new NextResponse(null, { status: 400 });
    }

    if (event.length > 100) {
      return new NextResponse(null, { status: 400 });
    }

    if (params && JSON.stringify(params).length > 10240) {
      return new NextResponse(null, { status: 400 });
    }

    const user = await getAuthUser();
    const supabase = createAdminClient();

    const { error } = await supabase.from('analytics_events').insert({
      event,
      user_id: user?.id || null,
      params: params || {},
    });

    if (error) {
      log.error('Failed to insert analytics event', error);
      return new NextResponse(null, { status: 500 });
    }

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    log.error('Analytics route error', err);
    return new NextResponse(null, { status: 500 });
  }
}
