#!/usr/bin/env node
/**
 * Reads the last Telegram webhook invocation trace from Upstash Redis.
 * Written to key `telegram:webhook:last-trace` by the webhook handler.
 *
 * Usage: node scripts/read-telegram-trace.mjs
 */
import { readFileSync } from 'node:fs';
import { Redis } from '@upstash/redis';

const env = {};
for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
}

const url = env.UPSTASH_REDIS_REST_URL;
const token = env.UPSTASH_REDIS_REST_TOKEN;
if (!url || !token) {
  console.error('Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN in .env.local');
  process.exit(1);
}

const redis = new Redis({ url, token });
const trace = await redis.get('telegram:webhook:last-trace');

if (!trace) {
  console.log('No trace found. The webhook hasn\'t recorded anything yet.');
  console.log('Steps to trigger one:');
  console.log('  1. Make sure the new code is deployed to production');
  console.log('  2. In the app: Settings → Connections → Telegram → Connect');
  console.log('  3. Press Start in the Telegram bot');
  console.log('  4. Re-run this script');
  process.exit(0);
}

console.log('\n=== LAST TELEGRAM WEBHOOK TRACE ===\n');
console.log(JSON.stringify(trace, null, 2));
console.log();

// Diagnostic summary
const t = trace;
console.log('--- Interpretation ---');
if (!t.secretOk) console.log('❌ Secret check FAILED — env var mismatch');
else if (!t.hasStartPrefix) console.log(`ℹ️ Message was not a /start command: "${t.messageText}"`);
else if (t.silentSkipReason === 'empty_token') console.log('⚠️ User sent bare /start (no payload). They need to use the Connect link from the app.');
else if (t.silentSkipReason === 'token_not_in_redis_or_expired') console.log('⚠️ Token missing from Redis — either expired (30 min TTL) or the Connect flow used a different Redis instance');
else if (t.upsertError) console.log(`❌ DB error: ${t.upsertError}`);
else if (t.finalStatus === 'ok') {
  console.log('✅ SUCCESS — connection saved');
  if (t.deletedStaleRow) console.log('   (transferred ownership from a prior account)');
  if (t.welcomeSent) console.log('   welcome message sent to user');
  else if (t.welcomeError) console.log(`   ⚠️ welcome message failed: ${t.welcomeError}`);
} else {
  console.log(`final status: ${t.finalStatus}`);
}
