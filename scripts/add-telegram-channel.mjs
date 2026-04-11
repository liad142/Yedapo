#!/usr/bin/env node
/**
 * Adds 'telegram' to notify_channels on every subscription (podcast + YouTube)
 * for a given user. Skips subscriptions that already have telegram.
 *
 * Usage: node scripts/add-telegram-channel.mjs liad142@gmail.com
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
const { data: authUsers } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
const user = authUsers.users.find((u) => u.email === email);
if (!user) {
  console.error(`No auth user for ${email}`);
  process.exit(1);
}
const userId = user.id;
console.log(`\nAdding 'telegram' to notify_channels for ${email} (userId ${userId.slice(0, 8)})\n`);

// Podcast subscriptions
const { data: podSubs } = await supabase
  .from('podcast_subscriptions')
  .select('id, notify_channels, podcasts(title)')
  .eq('user_id', userId)
  .eq('notify_enabled', true);

let podUpdated = 0;
for (const sub of podSubs || []) {
  const channels = new Set(sub.notify_channels || ['in_app']);
  if (channels.has('telegram')) continue;
  channels.add('telegram');
  const { error } = await supabase
    .from('podcast_subscriptions')
    .update({ notify_channels: Array.from(channels) })
    .eq('id', sub.id);
  if (!error) {
    podUpdated++;
    console.log(`  ✓ podcast: ${sub.podcasts?.title || sub.id}`);
  } else {
    console.log(`  ✗ podcast ${sub.id}: ${error.message}`);
  }
}

// YouTube follows
const { data: ytFollows } = await supabase
  .from('youtube_channel_follows')
  .select('id, notify_channels, youtube_channels(channel_name)')
  .eq('user_id', userId)
  .eq('notify_enabled', true);

let ytUpdated = 0;
for (const follow of ytFollows || []) {
  const channels = new Set(follow.notify_channels || ['in_app']);
  if (channels.has('telegram')) continue;
  channels.add('telegram');
  const { error } = await supabase
    .from('youtube_channel_follows')
    .update({ notify_channels: Array.from(channels) })
    .eq('id', follow.id);
  if (!error) {
    ytUpdated++;
    console.log(`  ✓ youtube: ${follow.youtube_channels?.channel_name || follow.id}`);
  } else {
    console.log(`  ✗ youtube ${follow.id}: ${error.message}`);
  }
}

console.log(`\n✅ Done. Updated ${podUpdated} podcasts + ${ytUpdated} YouTube channels.`);
console.log(`   All subs now have notify_channels: [in_app, email, telegram]`);
