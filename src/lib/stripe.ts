import 'server-only';
import Stripe from 'stripe';

let _stripe: Stripe | null = null;

/**
 * Lazily initialized Stripe client.
 * Deferred so that builds / static page collection don't fail when
 * STRIPE_SECRET_KEY is not yet in the environment.
 */
export function getStripe(): Stripe {
  if (_stripe) return _stripe;

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY environment variable is required');
  }

  _stripe = new Stripe(key, { typescript: true });
  return _stripe;
}

/**
 * Stripe price IDs for the Pro plan.
 * Set via environment variables in Vercel / .env.local.
 */
export const STRIPE_PRICES = {
  proMonthly: process.env.STRIPE_PRO_MONTHLY_PRICE_ID!,
  proYearly: process.env.STRIPE_PRO_YEARLY_PRICE_ID!,
};
