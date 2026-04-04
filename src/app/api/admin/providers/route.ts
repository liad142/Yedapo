import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCached, setCached, getCacheHealth } from '@/lib/cache';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProviderMetric {
  label: string;
  value: string | number;
  highlight?: boolean;
  warn?: boolean;
}

export interface ProviderBilling {
  plan?: string;           // "Free", "Pay As You Go", "Pro"
  balance?: string;        // "$135.48 remaining"
  estimatedMonthly?: string; // "$0/mo", "~$2/mo", "$25/mo"
  rateInfo?: string;       // "nova-3 @ $0.0043/min"
  resetDate?: string;      // "Resets Apr 30, 2026"
}

export interface ProviderData {
  status: 'ok' | 'warn' | 'error' | 'unconfigured';
  metrics: ProviderMetric[];
  billing?: ProviderBilling;
  dashboardUrl: string;
  note?: string;
}

export interface ProvidersResponse {
  fetchedAt: string;
  period: { start: string; end: string; label: string };
  providers: {
    gemini: ProviderData;
    deepgram: ProviderData;
    voxtral: ProviderData;
    supadata: ProviderData;
    posthog: ProviderData;
    supabase: ProviderData;
    redis: ProviderData;
    youtube: ProviderData;
    qstash: ProviderData;
    resend: ProviderData;
    vercel: ProviderData;
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getMonthPeriod() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const last30 = new Date(now);
  last30.setDate(last30.getDate() - 30);
  return {
    start: start.toISOString().split('T')[0],
    end: now.toISOString().split('T')[0],
    last30: last30.toISOString().split('T')[0],
    label: start.toLocaleString('en-US', { month: 'long', year: 'numeric' }),
  };
}

function todayKey() {
  return new Date().toISOString().split('T')[0];
}

type Supabase = ReturnType<typeof createAdminClient>;

async function safeCount(
  supabase: Supabase,
  table: string,
  filters: { column: string; value: string | number | null }[] = [],
  dateColumn?: string,
  since?: string,
): Promise<number> {
  try {
    let q = supabase.from(table).select('id', { count: 'exact', head: true });
    for (const f of filters) q = q.eq(f.column, f.value as string);
    if (since && dateColumn) q = q.gte(dateColumn, since + 'T00:00:00Z');
    const { count, error } = await q;
    if (error) return -1;
    return count ?? 0;
  } catch {
    return -1;
  }
}

async function posthogQuery(query: string): Promise<number | null> {
  const apiKey = process.env.POSTHOG_PERSONAL_API_KEY;
  const projectId = process.env.POSTHOG_PROJECT_ID;
  if (!apiKey || !projectId) return null;
  try {
    const res = await fetch(`https://us.posthog.com/api/projects/${projectId}/query/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ query: { kind: 'HogQLQuery', query } }),
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return null;
    const data = await res.json() as { results?: unknown[][] };
    const val = data.results?.[0]?.[0];
    return typeof val === 'number' ? val : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Provider fetchers
// ---------------------------------------------------------------------------

async function fetchGemini(supabase: Supabase, monthStart: string): Promise<ProviderData> {
  const hasKey = !!process.env.GOOGLE_GEMINI_API_KEY;
  try {
    // FIX: status is 'ready' not 'done'
    const [total, thisMonth, deepTotal, quickTotal] = await Promise.all([
      safeCount(supabase, 'summaries', [{ column: 'status', value: 'ready' }]),
      safeCount(supabase, 'summaries', [{ column: 'status', value: 'ready' }], 'updated_at', monthStart),
      safeCount(supabase, 'summaries', [{ column: 'status', value: 'ready' }, { column: 'level', value: 'deep' }]),
      safeCount(supabase, 'summaries', [{ column: 'status', value: 'ready' }, { column: 'level', value: 'quick' }]),
    ]);

    // Cost estimate: gemini-2.5-flash avg ~3000 input + 800 output tokens per summary
    // $0.075/1M input + $0.30/1M output → ~$0.000225 + $0.00024 = ~$0.00047/summary
    const estimatedCostTotal = total > 0 ? (total * 0.00047).toFixed(2) : '0.00';

    return {
      status: hasKey ? 'ok' : 'warn',
      dashboardUrl: 'https://console.cloud.google.com/billing',
      metrics: [
        { label: 'Total summaries generated', value: total >= 0 ? total : 'N/A', highlight: true },
        { label: 'This month', value: thisMonth >= 0 ? thisMonth : 'N/A' },
        { label: '↳ Deep', value: deepTotal >= 0 ? deepTotal : 'N/A' },
        { label: '↳ Quick', value: quickTotal >= 0 ? quickTotal : 'N/A' },
      ],
      billing: {
        plan: 'Pay As You Go',
        estimatedMonthly: `~$${estimatedCostTotal}`,
        rateInfo: 'gemini-2.5-flash: $0.075/1M in · $0.30/1M out',
      },
      note: hasKey ? undefined : 'Add GOOGLE_GEMINI_API_KEY',
    };
  } catch {
    return { status: 'error', dashboardUrl: 'https://console.cloud.google.com/billing', metrics: [] };
  }
}

async function fetchDeepgram(supabase: Supabase, monthStart: string, last30: string, end: string): Promise<ProviderData> {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) {
    return { status: 'unconfigured', dashboardUrl: 'https://console.deepgram.com', metrics: [], note: 'Add DEEPGRAM_API_KEY' };
  }

  const [totalDone, thisMonth, failed] = await Promise.all([
    safeCount(supabase, 'transcripts', [{ column: 'provider', value: 'deepgram' }, { column: 'status', value: 'ready' }]),
    safeCount(supabase, 'transcripts', [{ column: 'provider', value: 'deepgram' }, { column: 'status', value: 'ready' }], 'updated_at', monthStart),
    safeCount(supabase, 'transcripts', [{ column: 'provider', value: 'deepgram' }, { column: 'status', value: 'failed' }], 'updated_at', monthStart),
  ]);

  const metrics: ProviderMetric[] = [
    { label: 'Total transcripts', value: totalDone >= 0 ? totalDone : 'N/A', highlight: true },
    { label: 'This month', value: thisMonth >= 0 ? thisMonth : 'N/A' },
    { label: 'Failed this month', value: failed >= 0 ? failed : 'N/A', warn: (failed ?? 0) > 0 },
  ];

  const billing: ProviderBilling = {
    plan: 'Pay As You Go',
    rateInfo: 'nova-3 @ $0.0043/min',
  };

  // Deepgram balance
  try {
    const projRes = await fetch('https://api.deepgram.com/v1/projects', {
      headers: { Authorization: `Token ${apiKey}` },
      signal: AbortSignal.timeout(8000),
    });
    if (projRes.ok) {
      const projData = await projRes.json() as { projects?: { project_id: string }[] };
      const projectId = projData.projects?.[0]?.project_id;
      if (projectId) {
        const balRes = await fetch(`https://api.deepgram.com/v1/projects/${projectId}/balances`, {
          headers: { Authorization: `Token ${apiKey}` },
          signal: AbortSignal.timeout(8000),
        });
        if (balRes.ok) {
          const balData = await balRes.json() as { balances?: { amount: number; units: string }[] };
          const bal = balData.balances?.[0];
          if (bal) {
            billing.balance = `$${bal.amount.toFixed(2)} remaining`;
            metrics.unshift({ label: 'Credit balance', value: `$${bal.amount.toFixed(2)}`, highlight: true });
          }
        }
      }
    }
  } catch { /* graceful */ }

  // Deepgram usage last 30 days for request count
  try {
    const usageRes = await fetch(
      `https://api.deepgram.com/v1/usage/requests?start=${last30}&end=${end}&limit=1`,
      { headers: { Authorization: `Token ${apiKey}` }, signal: AbortSignal.timeout(8000) }
    );
    if (usageRes.ok) {
      const usageData = await usageRes.json() as { page?: { total?: number } };
      const total = usageData?.page?.total;
      if (typeof total === 'number') {
        metrics.push({ label: 'API requests (last 30d)', value: total });
        // Estimate cost: avg podcast ep ~1h → 60min * 0.0043 = $0.258/ep
        const estimatedCost = (total * 0.258).toFixed(2);
        billing.estimatedMonthly = `~$${estimatedCost}`;
      }
    }
  } catch { /* graceful */ }

  return { status: (failed ?? 0) > 5 ? 'warn' : 'ok', dashboardUrl: 'https://console.deepgram.com/usage', metrics, billing };
}

