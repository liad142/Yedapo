/**
 * One-time setup script to create QStash schedules.
 *
 * Run with: npx tsx scripts/setup-qstash-schedules.ts
 *
 * Required env vars:
 *   QSTASH_TOKEN           — from Upstash console → QStash tab
 *   NEXT_PUBLIC_APP_URL    — e.g. https://www.yedapo.com
 */

import { Client } from '@upstash/qstash';

const token = process.env.QSTASH_TOKEN;
const appUrl = process.env.NEXT_PUBLIC_APP_URL;

if (!token) {
  console.error('Missing QSTASH_TOKEN env var');
  process.exit(1);
}
if (!appUrl) {
  console.error('Missing NEXT_PUBLIC_APP_URL env var');
  process.exit(1);
}

const client = new Client({ token });

async function main() {
  console.log(`Setting up QStash schedules for ${appUrl}...\n`);

  // 1. Process stuck summaries — every 10 minutes
  const summaries = await client.schedules.create({
    destination: `${appUrl}/api/cron/process-queued-summaries`,
    cron: '*/30 * * * *',
  });
  console.log(`Created: process-queued-summaries (every 30 min)`);
  console.log(`  Schedule ID: ${summaries.scheduleId}\n`);

  // 2. Check new episodes — every 6 hours
  const episodes = await client.schedules.create({
    destination: `${appUrl}/api/cron/check-new-episodes`,
    cron: '0 */6 * * *',
  });
  console.log(`Created: check-new-episodes (every 6 hours)`);
  console.log(`  Schedule ID: ${episodes.scheduleId}\n`);

  // List all schedules
  const all = await client.schedules.list();
  console.log(`Total schedules: ${all.length}`);
  for (const s of all) {
    console.log(`  - ${s.destination} | ${s.cron} | ID: ${s.scheduleId}`);
  }

  console.log('\nDone. Verify at https://console.upstash.com/qstash');
}

main().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
