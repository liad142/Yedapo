#!/usr/bin/env node
/**
 * Diagnostic: What URL is the Telegram bot webhook pointing to?
 * Also: Find stale telegram_connections rows that might conflict.
 *
 * Usage: node scripts/diag-telegram-webhook.mjs
 */
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = {};
for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
}

const token = env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error('Missing TELEGRAM_BOT_TOKEN');
  process.exit(1);
}

console.log('\n=== TELEGRAM BOT WEBHOOK DIAGNOSTIC ===\n');

// ── 1. Current webhook info ──────────────────────────────────────
console.log('[1] getWebhookInfo — where Telegram thinks it should POST updates');
const whRes = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
const whData = await whRes.json();
console.log(JSON.stringify(whData, null, 2));
console.log();

// ── 2. Bot identity ──────────────────────────────────────────────
console.log('[2] getMe — bot identity');
const meRes = await fetch(`https://api.telegram.org/bot${token}/getMe`);
const meData = await meRes.json();
console.log(JSON.stringify(meData, null, 2));
console.log();

// ── 3. If no webhook, getUpdates will show recent messages ──────
if (!whData?.result?.url) {
  console.log('[3] No webhook set — falling back to getUpdates for recent messages');
  const upRes = await fetch(`https://api.telegram.org/bot${token}/getUpdates?limit=10`);
  const upData = await upRes.json();
  console.log(JSON.stringify(upData, null, 2));
  console.log();
}

// ── 4. All rows in telegram_connections — look for chat_id conflicts ─
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

console.log('[4] All telegram_connections rows (to detect chat_id conflicts / stale rows)');
const { data: allConns, error } = await supabase
  .from('telegram_connections')
  .select('id, user_id, telegram_chat_id, telegram_username, connected_at')
  .order('connected_at', { ascending: false });
if (error) {
  console.log(`   query error: ${error.message}`);
} else {
  console.log(`   total rows: ${allConns.length}`);
  for (const c of allConns) {
    console.log(`   - user_id=${c.user_id.slice(0, 8)}  chat_id=${c.telegram_chat_id}  @${c.telegram_username || '(none)'}  ${c.connected_at}`);
  }
  const liadId = '08a78319-b817-489e-850d-7b0cde86b8fa';
  const liadRow = allConns.find((c) => c.user_id === liadId);
  if (liadRow) {
    console.log(`   ✅ liad142's row EXISTS: chat_id=${liadRow.telegram_chat_id}`);
  } else {
    console.log(`   ❌ liad142 (${liadId.slice(0, 8)}) has NO row`);
  }
}
console.log();

console.log('=== END ===\n');
