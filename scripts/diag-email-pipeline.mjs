#!/usr/bin/env node
/**
 * Diagnose why subscription-triggered email notifications aren't firing for a user.
 * Usage: node scripts/diag-email-pipeline.mjs liad142@gmail.com
 */
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = {};
for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const email = process.argv[2] || 'liad142@gmail.com';
console.log(`\n=== EMAIL NOTIFICATION PIPELINE DIAGNOSTIC for ${email} ===\n`);

const { data: authUsers } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
const user = authUsers.users.find((u) => u.email === email);
if (!user) {
  console.error(`No auth user for ${email}`);
  process.exit(1);
}
const userId = user.id;
console.log(`userId: ${userId}\n`);

// CRITICAL: Does user_profiles have an email column, and is it set?
console.log('[1] user_profiles — does it have email column populated?');
try {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) {
    console.log(`   error: ${error.message}`);
  } else {
    const hasEmailCol = 'email' in data;
    console.log(`   'email' column exists in user_profiles? ${hasEmailCol}`);
    if (hasEmailCol) {
      console.log(`   value: ${data.email || '(NULL)'}`);
      if (!data.email) {
        console.log(`   🚨 PROBABLE CAUSE: user_profiles.email is NULL`);
        console.log(`   subscription-notifications.ts:461 queries this column to get the recipient.`);
        console.log(`   If NULL, the 'if (profile?.email)' check skips the insert silently.`);
      }
    } else {
      console.log(`   🚨 CRITICAL: user_profiles has NO email column!`);
      console.log(`   Code at subscription-notifications.ts:461 queries a column that doesn't exist,`);
      console.log(`   meaning every subscription-triggered email insert is skipped.`);
    }
    console.log(`\n   full row keys: ${Object.keys(data).join(', ')}`);
  }
} catch (e) {
  console.log(`   exception: ${e.message}`);
}
console.log();

// Check auth.users.email (authoritative)
console.log('[2] auth.users.email (authoritative email from Supabase Auth)');
console.log(`   ${user.email}\n`);

// Check podcast_subscriptions last_checked_at distribution
console.log('[3] podcast_subscriptions — are they being updated by the cron?');
const { data: subs } = await supabase
  .from('podcast_subscriptions')
  .select('podcast_id, last_checked_at, notify_enabled, notify_channels, created_at, podcasts(title)')
  .eq('user_id', userId)
  .order('last_checked_at', { ascending: false, nullsFirst: false });

if (subs && subs.length > 0) {
  console.log(`   ${subs.length} subscriptions. last_checked_at distribution:`);
  const now = Date.now();
  const buckets = { 'never': 0, '<1h': 0, '<24h': 0, '<7d': 0, '>7d': 0 };
  for (const s of subs) {
    if (!s.last_checked_at) buckets.never++;
    else {
      const age = now - new Date(s.last_checked_at).getTime();
      if (age < 3600000) buckets['<1h']++;
      else if (age < 86400000) buckets['<24h']++;
      else if (age < 7 * 86400000) buckets['<7d']++;
      else buckets['>7d']++;
    }
  }
  console.log(`   ${JSON.stringify(buckets)}`);
  console.log(`\n   5 most recent:`);
  for (const s of subs.slice(0, 5)) {
    const title = s.podcasts?.title || s.podcast_id;
    console.log(`      last_checked=${s.last_checked_at || '(never)'}  ${title.slice(0, 50)}`);
  }
}
console.log();

// Recent episodes published for user's subscribed podcasts
console.log('[4] Recent episodes for user subscribed podcasts (last 72h)');
const podcastIds = (subs || []).map((s) => s.podcast_id);
const since = new Date(Date.now() - 72 * 3600 * 1000).toISOString();
if (podcastIds.length > 0) {
  const { data: recentEps } = await supabase
    .from('episodes')
    .select('id, title, published_at, podcast_id, podcasts(title)')
    .in('podcast_id', podcastIds)
    .gt('published_at', since)
    .order('published_at', { ascending: false })
    .limit(20);
  console.log(`   ${recentEps?.length || 0} episodes published in last 72h across user's podcasts`);
  if (recentEps && recentEps.length > 0) {
    for (const e of recentEps.slice(0, 10)) {
      console.log(`      ${e.published_at.slice(0, 19)}  ${(e.podcasts?.title || '').slice(0, 25)}  ${(e.title || '').slice(0, 60)}`);
    }
  }
}
console.log();

// notification_requests status counts
console.log('[5] notification_requests — all history for this user');
const { data: nrs } = await supabase
  .from('notification_requests')
  .select('id, channel, status, source, scheduled, created_at, sent_at, error_message')
  .eq('user_id', userId)
  .order('created_at', { ascending: false });
console.log(`   total: ${nrs?.length || 0}`);
if (nrs) {
  const byStatusSource = nrs.reduce((acc, n) => {
    const k = `${n.channel}/${n.status}/${n.source || 'unknown'}`;
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});
  console.log(`   breakdown:`, byStatusSource);
}
console.log();

// Stripe customer check
console.log('[6] Stripe customer status');
try {
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('plan, stripe_customer_id')
    .eq('id', userId)
    .single();
  console.log(`   plan: ${profile?.plan}`);
  console.log(`   stripe_customer_id: ${profile?.stripe_customer_id || '(NULL)'}`);
  if (profile?.plan === 'pro' && !profile?.stripe_customer_id) {
    console.log(`   🚨 Plan is pro but no stripe_customer_id — billing portal will fail with "No customer".`);
  }
} catch (e) {
  console.log(`   error: ${e.message}`);
}
console.log();

console.log('=== END ===\n');
