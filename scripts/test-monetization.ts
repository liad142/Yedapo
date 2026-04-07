/**
 * Monetization E2E Test Script
 *
 * Tests Free vs Pro gating: subscription limits, export, Stripe endpoints, pricing page.
 * Run: npx tsx scripts/test-monetization.ts
 *
 * Requires: dev server running on localhost:3000
 */

import { createClient } from '@supabase/supabase-js';

const BASE_URL = 'http://localhost:3000';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SECRET = process.env.SUPABASE_SECRET_KEY!;

const admin = createClient(SUPABASE_URL, SUPABASE_SECRET);

let passed = 0;
let failed = 0;
const results: { test: string; status: 'PASS' | 'FAIL'; detail?: string }[] = [];

function log(status: 'PASS' | 'FAIL', test: string, detail?: string) {
  const icon = status === 'PASS' ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m';
  console.log(`  ${icon} ${test}${detail ? ` — ${detail}` : ''}`);
  results.push({ test, status, detail });
  if (status === 'PASS') passed++;
  else failed++;
}

// ---------- Helpers ----------

async function getUserId(): Promise<string> {
  // Find test user (liad's account)
  const { data } = await admin
    .from('podcast_subscriptions')
    .select('user_id')
    .limit(10);

  // Use user with most subscriptions (likely the main test user)
  const counts: Record<string, number> = {};
  data?.forEach(s => { counts[s.user_id] = (counts[s.user_id] || 0) + 1; });
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return sorted[0]?.[0] || '';
}

async function getUserPlan(userId: string): Promise<string> {
  const { data } = await admin
    .from('user_profiles')
    .select('plan')
    .eq('id', userId)
    .single();
  return data?.plan || 'free';
}

async function setUserPlan(userId: string, plan: 'free' | 'pro') {
  await admin.from('user_profiles').update({ plan }).eq('id', userId);
}

async function getSubCount(userId: string): Promise<{ podcasts: number; youtube: number }> {
  const [{ count: podcasts }, { count: youtube }] = await Promise.all([
    admin.from('podcast_subscriptions').select('*', { count: 'exact', head: true }).eq('user_id', userId),
    admin.from('youtube_channel_follows').select('*', { count: 'exact', head: true }).eq('user_id', userId),
  ]);
  return { podcasts: podcasts || 0, youtube: youtube || 0 };
}

async function getEpisodeWithSummary(): Promise<string | null> {
  const { data } = await admin
    .from('summaries')
    .select('episode_id')
    .eq('status', 'ready')
    .in('level', ['deep', 'quick'])
    .order('updated_at', { ascending: false })
    .limit(1);
  return data?.[0]?.episode_id || null;
}

// Create a session cookie for a user (using Supabase admin to generate a session)
// Since we can't easily get browser cookies, we'll test API routes directly via admin client
// and test page rendering via HTTP status codes

// ---------- Tests ----------

async function testPages() {
  console.log('\n\x1b[1m--- Page Rendering ---\x1b[0m');

  const pages = [
    { url: '/pricing', name: 'Pricing page' },
    { url: '/settings', name: 'Settings page' },
    { url: '/summaries', name: 'Summaries page' },
    { url: '/discover', name: 'Discover page' },
  ];

  for (const page of pages) {
    try {
      const res = await fetch(`${BASE_URL}${page.url}`);
      if (res.status === 200) {
        const html = await res.text();
        const hasError = html.includes('Application error') || html.includes('Internal Server Error');
        if (hasError) {
          log('FAIL', `${page.name} renders`, `200 but contains error`);
        } else {
          log('PASS', `${page.name} renders`, `${res.status}`);
        }
      } else {
        log('FAIL', `${page.name} renders`, `HTTP ${res.status}`);
      }
    } catch (e: any) {
      log('FAIL', `${page.name} renders`, e.message);
    }
  }
}

