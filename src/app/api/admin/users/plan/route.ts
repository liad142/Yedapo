import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { createAdminClient } from '@/lib/supabase/admin';
import { createLogger } from '@/lib/logger';

const log = createLogger('admin');

const VALID_PLANS = ['free', 'pro', 'power'] as const;

export async function PATCH(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await request.json();
  const { userId, plan } = body as { userId: string; plan: string };

  if (!userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 });
  }

  if (!plan || !VALID_PLANS.includes(plan as typeof VALID_PLANS[number])) {
    return NextResponse.json(
      { error: `Invalid plan. Must be one of: ${VALID_PLANS.join(', ')}` },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  const { data, error: dbError } = await admin
    .from('user_profiles')
    .update({ plan })
    .eq('id', userId)
    .select()
    .single();

  if (dbError) {
    log.error('Failed to update user plan', { userId, plan, message: dbError.message });
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  log.info('Updated user plan', { userId, plan });

  return NextResponse.json(data);
}
