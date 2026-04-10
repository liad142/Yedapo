#!/usr/bin/env node
/**
 * (Re)register the Telegram bot webhook with the correct secret token.
 *
 * Fixes: "Wrong response from the webhook: 403 Forbidden" errors caused by
 * the webhook being set without a secret_token (or with a stale value), while
 * the handler at src/app/api/notifications/telegram/webhook/route.ts requires
 * the x-telegram-bot-api-secret-token header to match TELEGRAM_WEBHOOK_SECRET.
 *
 * Usage:
 *   node scripts/setup-telegram-webhook.mjs
 *
 * IMPORTANT: The TELEGRAM_WEBHOOK_SECRET in .env.local MUST match the value
 * configured in Vercel's production environment. If they differ, set one to
 * match the other before running this script.
 */
import { readFileSync } from 'node:fs';

const env = {};
for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
}

const token = env.TELEGRAM_BOT_TOKEN;
const secret = env.TELEGRAM_WEBHOOK_SECRET;
const prodUrl =
  env.TELEGRAM_WEBHOOK_URL || 'https://www.yedapo.com/api/notifications/telegram/webhook';

if (!token) {
  console.error('❌ TELEGRAM_BOT_TOKEN missing from .env.local');
  process.exit(1);
}
if (!secret) {
  console.error('❌ TELEGRAM_WEBHOOK_SECRET missing from .env.local');
  process.exit(1);
}

console.log(`Setting Telegram webhook → ${prodUrl}`);
console.log(`Secret token length: ${secret.length} chars`);

// 1. Delete existing webhook (drops pending updates cleanly)
const deleteRes = await fetch(
  `https://api.telegram.org/bot${token}/deleteWebhook?drop_pending_updates=true`
);
const deleteData = await deleteRes.json();
console.log('\n[1] deleteWebhook:', deleteData);

// 2. Set new webhook with secret_token
const setRes = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    url: prodUrl,
    secret_token: secret,
    allowed_updates: ['message'],
    drop_pending_updates: false,
  }),
});
const setData = await setRes.json();
console.log('\n[2] setWebhook:', setData);

// 3. Verify
const infoRes = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
const infoData = await infoRes.json();
console.log('\n[3] getWebhookInfo:', JSON.stringify(infoData, null, 2));

if (setData.ok && !infoData.result?.last_error_message) {
  console.log('\n✅ Webhook configured successfully.');
  console.log('   Next step: re-try Connect Telegram flow in the app. The bot should now');
  console.log('   respond to /start and the telegram_connections row should be created.');
} else if (infoData.result?.last_error_message) {
  console.log(`\n⚠️  Webhook set, but last_error_message still present: "${infoData.result.last_error_message}"`);
  console.log('   This means the TELEGRAM_WEBHOOK_SECRET in .env.local does not match');
  console.log('   production Vercel env vars. Fix: set both to the same value, redeploy, rerun.');
} else {
  console.log('\n❌ setWebhook failed:', setData);
}