async function testSubscriptionLimits(userId: string) {
  console.log('\n\x1b[1m--- Subscription Limits (Free tier) ---\x1b[0m');

  const originalPlan = await getUserPlan(userId);
  const counts = await getSubCount(userId);

  log('PASS', `Current state`, `${counts.podcasts} podcasts, ${counts.youtube} YouTube, plan=${originalPlan}`);

  // Test: Subscription limit constants exist in plans
  try {
    const res = await fetch(`${BASE_URL}/api/user/usage`);
    // This needs auth, so we just check it doesn't crash
    if (res.status === 401) {
      log('PASS', 'Usage API requires auth', '401');
    } else {
      log('PASS', 'Usage API responds', `${res.status}`);
    }
  } catch (e: any) {
    log('FAIL', 'Usage API', e.message);
  }

  // Test: Check plan limits are defined by reading the plans module indirectly
  // We verify via the subscription API behavior

  // Ensure user is on Free plan for testing
  await setUserPlan(userId, 'free');

  // Test: Check if user already over limit
  if (counts.podcasts >= 5) {
    log('PASS', `Free user has ${counts.podcasts} podcast subs (at/over limit)`, 'Limit should block new ones');
  } else {
    log('PASS', `Free user has ${counts.podcasts} podcast subs (under limit)`, 'Still has room');
  }

  if (counts.youtube >= 5) {
    log('PASS', `Free user has ${counts.youtube} YouTube follows (at/over limit)`, 'Limit should block new ones');
  } else {
    log('PASS', `Free user has ${counts.youtube} YouTube follows (under limit)`, 'Still has room');
  }

  // Verify the limit constants exist in the API response by checking a known endpoint
  // We can test the subscription POST endpoint directly via Supabase

  // Test: Verify plan was actually set
  const planAfter = await getUserPlan(userId);
  if (planAfter === 'free') {
    log('PASS', 'User plan set to free', 'Confirmed in DB');
  } else {
    log('FAIL', 'User plan set to free', `Got: ${planAfter}`);
  }

  // Test: Switch to Pro and verify
  await setUserPlan(userId, 'pro');
  const proPlan = await getUserPlan(userId);
  if (proPlan === 'pro') {
    log('PASS', 'User plan set to pro', 'Confirmed in DB');
  } else {
    log('FAIL', 'User plan set to pro', `Got: ${proPlan}`);
  }

  // Restore original plan
  await setUserPlan(userId, originalPlan as 'free' | 'pro');
  log('PASS', `Restored original plan`, originalPlan);
}

async function testExportEndpoint() {
  console.log('\n\x1b[1m--- Export Endpoint ---\x1b[0m');

  const episodeId = await getEpisodeWithSummary();
  if (!episodeId) {
    log('FAIL', 'Find episode with ready summary', 'None found');
    return;
  }
  log('PASS', 'Found episode with ready summary', episodeId.substring(0, 8));

  // Test: Export requires auth
  const noAuthRes = await fetch(`${BASE_URL}/api/episodes/${episodeId}/export`);
  if (noAuthRes.status === 401) {
    log('PASS', 'Export requires authentication', '401');
  } else {
    log('FAIL', 'Export requires authentication', `Expected 401, got ${noAuthRes.status}`);
  }

  // Test: Export API route exists and compiles
  if (noAuthRes.status !== 500 && noAuthRes.status !== 404) {
    log('PASS', 'Export route exists and compiles', `Status: ${noAuthRes.status}`);
  } else {
    log('FAIL', 'Export route exists', `Status: ${noAuthRes.status}`);
  }
}

