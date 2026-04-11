#!/usr/bin/env node
/**
 * End-to-end test of the notification delivery pipeline.
 * Finds a RECENT episode (< 7 days old) with a ready summary across the user's
 * subscriptions, resets that sub's last_checked_at to be BEFORE the episode,
 * triggers the cron, and verifies notification_requests are created for
 * email + telegram. Then manually fires triggerPendingNotifications.
 *
 * Usage: node scripts/test-notification-delivery.mjs liad142@gmail.com
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
console.log(`\n=== NOTIFICATION DELIVERY E2E TEST for ${email} ===\n`);

// 1. Get all subscribed podcasts + their recent episodes with ready summaries
console.log('[1] Scanning subscribed podcasts for recent episodes with ready summaries...');
const { data: subs } = await supabase
  .from('podcast_subscriptions')
  .select('id, podcast_id, last_checked_at, notify_channels, podcasts(title)')
  .eq('user_id', userId)
  .eq('notify_enabled', true);

const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
const candidates = [];
for (const sub of subs || []) {
  const { data: eps } = await supabase
    .from('episodes')
    .select('id, title, published_at, summaries!inner(id, level, status)')
    .eq('podcast_id', sub.podcast_id)
    .eq('summaries.status', 'ready')
    .gte('published_at', thirtyDaysAgo)
    .order('published_at', { ascending: false })
    .limit(1);

  if (eps?.[0]) {
    candidates.push({
      sub,
      episode: eps[0],
      title: sub.podcasts?.title || sub.podcast_id,
    });
  }
}

if (candidates.length === 0) {
  console.error('No candidate episodes found');
  process.exit(1);
}

// Pick the candidate whose episode is most recent
candidates.sort((a, b) =>
  new Date(b.episode.published_at).getTime() - new Date(a.episode.published_at).getTime()
);
const { sub: targetSub, episode: targetEpisode, title: podcastTitle } = candidates[0];

console.log(`   ✓ found ${candidates.length} candidates. Picking most recent:`);
console.log(`   ✓ podcast: ${podcastTitle}`);
console.log(`   ✓ episode: "${targetEpisode.title.slice(0, 60)}"`);
console.log(`   ✓ published: ${targetEpisode.published_at}`);
console.log(`   ✓ episode id: ${targetEpisode.id}\n`);

// 2. Reset last_checked_at to 1 day BEFORE the episode published_at
const resetTo = new Date(
  new Date(targetEpisode.published_at).getTime() - 86400000
).toISOString();
console.log(`[2] Resetting last_checked_at on "${podcastTitle}" to ${resetTo} (1 day before episode)...`);
const { error: resetErr } = await supabase
  .from('podcast_subscriptions')
  .update({ last_checked_at: resetTo })
  .eq('id', targetSub.id);
if (resetErr) {
  console.error(`   ✗ reset failed: ${resetErr.message}`);
  process.exit(1);
}
console.log(`   ✓ done\n`);

// 3. Count existing notification_requests for this episode
const { data: beforeNrs } = await supabase
  .from('notification_requests')
  .select('id, channel')
  .eq('user_id', userId)
  .eq('episode_id', targetEpisode.id);
console.log(`[3] Existing notification_requests for this episode: ${beforeNrs?.length || 0}\n`);

// 4. Trigger the check-new-episodes cron
console.log('[4] Triggering check-new-episodes cron on local dev...');
const cronRes = await fetch(`${devUrl}/api/cron/check-new-episodes`, {
  headers: { Authorization: `Bearer ${cronSecret}` },
});
const cronJson = await cronRes.json();
console.log(`   podcasts: ${JSON.stringify(cronJson.podcasts)}`);
console.log(`   youtube:  ${JSON.stringify(cronJson.youtube)}`);
console.log();

// 5. Check notification_requests after
console.log('[5] Checking notification_requests for this episode after cron...');
const { data: afterNrs } = await supabase
  .from('notification_requests')
  .select('id, channel, status, recipient, source, created_at')
  .eq('user_id', userId)
  .eq('episode_id', targetEpisode.id);

const newNrs = (afterNrs || []).filter(
  (a) => !(beforeNrs || []).some((b) => b.id === a.id)
);
console.log(`   New notification_requests: ${newNrs.length}`);
for (const n of newNrs) {
  console.log(
    `     - ${n.channel}/${n.status}  source=${n.source}  to=${(n.recipient || '').slice(0, 30)}`
  );
}
console.log();

if (newNrs.length === 0) {
  console.log('⚠️  Cron did not create notification_requests for this episode.');
  console.log('   Possible reasons: MAX_SOURCES_PER_TICK=50 didn\'t include this sub,');
  console.log('   or the episode was skipped by an unexpected condition.');
  console.log('   Check dev server logs for details.');
  process.exit(0);
}

// 6. Fire triggerPendingNotifications for this episode via a debug endpoint
console.log('[6] Calling debug endpoint to trigger pending notifications...');
const trigRes = await fetch(
  `${devUrl}/api/debug/trigger-pending?episodeId=${targetEpisode.id}`,
  {
    method: 'POST',
    headers: { Authorization: `Bearer ${cronSecret}` },
  }
);
if (trigRes.status === 404) {
  console.log(`   ✗ /api/debug/trigger-pending doesn't exist yet — need to create it`);
  console.log(`   Run: create endpoint, re-run this script`);
  process.exit(1);
}
const trigText = await trigRes.text();
console.log(`   HTTP ${trigRes.status}: ${trigText}\n`);

// 7. Final state
console.log('[7] Final notification_requests state:');
const { data: finalNrs } = await supabase
  .from('notification_requests')
  .select('channel, status, sent_at, error_message, recipient')
  .eq('user_id', userId)
  .eq('episode_id', targetEpisode.id)
  .order('created_at', { ascending: false });
for (const n of finalNrs || []) {
  const tag = n.status === 'sent' ? '✅' : n.status === 'pending' ? '⏳' : '❌';
  console.log(
    `   ${tag} ${n.channel}  status=${n.status}  sent_at=${n.sent_at ? n.sent_at.slice(0, 19) : '(pending)'}  err=${n.error_message || '(none)'}`
  );
}
console.log('\n=== END ===\n');
