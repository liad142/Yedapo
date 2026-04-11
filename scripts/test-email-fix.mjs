#!/usr/bin/env node
/**
 * Verifies the subscription-notifications.ts email bug fix:
 * Picks an episode that has a ready summary AND has NO existing
 * notification_request for this user/channel (so dedupe doesn't skip it),
 * then triggers cron + trigger-pending and confirms email/telegram both send.
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
const cronSecret = env.CRON_SECRET;
const devUrl = 'http://localhost:3000';

const { data: authUsers } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
const user = authUsers.users.find((u) => u.email === email);
if (!user) {
  console.error(`No auth user for ${email}`);
  process.exit(1);
}
const userId = user.id;
console.log(`\n=== EMAIL FIX VERIFICATION for ${email} ===\n`);

// Find candidate episodes
const { data: subs } = await supabase
  .from('podcast_subscriptions')
  .select('id, podcast_id, last_checked_at, podcasts(title)')
  .eq('user_id', userId)
  .eq('notify_enabled', true);

const sixtyDaysAgo = new Date(Date.now() - 60 * 86400000).toISOString();
const candidates = [];
for (const sub of subs || []) {
  const { data: eps } = await supabase
    .from('episodes')
    .select('id, title, published_at, summaries!inner(id, level, status)')
    .eq('podcast_id', sub.podcast_id)
    .eq('summaries.status', 'ready')
    .gte('published_at', sixtyDaysAgo)
    .order('published_at', { ascending: false })
    .limit(5);
  for (const ep of eps || []) {
    candidates.push({ sub, ep, podcastTitle: sub.podcasts?.title || sub.podcast_id });
  }
}

// Find a candidate with NO existing notification_request rows
let chosen = null;
for (const c of candidates) {
  const { data: existing } = await supabase
    .from('notification_requests')
    .select('id')
    .eq('user_id', userId)
    .eq('episode_id', c.ep.id);
  if (!existing?.length) {
    chosen = c;
    break;
  }
}

if (!chosen) {
  console.log('⚠️  All candidate episodes already have notification_requests rows.');
  console.log('    Can\'t test a "fresh" email insert without dedupe collision.');
  console.log('    Falling back: deleting existing rows on the newest candidate to force a fresh test.');
  chosen = candidates[0];
  const { error: delErr } = await supabase
    .from('notification_requests')
    .delete()
    .eq('user_id', userId)
    .eq('episode_id', chosen.ep.id);
  if (delErr) {
    console.error(`Failed to clear: ${delErr.message}`);
    process.exit(1);
  }
  console.log(`    deleted existing rows for episode ${chosen.ep.id}`);
}

console.log(`\n[1] Using episode: "${chosen.ep.title.slice(0, 60)}"`);
console.log(`    podcast: ${chosen.podcastTitle}`);
console.log(`    published: ${chosen.ep.published_at}`);
console.log(`    episode id: ${chosen.ep.id}\n`);

// Reset last_checked to 1 day before episode
const resetTo = new Date(
  new Date(chosen.ep.published_at).getTime() - 86400000
).toISOString();
console.log(`[2] Resetting last_checked_at to ${resetTo}...`);
await supabase
  .from('podcast_subscriptions')
  .update({ last_checked_at: resetTo })
  .eq('id', chosen.sub.id);
console.log(`    ✓ done\n`);

// Trigger cron
console.log('[3] Triggering cron...');
const cronRes = await fetch(`${devUrl}/api/cron/check-new-episodes`, {
  headers: { Authorization: `Bearer ${cronSecret}` },
});
const cronJson = await cronRes.json();
console.log(`    podcasts notifications: ${cronJson.podcasts?.notificationsCreated}`);
console.log();

// Check notification_requests after
console.log('[4] notification_requests after cron:');
const { data: afterCron } = await supabase
  .from('notification_requests')
  .select('id, channel, status, source, recipient, created_at')
  .eq('user_id', userId)
  .eq('episode_id', chosen.ep.id);
for (const n of afterCron || []) {
  console.log(`    - ${n.channel}/${n.status}  source=${n.source}  to=${(n.recipient || '').slice(0, 30)}`);
}
console.log();

// Trigger pending sends
console.log('[5] Triggering pending sends...');
const trigRes = await fetch(
  `${devUrl}/api/debug/trigger-pending?episodeId=${chosen.ep.id}`,
  { method: 'POST', headers: { Authorization: `Bearer ${cronSecret}` } }
);
console.log(`    HTTP ${trigRes.status}: ${await trigRes.text()}\n`);

// Final state
console.log('[6] FINAL notification_requests state:');
const { data: final } = await supabase
  .from('notification_requests')
  .select('channel, status, sent_at, error_message, recipient, source')
  .eq('user_id', userId)
  .eq('episode_id', chosen.ep.id);
for (const n of final || []) {
  const tag = n.status === 'sent' ? '✅' : n.status === 'pending' ? '⏳' : '❌';
  console.log(
    `    ${tag} ${n.channel}  status=${n.status}  source=${n.source}  sent_at=${n.sent_at?.slice(0, 19) || '(pending)'}  err=${n.error_message || '(none)'}`
  );
}
console.log('\n=== END ===\n');