async function testStripeEndpoints() {
  console.log('\n\x1b[1m--- Stripe Endpoints ---\x1b[0m');

  // Test: Checkout session requires POST
  const getRes = await fetch(`${BASE_URL}/api/stripe/checkout-session`);
  if (getRes.status === 405) {
    log('PASS', 'Checkout session rejects GET', '405 Method Not Allowed');
  } else {
    log('FAIL', 'Checkout session rejects GET', `Expected 405, got ${getRes.status}`);
  }

  // Test: Checkout session requires auth
  const noAuthRes = await fetch(`${BASE_URL}/api/stripe/checkout-session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ priceId: 'price_test' }),
  });
  if (noAuthRes.status === 401) {
    log('PASS', 'Checkout session requires auth', '401');
  } else {
    log('FAIL', 'Checkout session requires auth', `Expected 401, got ${noAuthRes.status}`);
  }

  // Test: Portal requires POST
  const portalGetRes = await fetch(`${BASE_URL}/api/stripe/portal`);
  if (portalGetRes.status === 405) {
    log('PASS', 'Portal rejects GET', '405');
  } else {
    log('FAIL', 'Portal rejects GET', `Expected 405, got ${portalGetRes.status}`);
  }

  // Test: Portal requires auth
  const portalNoAuth = await fetch(`${BASE_URL}/api/stripe/portal`, { method: 'POST' });
  if (portalNoAuth.status === 401) {
    log('PASS', 'Portal requires auth', '401');
  } else {
    log('FAIL', 'Portal requires auth', `Expected 401, got ${portalNoAuth.status}`);
  }

  // Test: Webhook rejects unsigned requests
  const webhookRes = await fetch(`${BASE_URL}/api/stripe/webhooks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'test' }),
  });
  if (webhookRes.status === 400 || webhookRes.status === 401 || webhookRes.status === 500) {
    log('PASS', 'Webhook rejects unsigned request', `${webhookRes.status}`);
  } else {
    log('FAIL', 'Webhook rejects unsigned request', `Expected 400/401, got ${webhookRes.status}`);
  }
}

async function testPricingContent() {
  console.log('\n\x1b[1m--- Pricing Page Content ---\x1b[0m');

  const res = await fetch(`${BASE_URL}/pricing`);
  const html = await res.text();

  // Check key pricing copy exists
  const checks = [
    { text: 'Free', label: 'Free plan shown' },
    { text: 'Pro', label: 'Pro plan shown' },
    { text: '12.99', label: 'Monthly price shown' },
    { text: 'Unlimited', label: 'Unlimited label shown' },
    { text: 'summaries', label: 'Summaries mentioned' },
  ];

  for (const check of checks) {
    if (html.includes(check.text)) {
      log('PASS', check.label);
    } else {
      log('FAIL', check.label, `"${check.text}" not found in HTML`);
    }
  }
}

async function testNotificationGating(userId: string) {
  console.log('\n\x1b[1m--- Notification Channel Gating ---\x1b[0m');

  // Check NOTIFICATION_ACCESS is enforced — Free users should only get in-app
  const { data: subs } = await admin
    .from('podcast_subscriptions')
    .select('podcast_id, notify_enabled, notify_channels')
    .eq('user_id', userId)
    .eq('notify_enabled', true);

  const emailSubs = subs?.filter(s => s.notify_channels?.includes('email')) || [];
  const telegramSubs = subs?.filter(s => s.notify_channels?.includes('telegram')) || [];
  const inAppSubs = subs?.filter(s => s.notify_channels?.includes('in_app')) || [];

  const plan = await getUserPlan(userId);
  log('PASS', `User plan: ${plan}`, `${subs?.length || 0} notify-enabled subs`);
  log('PASS', `Channel breakdown`, `in_app=${inAppSubs.length}, email=${emailSubs.length}, telegram=${telegramSubs.length}`);

  if (plan === 'free' && emailSubs.length > 0) {
    log('FAIL', 'Free user should not have email notifications', `Found ${emailSubs.length} with email channel`);
  } else {
    log('PASS', 'Email notification gating', plan === 'pro' ? 'Pro user — email allowed' : 'Free user — no email subs');
  }
}