async function fetchVoxtral(supabase: Supabase, monthStart: string): Promise<ProviderData> {
  const hasKey = !!process.env.MISTRAL_API_KEY;
  if (!hasKey) {
    return { status: 'unconfigured', dashboardUrl: 'https://console.mistral.ai/usage', metrics: [], note: 'Add MISTRAL_API_KEY' };
  }

  const [total, thisMonth, failed] = await Promise.all([
    safeCount(supabase, 'transcripts', [{ column: 'provider', value: 'voxtral' }, { column: 'status', value: 'ready' }]),
    safeCount(supabase, 'transcripts', [{ column: 'provider', value: 'voxtral' }, { column: 'status', value: 'ready' }], 'updated_at', monthStart),
    safeCount(supabase, 'transcripts', [{ column: 'provider', value: 'voxtral' }, { column: 'status', value: 'failed' }], 'updated_at', monthStart),
  ]);

  return {
    status: 'ok',
    dashboardUrl: 'https://console.mistral.ai/usage',
    metrics: [
      { label: 'Total transcripts', value: total >= 0 ? total : 'N/A', highlight: true },
      { label: 'This month', value: thisMonth >= 0 ? thisMonth : 'N/A' },
      { label: 'Failed this month', value: failed >= 0 ? failed : 'N/A' },
    ],
    billing: {
      plan: 'Pay As You Go',
      rateInfo: 'voxtral-mini @ $0.0028/min',
      estimatedMonthly: total > 0 ? `~$${(total * 0.168).toFixed(2)}` : '$0',
    },
    note: 'No Mistral billing API — usage from internal DB',
  };
}

