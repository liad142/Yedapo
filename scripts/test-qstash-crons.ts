/**
 * Test scripts for QStash cron endpoints.
 *
 * Run with: npx tsx scripts/test-qstash-crons.ts [test-name]
 *
 * Tests:
 *   all                    — Run all tests
 *   list-schedules         — List active QStash schedules
 *   test-local-get         — Test GET (Vercel cron auth) on localhost
 *   test-local-post-noauth — Test POST without signature (should 401)
 *   test-prod-get          — Test GET on production with CRON_SECRET
 *   trigger-summaries      — Fire a one-off QStash message to process-queued-summaries
 *   trigger-episodes       — Fire a one-off QStash message to check-new-episodes
 *   check-stuck            — Query DB for stuck summaries
 */

import { Client } from '@upstash/qstash';

const QSTASH_TOKEN = process.env.QSTASH_TOKEN!;
const CRON_SECRET = process.env.CRON_SECRET!;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.yedapo.com';
const LOCAL_URL = 'http://localhost:3000';

if (!QSTASH_TOKEN) {
  console.error('Missing QSTASH_TOKEN. Run: set -a && source .env.local && set +a');
  process.exit(1);
}

const client = new Client({ token: QSTASH_TOKEN });

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function ok(msg: string) { console.log(`  \x1b[32m✓\x1b[0m ${msg}`); }
function fail(msg: string) { console.log(`  \x1b[31m✗\x1b[0m ${msg}`); }
function info(msg: string) { console.log(`  \x1b[36mℹ\x1b[0m ${msg}`); }

async function fetchSafe(url: string, opts?: RequestInit): Promise<{ status: number; body: any }> {
  try {
    const res = await fetch(url, opts);
    const body = await res.json().catch(() => res.text());
    return { status: res.status, body };
  } catch (err: any) {
    return { status: 0, body: err.message };
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

async function listSchedules() {
  console.log('\n📋 QStash Schedules:');
  const all = await client.schedules.list();
  if (all.length === 0) {
    info('No schedules found');
    return;
  }
  for (const s of all) {
    info(`${s.cron.padEnd(15)} → ${s.destination}`);
    info(`  ID: ${s.scheduleId}`);
  }
}

async function testLocalGet() {
  console.log('\n🧪 Test: GET localhost with CRON_SECRET');
  if (!CRON_SECRET) {
    fail('Missing CRON_SECRET in env');
    return;
  }

  const { status, body } = await fetchSafe(`${LOCAL_URL}/api/cron/process-queued-summaries`, {
    headers: { Authorization: `Bearer ${CRON_SECRET}` },
  });

  if (status === 200) {
    ok(`Status ${status} — ${JSON.stringify(body)}`);
  } else if (status === 409) {
    ok(`Status ${status} — Already running (lock held, this is fine)`);
  } else if (status === 0) {
    fail(`Connection refused — is dev server running on ${LOCAL_URL}?`);
  } else {
    fail(`Status ${status} — ${JSON.stringify(body)}`);
  }
}

async function testLocalPostNoAuth() {
  console.log('\n🧪 Test: POST localhost without signature (should 401)');
  const { status, body } = await fetchSafe(`${LOCAL_URL}/api/cron/process-queued-summaries`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });

  if (status === 401) {
    ok(`Status 401 — Correctly rejected: ${JSON.stringify(body)}`);
  } else if (status === 0) {
    fail(`Connection refused — is dev server running on ${LOCAL_URL}?`);
  } else {
    fail(`Expected 401, got ${status} — ${JSON.stringify(body)}`);
  }
}

async function testProdGet() {
  console.log('\n🧪 Test: GET production with CRON_SECRET');
  if (!CRON_SECRET) {
    fail('Missing CRON_SECRET in env');
    return;
  }

  const { status, body } = await fetchSafe(`${APP_URL}/api/cron/process-queued-summaries`, {
    headers: { Authorization: `Bearer ${CRON_SECRET}` },
  });

  if (status === 200) {
    ok(`Status ${status} — ${JSON.stringify(body)}`);
  } else if (status === 409) {
    ok(`Status ${status} — Already running (lock held)`);
  } else {
    fail(`Status ${status} — ${JSON.stringify(body)}`);
  }
}

async function triggerSummaries() {
  console.log('\n🚀 Trigger: One-off QStash → process-queued-summaries');
  const res = await client.publishJSON({
    url: `${APP_URL}/api/cron/process-queued-summaries`,
    body: {},
  });
  ok(`Published! Message ID: ${res.messageId}`);
  info('Check QStash logs at https://console.upstash.com/qstash → Logs');
}

async function triggerEpisodes() {
  console.log('\n🚀 Trigger: One-off QStash → check-new-episodes');
  const res = await client.publishJSON({
    url: `${APP_URL}/api/cron/check-new-episodes`,
    body: {},
  });
  ok(`Published! Message ID: ${res.messageId}`);
  info('Check QStash logs at https://console.upstash.com/qstash → Logs');
}

async function checkStuck() {
  console.log('\n🔍 Check: Stuck summaries in DB');
  // This calls the cron endpoint via GET to check for stuck summaries
  if (!CRON_SECRET) {
    fail('Missing CRON_SECRET');
    return;
  }

  const { status, body } = await fetchSafe(`${APP_URL}/api/cron/process-queued-summaries`, {
    headers: { Authorization: `Bearer ${CRON_SECRET}` },
  });

  if (status === 200) {
    const data = typeof body === 'string' ? JSON.parse(body) : body;
    if (data.processed > 0) {
      info(`Found and re-triggered ${data.processed} stuck summaries`);
    } else {
      ok('No stuck summaries found');
    }
  } else {
    fail(`Status ${status} — ${JSON.stringify(body)}`);
  }
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

const TESTS: Record<string, () => Promise<void>> = {
  'list-schedules': listSchedules,
  'test-local-get': testLocalGet,
  'test-local-post-noauth': testLocalPostNoAuth,
  'test-prod-get': testProdGet,
  'trigger-summaries': triggerSummaries,
  'trigger-episodes': triggerEpisodes,
  'check-stuck': checkStuck,
};

async function runAll() {
  await listSchedules();
  await testLocalGet();
  await testLocalPostNoAuth();
  // Skip prod tests in "all" to avoid unintended triggers
  console.log('\n⏩ Skipping prod tests in "all" mode. Run individually:');
  info('npx tsx scripts/test-qstash-crons.ts test-prod-get');
  info('npx tsx scripts/test-qstash-crons.ts trigger-summaries');
  info('npx tsx scripts/test-qstash-crons.ts trigger-episodes');
}

async function main() {
  const testName = process.argv[2] || 'all';
  console.log(`\n🔧 QStash Cron Tests — ${new Date().toISOString()}`);
  console.log(`   App URL: ${APP_URL}`);

  if (testName === 'all') {
    await runAll();
  } else if (TESTS[testName]) {
    await TESTS[testName]();
  } else {
    console.error(`Unknown test: ${testName}`);
    console.log('Available:', Object.keys(TESTS).join(', '));
    process.exit(1);
  }

  console.log('\nDone.\n');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