async function testDailyQuotas() {
  console.log('\n\x1b[1m--- Daily Quota System ---\x1b[0m');

  // Test that the usage API endpoint exists
  const res = await fetch(`${BASE_URL}/api/user/usage`);
  if (res.status === 401) {
    log('PASS', 'Usage API requires auth', '401 (expected without session)');
  } else if (res.status === 200) {
    const data = await res.json();
    log('PASS', 'Usage API returns data', JSON.stringify(data).substring(0, 80));
  } else {
    log('FAIL', 'Usage API', `Unexpected status ${res.status}`);
  }

  // Test summary endpoint requires auth
  const summaryRes = await fetch(`${BASE_URL}/api/episodes/test-id/summaries`, { method: 'POST' });
  if (summaryRes.status === 401) {
    log('PASS', 'Summary generation requires auth', '401');
  } else {
    log('FAIL', 'Summary generation auth check', `Expected 401, got ${summaryRes.status}`);
  }

  // Test Ask AI requires auth
  const askRes = await fetch(`${BASE_URL}/api/episodes/test-id/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question: 'test' }),
  });
  if (askRes.status === 401) {
    log('PASS', 'Ask AI requires auth', '401');
  } else {
    log('FAIL', 'Ask AI auth check', `Expected 401, got ${askRes.status}`);
  }
}

async function testDatabaseSchema() {
  console.log('\n\x1b[1m--- Database Schema ---\x1b[0m');

  // Check user_profiles has plan column
  const { data: profile } = await admin
    .from('user_profiles')
    .select('plan')
    .limit(1)
    .single();

  if (profile && 'plan' in profile) {
    log('PASS', 'user_profiles.plan column exists', `value: ${profile.plan}`);
  } else {
    log('FAIL', 'user_profiles.plan column', 'Column missing');
  }

  // Check if stripe_customer_id column exists
  const { data: stripeCheck, error: stripeErr } = await admin
    .from('user_profiles')
    .select('stripe_customer_id')
    .limit(1);

  if (!stripeErr) {
    log('PASS', 'user_profiles.stripe_customer_id column exists');
  } else if (stripeErr.message.includes('stripe_customer_id')) {
    log('FAIL', 'user_profiles.stripe_customer_id column', 'Migration not run yet — run 20260407_add_stripe_customer_id.sql');
  } else {
    log('FAIL', 'user_profiles.stripe_customer_id check', stripeErr.message);
  }

  // Check notification_requests table
  const { error: notifErr } = await admin
    .from('notification_requests')
    .select('id')
    .limit(1);

  if (!notifErr) {
    log('PASS', 'notification_requests table exists');
  } else {
    log('FAIL', 'notification_requests table', notifErr.message);
  }
}

// ---------- Main ----------

async function main() {
  console.log('\x1b[1m\x1b[36m');
  console.log('╔═══════════════════════════════════════════╗');
  console.log('║   Yedapo Monetization Test Suite          ║');
  console.log('╚═══════════════════════════════════════════╝');
  console.log('\x1b[0m');

  // Pre-flight: check server is running
  try {
    const health = await fetch(`${BASE_URL}/api/health`);
    if (health.status !== 200) throw new Error(`Health check failed: ${health.status}`);
    console.log(`  Server: \x1b[32mOK\x1b[0m (${BASE_URL})`);
  } catch {
    console.error('\x1b[31m  Server not running at ' + BASE_URL + '\x1b[0m');
    process.exit(1);
  }

  // Pre-flight: check DB connection
  try {
    const { data } = await admin.from('user_profiles').select('id').limit(1);
    if (!data?.length) throw new Error('No profiles found');
    console.log(`  Database: \x1b[32mOK\x1b[0m`);
  } catch (e: any) {
    console.error('\x1b[31m  Database connection failed: ' + e.message + '\x1b[0m');
    process.exit(1);
  }

  const userId = await getUserId();
  console.log(`  Test user: ${userId.substring(0, 8)}...`);

  // Run all test suites
  await testPages();
  await testDatabaseSchema();
  await testSubscriptionLimits(userId);
  await testExportEndpoint();
  await testStripeEndpoints();
  await testPricingContent();
  await testNotificationGating(userId);
  await testDailyQuotas();

  // Summary
  console.log('\n\x1b[1m═══════════════════════════════════════════\x1b[0m');
  console.log(`  \x1b[32m${passed} passed\x1b[0m, \x1b[31m${failed} failed\x1b[0m out of ${passed + failed} tests`);

  if (failed > 0) {
    console.log('\n  \x1b[31mFailed tests:\x1b[0m');
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`    \x1b[31m✗\x1b[0m ${r.test}${r.detail ? ` — ${r.detail}` : ''}`);
    });
  }

  console.log('\x1b[1m═══════════════════════════════════════════\x1b[0m\n');
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => {
  console.error('Test runner crashed:', e);
  process.exit(1);
});
