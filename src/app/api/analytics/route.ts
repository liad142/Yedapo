import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthUser } from '@/lib/auth-helpers';
import { createLogger } from '@/lib/logger';

const log = createLogger('analytics');

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { event, params } = body;

    if (!event || typeof event !== 'string') {
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
