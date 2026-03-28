/**
 * Server-only PostHog HogQL query client.
 * Uses the PostHog HTTP API with a Personal API Key for read access.
 * The project API key (phc_...) is ingestion-only and cannot query events.
 */

const POSTHOG_API_KEY = process.env.POSTHOG_PERSONAL_API_KEY;
const POSTHOG_PROJECT_ID = process.env.POSTHOG_PROJECT_ID;
const POSTHOG_HOST = 'https://us.posthog.com';

interface HogQLResult {
  columns: string[];
  results: unknown[][];
}

async function queryPostHog(hogql: string): Promise<HogQLResult> {
  if (!POSTHOG_API_KEY || !POSTHOG_PROJECT_ID) {
    throw new Error('PostHog API credentials not configured');
  }

  const res = await fetch(
    `${POSTHOG_HOST}/api/projects/${POSTHOG_PROJECT_ID}/query/`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${POSTHOG_API_KEY}`,
      },
      body: JSON.stringify({ query: { kind: 'HogQLQuery', query: hogql } }),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PostHog query failed (${res.status}): ${text}`);
  }

  const json = await res.json();
  return { columns: json.columns ?? [], results: json.results ?? [] };
}

export async function getActiveUsers(
  period: 'day' | 'week' | 'month'
): Promise<number> {
  const intervalDays = period === 'day' ? 1 : period === 'week' ? 7 : 30;
  const { results } = await queryPostHog(
    `SELECT count(DISTINCT person_id) FROM events WHERE timestamp > now() - INTERVAL ${intervalDays} DAY`
  );
  return Number(results[0]?.[0] ?? 0);
}

export async function getActiveUsersTrend(
  days: number = 30
): Promise<{ date: string; value: number }[]> {
  const { results } = await queryPostHog(
    `SELECT toDate(timestamp) as date, count(DISTINCT person_id) as value FROM events WHERE timestamp > now() - INTERVAL ${days} DAY GROUP BY date ORDER BY date`
  );
  return results.map((r) => ({
    date: String(r[0]),
    value: Number(r[1]),
  }));
}

export async function getTopEvents(
  days: number = 30
): Promise<{ event: string; count: number; uniqueUsers: number }[]> {
  const { results } = await queryPostHog(
    `SELECT event, count() as count, uniq(person_id) as unique_users FROM events WHERE timestamp > now() - INTERVAL ${days} DAY AND event NOT LIKE '$%' GROUP BY event ORDER BY count DESC LIMIT 20`
  );
  return results.map((r) => ({
    event: String(r[0]),
    count: Number(r[1]),
    uniqueUsers: Number(r[2]),
  }));
}

export async function getFeatureAdoption(
  days: number = 30,
  mau: number
): Promise<
  { event: string; uniqueUsers: number; totalFires: number; adoptionPct: number }[]
> {
  const { results } = await queryPostHog(
    `SELECT event, uniq(person_id) as unique_users, count() as total_fires FROM events WHERE timestamp > now() - INTERVAL ${days} DAY AND event NOT LIKE '$%' GROUP BY event ORDER BY unique_users DESC LIMIT 20`
  );
  return results.map((r) => ({
    event: String(r[0]),
    uniqueUsers: Number(r[1]),
    totalFires: Number(r[2]),
    adoptionPct: mau > 0 ? Math.round((Number(r[1]) / mau) * 100) : 0,
  }));
}

export async function getEngagementFunnel(
  days: number = 30
): Promise<{ step: string; count: number }[]> {
  const funnelEvents = [
    { step: 'Signed Up', event: 'auth_google_started' },
    { step: 'Onboarded', event: 'onboarding_completed' },
    { step: 'Requested Summary', event: 'summary_requested' },
    { step: 'Viewed Insights', event: 'insights_viewed' },
    { step: 'Played Episode', event: 'episode_played' },
    { step: 'Subscribed', event: 'podcast_subscribed' },
  ];

  const queries = funnelEvents.map(({ event }) =>
    queryPostHog(
      `SELECT uniq(person_id) FROM events WHERE event = '${event}' AND timestamp > now() - INTERVAL ${days} DAY`
    )
  );

  const results = await Promise.all(queries);

  return funnelEvents.map(({ step }, i) => ({
    step,
    count: Number(results[i].results[0]?.[0] ?? 0),
  }));
}
