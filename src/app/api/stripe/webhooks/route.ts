import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getStripe } from '@/lib/stripe';
import { createAdminClient } from '@/lib/supabase/admin';
import { createLogger } from '@/lib/logger';

export const runtime = 'nodejs';

const log = createLogger('stripe');

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

/**
 * Stripe sends webhook events as raw body with a signature header.
 * We must read the raw body (not parsed JSON) to verify the signature.
 */
export async function POST(request: NextRequest) {
  if (!WEBHOOK_SECRET) {
    log.error('STRIPE_WEBHOOK_SECRET is not configured');
    return NextResponse.json(
      { error: 'Webhook secret not configured' },
      { status: 500 },
    );
  }

  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json(
      { error: 'Missing stripe-signature header' },
      { status: 400 },
    );
  }

  let event: Stripe.Event;

  try {
    const rawBody = await request.text();
    event = getStripe().webhooks.constructEvent(rawBody, signature, WEBHOOK_SECRET);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error('Webhook signature verification failed', { error: message });
    return NextResponse.json(
      { error: `Webhook signature verification failed: ${message}` },
      { status: 400 },
    );
  }

  log.info('Webhook received', { type: event.type, id: event.id });

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case 'invoice.payment_failed':
        handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      default:
        log.info('Unhandled webhook event type', { type: event.type });
    }
  } catch (error) {
    log.error('Webhook handler failed', { type: event.type, error: String(error) });
    // Return 200 so Stripe doesn't retry — we logged the failure for investigation
    return NextResponse.json({ received: true, error: 'Handler failed' });
  }

  return NextResponse.json({ received: true });
}

// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = session.client_reference_id || session.metadata?.supabase_user_id;

  if (!userId) {
    log.error('checkout.session.completed missing user ID', {
      sessionId: session.id,
    });
    return;
  }

  const customerId =
    typeof session.customer === 'string'
      ? session.customer
      : session.customer?.id;

  const admin = createAdminClient();

  const updatePayload: Record<string, string> = { plan: 'pro' };
  if (customerId) {
    updatePayload.stripe_customer_id = customerId;
  }

  const { error } = await admin
    .from('user_profiles')
    .update(updatePayload)
    .eq('id', userId);

  if (error) {
    log.error('Failed to upgrade user to pro', {
      userId: userId.slice(0, 8),
      error: error.message,
    });
    throw error;
  }

  log.success('User upgraded to Pro', {
    userId: userId.slice(0, 8),
    customerId: customerId ?? 'unknown',
    sessionId: session.id,
  });
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const customerId =
    typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer?.id;

  if (!customerId) {
    log.error('customer.subscription.deleted missing customer ID', {
      subscriptionId: subscription.id,
    });
    return;
  }

  const admin = createAdminClient();

  // Look up user by stripe_customer_id
  const { data: profile, error: lookupError } = await admin
    .from('user_profiles')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single();

  if (lookupError || !profile) {
    log.error('Could not find user for Stripe customer', {
      customerId,
      error: lookupError?.message,
    });
    return;
  }

  const { error } = await admin
    .from('user_profiles')
    .update({ plan: 'free' })
    .eq('id', profile.id);

  if (error) {
    log.error('Failed to downgrade user to free', {
      userId: profile.id.slice(0, 8),
      error: error.message,
    });
    throw error;
  }

  log.success('User downgraded to Free (subscription deleted)', {
    userId: profile.id.slice(0, 8),
    customerId,
    subscriptionId: subscription.id,
  });
}

function handlePaymentFailed(invoice: Stripe.Invoice) {
  const customerId =
    typeof invoice.customer === 'string'
      ? invoice.customer
      : invoice.customer?.id;

  log.warn('Invoice payment failed', {
    invoiceId: invoice.id,
    customerId: customerId ?? 'unknown',
    attemptCount: invoice.attempt_count,
    amountDue: invoice.amount_due,
  });

  // For now, just log. Stripe's built-in dunning will retry.
  // Future: send in-app notification, email warning, etc.
}