async function fetchSupadata(supabase: Supabase, monthStart: string): Promise<ProviderData> {
  const apiKey = process.env.SUPADATA_API_KEY;
  const DASHBOARD = 'https://dash.supadata.ai';

  const [total, thisMonth, failed] = await Promise.all([
    safeCount(supabase, 'transcripts', [{ column: 'provider', value: 'youtube-captions' }, { column: 'status', value: 'ready' }]),
    safeCount(supabase, 'transcripts', [{ column: 'provider', value: 'youtube-captions' }, { column: 'status', value: 'ready' }], 'updated_at', monthStart),
    safeCount(supabase, 'transcripts', [{ column: 'provider', value: 'youtube-captions' }, { column: 'status', value: 'failed' }], 'updated_at', monthStart),
  ]);

  const metrics: ProviderMetric[] = [
    { label: 'Total YT captions fetched', value: total >= 0 ? total : 'N/A', highlight: true },
    { label: 'This month', value: thisMonth >= 0 ? thisMonth : 'N/A' },
    { label: 'Failed this month', value: failed >= 0 ? failed : 'N/A' },
  ];

  if (!apiKey) {
    return {
      status: 'warn',
      dashboardUrl: DASHBOARD,
      metrics,
      billing: { plan: 'Unknown — key missing' },
      note: 'Add SUPADATA_API_KEY to see credits used/remaining',
    };
  }

  // Try Supadata usage/credits API
  const endpoints = [
    'https://api.supadata.ai/v1/usage',
    'https://api.supadata.ai/v1/credits',
    'https://api.supadata.ai/v1/account',
  ];

  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint, {
        headers: { 'x-api-key': apiKey },
        signal: AbortSignal.timeout(6000),
      });
      if (res.ok) {
        const data = await res.json() as {
          used?: number; limit?: number; remaining?: number; reset_at?: string;
          credits_used?: number; credits_limit?: number; credits_remaining?: number;
        };
        const used = data.used ?? data.credits_used;
        const limit = data.limit ?? data.credits_limit;
        const remaining = data.remaining ?? data.credits_remaining;
        const resetAt = data.reset_at;

        if (typeof used === 'number') {
          const pct = limit ? Math.round((used / limit) * 100) : null;
          metrics.unshift(
            { label: 'Credits used', value: used, highlight: true },
            { label: 'Credits remaining', value: remaining ?? (limit ? limit - used : 'N/A') },
            { label: 'Plan limit', value: limit ?? 'N/A' },
            ...(pct !== null ? [{ label: 'Usage %', value: `${pct}%`, warn: pct > 75 }] : []),
          );
          const resetStr = resetAt ? new Date(resetAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : undefined;
          const status: ProviderData['status'] = pct !== null && pct >= 90 ? 'error' : pct !== null && pct >= 75 ? 'warn' : 'ok';
          return {
            status,
            dashboardUrl: DASHBOARD,
            metrics,
            billing: { plan: 'Free 100 credits/mo', resetDate: resetStr ? `Resets ${resetStr}` : undefined, estimatedMonthly: '$0' },
          };
        }
        break;
      }
    } catch { /* try next endpoint */ }
  }

  return {
    status: 'ok',
    dashboardUrl: DASHBOARD,
    metrics,
    billing: { plan: 'Free 100 credits/mo', estimatedMonthly: '$0' },
    note: 'Credits API unavailable — usage from internal DB',
  };
}

