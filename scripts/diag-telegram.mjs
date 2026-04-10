#!/usr/bin/env node
/**
 * Diagnostic: Why isn't user X receiving Telegram notifications?
 * Usage: node scripts/diag-telegram.mjs liad142@gmail.com
 *
 * One-off debug tool — safe to delete after use.
 */
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

// ── Load .env.local (no dotenv dep needed) ───────────────────────
const env = {};
for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
}

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SECRET_KEY;
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const email = process.argv[2] || 'liad142@gmail.com';
console.log(`\n=== TELEGRAM NOTIFICATION DIAGNOSTIC ===`);
console.log(`Target user: ${email}\n`);

// ── 1. Resolve user by email ─────────────────────────────────────
const { data: authUsers, error: authErr } = await supabase.auth.admin.listUsers({
  page: 1,
  perPage: 1000,
});
if (authErr) {
  console.error('auth listUsers error:', authErr);
  process.exit(1);
}
const user = authUsers.users.find((u) => u.email === email);
if (!user) {
  console.error(`❌ No auth.users row for ${email}`);
  process.exit(1);
}
console.log(`✅ [1] Auth user found`);
console.log(`   userId: ${user.id}`);
console.log(`   provider: ${user.app_metadata?.provider || 'email'}`);
console.log(`   created: ${user.created_at}\n`);

const userId = user.id;

// ── 2. user_profiles — plan, delivery prefs ──────────────────────
const { data: profile, error: pErr } = await supabase
  .from('user_profiles')
  .select('plan, notify_frequency, notify_digest_hour, notify_timezone, notify_daily_cap, display_name, onboarding_completed, stripe_customer_id')
  .eq('id', userId)
  .single();
if (pErr) {
  console.log(`❌ [2] user_profiles query failed: ${pErr.message}\n`);
} else {
  const planIssue = profile.plan !== 'pro' ? ' ⚠️ NOT PRO — telegram is Pro-only!' : '';
  const freqIssue = profile.notify_frequency === 'off' ? ' ⚠️ FREQUENCY IS OFF!' : '';
  console.log(`✅ [2] user_profiles`);
  console.log(`   plan: ${profile.plan}${planIssue}`);
  console.log(`   notify_frequency: ${profile.notify_frequency}${freqIssue}`);
  console.log(`   notify_digest_hour: ${profile.notify_digest_hour}`);
  console.log(`   notify_timezone: ${profile.notify_timezone}`);
  console.log(`   notify_daily_cap: ${profile.notify_daily_cap}`);
  console.log(`   stripe_customer_id: ${profile.stripe_customer_id || '(none)'}\n`);
}

// ── 3. telegram_connections — is Telegram actually connected? ────
const { data: tgConn, error: tgErr } = await supabase
  .from('telegram_connections')
  .select('telegram_chat_id, telegram_username, connected_at')
  .eq('user_id', userId)
  .maybeSingle();
if (tgErr) {
  console.log(`❌ [3] telegram_connections query failed: ${tgErr.message}\n`);
} else if (!tgConn) {
  console.log(`❌ [3] telegram_connections: NO ROW — user has NOT completed Telegram bot /start flow`);
  console.log(`      This is almost certainly the problem.\n`);
} else {
  console.log(`✅ [3] telegram_connections`);
  console.log(`   telegram_chat_id: ${tgConn.telegram_chat_id}`);
  console.log(`   telegram_username: ${tgConn.telegram_username || '(none)'}`);
  console.log(`   connected_at: ${tgConn.connected_at}\n`);
}

// ── 4. podcast_subscriptions — any with notify_enabled + telegram channel? ─
const { data: podSubs } = await supabase
  .from('podcast_subscriptions')
  .select('podcast_id, notify_enabled, notify_channels, last_checked_at, podcasts(title)')
  .eq('user_id', userId);
