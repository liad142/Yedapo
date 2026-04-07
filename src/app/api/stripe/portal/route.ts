import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth-helpers';
import { getStripe } from '@/lib/stripe';
import { createAdminClient } from '@/lib/supabase/admin';
import { createLogger } from '@/lib/logger';

const log = createLogger('stripe');

export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Look up the user's Stripe customer ID from their profile
    const admin = createAdminClient();
    const { data: profile, error: profileError } = await admin
      .from('user_profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.stripe_customer_id) {
      log.warn('No Stripe customer ID found for user', {
        userId: user.id.slice(0, 8),
        error: profileError?.message,
      });
      return NextResponse.json(
        { error: 'No active subscription found. Please subscribe first.' },
        { status: 404 },
      );
    }

    const origin = request.headers.get('origin') || 'https://yedapo.com';

    const portalSession = await getStripe().billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${origin}/settings/billing`,
    });

    log.info('Billing portal session created', {
      userId: user.id.slice(0, 8),
      customerId: profile.stripe_customer_id,
    });

    return NextResponse.json({ url: portalSession.url });
  } catch (error) {
    log.error('Failed to create billing portal session', error);
    return NextResponse.json(
      { error: 'Failed to create billing portal session' },
      { status: 500 },
    );
  }
}