async function fetchPostHog(): Promise<ProviderData> {
  const apiKey = process.env.POSTHOG_PERSONAL_API_KEY;
  const projectId = process.env.POSTHOG_PROJECT_ID;
  const DASHBOARD = 'https://us.posthog.com';

  if (!apiKey || !projectId) {
    return { status: 'unconfigured', dashboardUrl: DASHBOARD, metrics: [], note: 'Add POSTHOG_PERSONAL_API_KEY + POSTHOG_PROJECT_ID' };
  }

  const metrics: ProviderMetric[] = [];

  // FIX: use HogQL interval syntax, not JS date strings
  const [eventCount, userCount] = await Promise.all([
    posthogQuery(`SELECT count() FROM events WHERE timestamp > now() - INTERVAL 30 DAY AND event NOT LIKE '$%'`),
    posthogQuery(`SELECT count(DISTINCT person_id) FROM events WHERE timestamp > now() - INTERVAL 30 DAY`),
  ]);

  if (eventCount !== null) metrics.push({ label: 'Events (last 30d)', value: eventCount.toLocaleString(), highlight: true });
  if (userCount !== null) metrics.push({ label: 'Unique users (last 30d)', value: userCount.toLocaleString() });

  // Billing tier: free up to 1M events
  const tier = eventCount !== null && eventCount > 1_000_000 ? 'Paid' : 'Free';
  const overage = eventCount !== null && eventCount > 1_000_000
    ? `~$${((eventCount - 1_000_000) * 0.000225).toFixed(2)}/mo`
    : '$0/mo';

  return {
    status: metrics.length > 0 ? 'ok' : 'warn',
    dashboardUrl: `${DASHBOARD}/project/${projectId}`,
    metrics,
    billing: {
      plan: `${tier} tier`,
      estimatedMonthly: overage,
      rateInfo: 'Free ≤1M events/mo · $0.000225/event above',
    },
  };
}