const podWithNotif = (podSubs || []).filter((s) => s.notify_enabled);
const podWithTelegram = podWithNotif.filter((s) => (s.notify_channels || []).includes('telegram'));
console.log(`[4] podcast_subscriptions: ${podSubs?.length || 0} total, ${podWithNotif.length} with notifications, ${podWithTelegram.length} with telegram channel`);
if (podWithTelegram.length === 0 && podWithNotif.length > 0) {
  console.log(`   ⚠️ Subscriptions exist but NONE have 'telegram' in notify_channels!`);
  console.log(`   Sample channels from enabled subs:`, podWithNotif.slice(0, 3).map((s) => s.notify_channels));
}
if (podWithTelegram.length > 0) {
  console.log(`   ✅ Telegram-enabled podcasts (first 5):`);
  for (const s of podWithTelegram.slice(0, 5)) {
    const title = s.podcasts?.title || s.podcast_id;
    console.log(`      - ${title}  channels=${JSON.stringify(s.notify_channels)}  last_checked=${s.last_checked_at || '(never)'}`);
  }
}
console.log();

// ── 5. youtube_channel_follows — same check ──────────────────────
const { data: ytFollows } = await supabase
  .from('youtube_channel_follows')
  .select('channel_id, notify_enabled, notify_channels, last_checked_at, youtube_channels(channel_name)')
  .eq('user_id', userId);
const ytWithNotif = (ytFollows || []).filter((s) => s.notify_enabled);
const ytWithTelegram = ytWithNotif.filter((s) => (s.notify_channels || []).includes('telegram'));
console.log(`[5] youtube_channel_follows: ${ytFollows?.length || 0} total, ${ytWithNotif.length} with notifications, ${ytWithTelegram.length} with telegram channel`);
if (ytWithTelegram.length > 0) {
  console.log(`   ✅ Telegram-enabled YT channels (first 5):`);
  for (const s of ytWithTelegram.slice(0, 5)) {
    const name = s.youtube_channels?.channel_name || s.channel_id;
    console.log(`      - ${name}  channels=${JSON.stringify(s.notify_channels)}  last_checked=${s.last_checked_at || '(never)'}`);
  }
}
console.log();

// ── 6. notification_requests — actual send history ──────────────
const { data: nrs } = await supabase
  .from('notification_requests')
  .select('id, channel, status, source, scheduled, next_retry_at, sent_at, error_message, retry_count, recipient, created_at, episode_id')
  .eq('user_id', userId)
  .order('created_at', { ascending: false })
  .limit(20);
console.log(`[6] notification_requests (last 20): ${nrs?.length || 0} rows`);
if (!nrs || nrs.length === 0) {
  console.log(`   ⚠️ ZERO notification_requests for this user — the pipeline has never created a notification.`);
  console.log(`   This means either (a) Telegram not connected, (b) no new episodes detected by cron,`);
  console.log(`   (c) subscriptions don't have telegram in notify_channels, or (d) plan isn't pro.`);
} else {
  const telegramNrs = nrs.filter((n) => n.channel === 'telegram');
  console.log(`   of which telegram: ${telegramNrs.length}`);
  const byStatus = nrs.reduce((acc, n) => {
    const k = `${n.channel}/${n.status}`;
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});
  console.log(`   breakdown:`, byStatus);
  console.log(`   recent 5:`);
  for (const n of nrs.slice(0, 5)) {
    console.log(`      ${n.created_at.slice(0, 19)}  ${n.channel}/${n.status}  source=${n.source}  sched=${n.scheduled}  err=${n.error_message || '(none)'}  to=${(n.recipient || '').slice(0, 20)}`);
  }
}
console.log();

// ── 7. recent summaries for user's subscribed episodes ──────────
console.log(`[7] recent 'ready' summaries in the system (any user) — is the pipeline producing anything?`);
const { data: recentSums } = await supabase
  .from('summaries')
  .select('episode_id, level, status, updated_at, episodes(title)')
  .eq('status', 'ready')
  .in('level', ['quick', 'deep'])
  .order('updated_at', { ascending: false })
  .limit(5);
if (recentSums && recentSums.length > 0) {
  for (const s of recentSums) {
    const title = s.episodes?.title || s.episode_id;
    console.log(`   - ${s.updated_at.slice(0, 19)}  ${s.level}  ${title.slice(0, 60)}`);
  }
} else {
  console.log(`   (no recent ready summaries)`);
}
console.log();

console.log(`=== END DIAGNOSTIC ===\n`);
