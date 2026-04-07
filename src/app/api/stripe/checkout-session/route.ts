import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth-helpers';
import { getStripe, STRIPE_PRICES } from '@/lib/stripe';
import { createLogger } from '@/lib/logger';

const log = createLogger('stripe');

export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { priceId } = (await request.json()) as { priceId?: string };

    const validPriceIds = new Set([STRIPE_PRICES.proMonthly, STRIPE_PRICES.proYearly]);
    if (!priceId || !validPriceIds.has(priceId)) {
      return NextResponse.json(
        { error: 'Invalid priceId. Must be a valid Pro plan price.' },
        { status: 400 },
      );
    }

    const origin = request.headers.get('origin') || 'https://yedapo.com';

    const session = await getStripe().checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/settings/billing?success=true`,
      cancel_url: `${origin}/pricing`,
      client_reference_id: user.id,
      customer_email: user.email,
      metadata: {
        supabase_user_id: user.id,
      },
    });

    log.info('Checkout session created', {
      userId: user.id.slice(0, 8),
      priceId,
      sessionId: session.id,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    log.error('Failed to create checkout session', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 },
    );
  }
}