async function fetchSupabaseStats(supabase: Supabase): Promise<ProviderData> {
  try {
    const [users, episodes, summaries, transcripts, podcasts] = await Promise.all([
      safeCount(supabase, 'user_profiles'),
      safeCount(supabase, 'episodes'),
      safeCount(supabase, 'summaries'),
      safeCount(supabase, 'transcripts'),
      safeCount(supabase, 'podcasts'),
    ]);

    const projectRef = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').match(/\/\/([^.]+)/)?.[1] ?? 'unknown';

    return {
      status: 'ok',
      dashboardUrl: `https://supabase.com/dashboard/project/${projectRef}`,
      metrics: [
        { label: 'Users', value: users >= 0 ? users : 'N/A', highlight: true },
        { label: 'Podcasts', value: podcasts >= 0 ? podcasts : 'N/A' },
        { label: 'Episodes', value: episodes >= 0 ? episodes : 'N/A' },
        { label: 'Summaries', value: summaries >= 0 ? summaries : 'N/A' },
        { label: 'Transcripts', value: transcripts >= 0 ? transcripts : 'N/A' },
      ],
      billing: {
        plan: 'Free tier',
        estimatedMonthly: '$0/mo',
        rateInfo: 'Upgrade to Pro for $25/mo',
      },
    };
  } catch {
    return { status: 'error', dashboardUrl: 'https://supabase.com/dashboard', metrics: [] };
  }
}

async function fetchRedisStats(): Promise<ProviderData> {
  try {
    const health = await getCacheHealth();
    const status = !health.connected ? 'error' : health.latencyMs > 500 ? 'warn' : 'ok';
    return {
      status,
      dashboardUrl: 'https://console.upstash.com',
      metrics: [
        { label: 'Status', value: health.connected ? 'Connected' : 'DOWN', highlight: true },
        { label: 'Latency', value: health.latencyMs >= 0 ? `${health.latencyMs}ms` : 'N/A' },
        { label: 'Total keys (DBSIZE)', value: health.cacheKeys },
      ],
      billing: {
        plan: 'Free tier',
        estimatedMonthly: '$0/mo',
        rateInfo: '10K req/day free · $0.2/100K above',
      },
    };
  } catch {
    return { status: 'error', dashboardUrl: 'https://console.upstash.com', metrics: [] };
  }
}

async function fetchYoutubeStats(): Promise<ProviderData> {
  const hasKey = !!process.env.YOUTUBE_API_KEY;
  if (!hasKey) {
    return { status: 'unconfigured', dashboardUrl: 'https://console.cloud.google.com/apis/dashboard', metrics: [], note: 'Add YOUTUBE_API_KEY' };
  }

  const today = todayKey();
  const quotaUsed = (await getCached<number>(`yt-quota:${today}`)) ?? 0;
  const quotaLimit = 10_000;
  const pct = Math.round((quotaUsed / quotaLimit) * 100);
  const status: ProviderData['status'] = pct >= 90 ? 'error' : pct >= 75 ? 'warn' : 'ok';

  return {
    status,
    dashboardUrl: 'https://console.cloud.google.com/apis/dashboard',
    metrics: [
      { label: 'Quota used today', value: quotaUsed.toLocaleString(), highlight: true },
      { label: 'Remaining today', value: (quotaLimit - quotaUsed).toLocaleString() },
      { label: 'Daily limit', value: quotaLimit.toLocaleString() },
      { label: 'Usage %', value: `${pct}%`, warn: pct > 50 },
    ],
    billing: { plan: 'Free', estimatedMonthly: '$0/mo', rateInfo: '10K units/day included' },
  };
}

async function fetchQstashStats(): Promise<ProviderData> {
  const token = process.env.QSTASH_TOKEN;
  // FIX: always use the canonical QStash API base, not QSTASH_URL (which is a publishing endpoint)
  const API_BASE = 'https://qstash.upstash.io';

  if (!token) {
    return { status: 'unconfigured', dashboardUrl: 'https://console.upstash.com/qstash', metrics: [], note: 'Add QSTASH_TOKEN' };
  }

  let metrics: ProviderMetric[] = [];
  let apiStatus: ProviderData['status'] = 'ok';

  // FIX: use /v2/queues instead of /v2/messages
  try {
    const res = await fetch(`${API_BASE}/v2/queues`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8000),
    });

    if (res.ok) {
      const data = await res.json() as { queues?: { name: string; pendingMessageCount?: number; lag?: number }[] };
      const queues = data.queues ?? [];
      const totalPending = queues.reduce((sum, q) => sum + (q.pendingMessageCount ?? 0), 0);
      metrics = [
        { label: 'Queues', value: queues.length, highlight: true },
        { label: 'Pending messages', value: totalPending },
      ];
    } else {
      // Fallback: try /v2/messages
      const fallback = await fetch(`${API_BASE}/v2/messages`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(8000),
      });
      if (fallback.ok) {
        const data = await fallback.json() as { messages?: unknown[] };
        metrics = [{ label: 'Active messages', value: Array.isArray(data.messages) ? data.messages.length : 0, highlight: true }];
      } else {
        apiStatus = 'warn';
        metrics = [{ label: 'API', value: 'Configured' }];
      }
    }
  } catch {
    apiStatus = 'warn';
    metrics = [{ label: 'API', value: 'Configured' }];
  }

  return {
    status: apiStatus,
    dashboardUrl: 'https://console.upstash.com/qstash',
    metrics,
    billing: {
      plan: 'Free tier',
      estimatedMonthly: '$0/mo',
      rateInfo: '500 msg/day free · pay-per-message above',
    },
  };
}

async function fetchResendStats(supabase: Supabase, monthStart: string): Promise<ProviderData> {
  const hasKey = !!process.env.RESEND_API_KEY;
  if (!hasKey) {
    return { status: 'unconfigured', dashboardUrl: 'https://resend.com/emails', metrics: [], note: 'Add RESEND_API_KEY' };
  }

  const [total, thisMonth, failed] = await Promise.all([
    safeCount(supabase, 'notifications', [{ column: 'channel', value: 'email' }, { column: 'status', value: 'sent' }]),
    safeCount(supabase, 'notifications', [{ column: 'channel', value: 'email' }, { column: 'status', value: 'sent' }], 'created_at', monthStart),
    safeCount(supabase, 'notifications', [{ column: 'channel', value: 'email' }, { column: 'status', value: 'failed' }], 'created_at', monthStart),
  ]);

  // Resend: Free 3000/mo, Scale $20/mo for 50K
  const monthlyCount = thisMonth >= 0 ? thisMonth : 0;
  const plan = monthlyCount > 3000 ? 'Scale ($20/mo)' : 'Free tier';
  const estimatedMonthly = monthlyCount > 3000 ? '$20/mo' : '$0/mo';

  return {
    status: 'ok',
    dashboardUrl: 'https://resend.com/emails',
    metrics: [
      { label: 'Total emails sent', value: total >= 0 ? total : 'N/A', highlight: true },
      { label: 'This month', value: thisMonth >= 0 ? thisMonth : 'N/A' },
      { label: 'Failed this month', value: failed >= 0 ? failed : 'N/A' },
    ],
    billing: {
      plan,
      estimatedMonthly,
      rateInfo: 'Free ≤3000/mo · Scale $20/mo for 50K',
    },
  };
}

async function fetchVercel(): Promise<ProviderData> {
  const token = process.env.VERCEL_API_TOKEN;
  const DASHBOARD = 'https://vercel.com/dashboard';

  if (!token) {
    return {
      status: 'unconfigured',
      dashboardUrl: DASHBOARD,
      metrics: [],
      billing: { plan: 'Unknown', estimatedMonthly: '?' },
      note: 'Add VERCEL_API_TOKEN — generate at vercel.com/account/tokens',
    };
  }

  const metrics: ProviderMetric[] = [];
  let plan: string | undefined;
  let teamName: string | undefined;

  // Try teams first (Pro plan lives on the team, not the personal account)
  try {
    const teamsRes = await fetch('https://api.vercel.com/v2/teams?limit=5', {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8000),
    });
    if (teamsRes.ok) {
      const data = await teamsRes.json() as { teams?: { name: string; plan?: string; membership?: { role?: string } }[] };
      const team = data.teams?.[0];
      if (team) {
        plan = team.plan ?? 'pro';
        teamName = team.name;
      }
    }
  } catch { /* graceful */ }

  // Fall back to user plan if no teams
  if (!plan) {
    try {
      const userRes = await fetch('https://api.vercel.com/v2/user', {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(8000),
      });
      if (userRes.ok) {
        const data = await userRes.json() as { user?: { billing?: { plan?: string } } };
        plan = data.user?.billing?.plan ?? 'hobby';
      }
    } catch { /* graceful */ }
  }

  // Get projects and deployments in parallel
  try {
    const [deploymentsRes, projectsRes] = await Promise.allSettled([
      fetch('https://api.vercel.com/v6/deployments?limit=5', {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(8000),
      }),
      fetch('https://api.vercel.com/v9/projects?limit=10', {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(8000),
      }),
    ]);

    if (projectsRes.status === 'fulfilled' && projectsRes.value.ok) {
      const data = await projectsRes.value.json() as { projects?: unknown[] };
      metrics.push({ label: 'Projects', value: data.projects?.length ?? 'N/A', highlight: true });
    }

    if (deploymentsRes.status === 'fulfilled' && deploymentsRes.value.ok) {
      const data = await deploymentsRes.value.json() as { deployments?: { state: string; createdAt: number }[] };
      const latest = data.deployments?.[0];
      if (latest) {
        const ageMin = Math.round((Date.now() - latest.createdAt) / 60000);
        const ageStr = ageMin < 60 ? `${ageMin}m ago` : ageMin < 1440 ? `${Math.round(ageMin / 60)}h ago` : `${Math.round(ageMin / 1440)}d ago`;
        metrics.push(
          { label: 'Latest deploy', value: ageStr },
          { label: 'Latest status', value: latest.state },
        );
      }
      const ready = (data.deployments ?? []).filter(d => d.state === 'READY').length;
      metrics.push({ label: 'Recent (last 5)', value: `${ready}/5 ready` });
    }
  } catch { /* graceful */ }

  const planLabel = plan === 'pro' ? 'Pro' : plan === 'enterprise' ? 'Enterprise' : 'Hobby';
  const monthlyCost = plan === 'pro' ? '$20/mo per member' : plan === 'enterprise' ? 'Custom' : '$0/mo';

  if (teamName) metrics.unshift({ label: 'Team', value: teamName, highlight: true });

  return {
    status: metrics.length > 0 ? 'ok' : 'warn',
    dashboardUrl: DASHBOARD,
    metrics,
    billing: {
      plan: planLabel,
      estimatedMonthly: monthlyCost,
    },
  };
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function GET(request: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  const url = new URL(request.url);
  const refresh = url.searchParams.get('refresh') === 'true';

  const CACHE_KEY = 'admin:providers:stats';
  const CACHE_TTL = 300; // 5 minutes

  if (!refresh) {
    const cached = await getCached<ProvidersResponse>(CACHE_KEY);
    if (cached) return NextResponse.json(cached);
  }

  const period = getMonthPeriod();
  const supabase = createAdminClient();

  const [
    gemini, deepgram, voxtral, supadata, posthog,
    supabaseStats, redisStats, youtube, qstash, resend, vercel,
  ] = await Promise.all([
    fetchGemini(supabase, period.start),
    fetchDeepgram(supabase, period.start, period.last30, period.end),
    fetchVoxtral(supabase, period.start),
    fetchSupadata(supabase, period.start),
    fetchPostHog(),
    fetchSupabaseStats(supabase),
    fetchRedisStats(),
    fetchYoutubeStats(),
    fetchQstashStats(),
    fetchResendStats(supabase, period.start),
    fetchVercel(),
  ]);

  const result: ProvidersResponse = {
    fetchedAt: new Date().toISOString(),
    period: { start: period.start, end: period.end, label: period.label },
    providers: {
      gemini, deepgram, voxtral, supadata, posthog,
      supabase: supabaseStats,
      redis: redisStats,
      youtube, qstash, resend, vercel,
    },
  };

  await setCached(CACHE_KEY, result, CACHE_TTL);
  return NextResponse.json(result);
}
