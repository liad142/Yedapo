import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { createAdminClient } from '@/lib/supabase/admin';
import type { OverviewStats } from '@/types/admin';

const SUMMARY_STATUSES = ['ready', 'failed', 'queued', 'transcribing', 'summarizing'] as const;

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const admin = createAdminClient();

  // All queries use head:true (count only) or have explicit limits — no unbounded row loading
  const [
    { count: totalUsers },
    { count: totalPodcasts },
    { count: totalEpisodes },
    { count: totalSubscriptions },
    { count: totalFollows },
    { data: recentSummaries },
    { data: signups },
    { count: failedLast7d },
    { count: totalLast7d },
    ...statusResults
  ] = await Promise.all([
    admin.from('user_profiles').select('*', { count: 'exact', head: true }),
    admin.from('podcasts').select('*', { count: 'exact', head: true }),
    admin.from('episodes').select('*', { count: 'exact', head: true }),
    admin.from('podcast_subscriptions').select('*', { count: 'exact', head: true }),
    admin.from('youtube_channel_follows').select('*', { count: 'exact', head: true }),
    admin.from('summaries').select('status, level, updated_at, episode_id').order('updated_at', { ascending: false }).limit(10),
    // Signups: last 90 days only (bounded)
    admin.from('user_profiles')
      .select('created_at')
      .gte('created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: true }),
    // Failure rate: last 7 days only (not skewed by old data)
    admin.from('summaries')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'failed')
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
    admin.from('summaries')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
    // Per-status count queries (head:true = no row data transferred)
    ...SUMMARY_STATUSES.map(status =>
      admin.from('summaries').select('*', { count: 'exact', head: true }).eq('status', status)
    ),
  ]);

  // Build status counts from individual count queries
  const statusCounts: Record<string, number> = {};
  SUMMARY_STATUSES.forEach((status, i) => {
    const count = statusResults[i]?.count ?? 0;
    if (count > 0) statusCounts[status] = count;
  });

  const summariesReady = statusCounts['ready'] || 0;
  const summariesFailed = statusCounts['failed'] || 0;
  const totalSummaries = Object.values(statusCounts).reduce((sum, c) => sum + c, 0);
  const queueDepth = (statusCounts['queued'] || 0) + (statusCounts['transcribing'] || 0) + (statusCounts['summarizing'] || 0);
  const failureRate = (totalLast7d ?? 0) > 0 ? Math.round(((failedLast7d ?? 0) / (totalLast7d ?? 0)) * 100) : 0;

  // AI status breakdown
  const aiStatusBreakdown = Object.entries(statusCounts).map(([label, count]) => ({ label, count }));

  // Signups over time (group by day) — bounded to 90 days
  const signupsByDay: Record<string, number> = {};
  (signups ?? []).forEach((u: { created_at: string }) => {
    const day = u.created_at.split('T')[0];
    signupsByDay[day] = (signupsByDay[day] || 0) + 1;
  });
  const signupsOverTime = Object.entries(signupsByDay).map(([date, value]) => ({ date, value }));

  // Recent activity
  const recentActivity = (recentSummaries ?? []).map((s: { episode_id: string; status: string; level: string; updated_at: string }) => ({
    type: `${s.level} summary`,
    description: `Episode ${s.episode_id.slice(0, 8)}... → ${s.status}`,
    timestamp: s.updated_at,
  }));

  const data: OverviewStats = {
    totalUsers: totalUsers ?? 0,
    totalPodcasts: totalPodcasts ?? 0,
    totalEpisodes: totalEpisodes ?? 0,
    summariesReady,
    queueDepth,
    failureRate,
    totalSubscriptions: totalSubscriptions ?? 0,
    totalFollows: totalFollows ?? 0,
    signupsOverTime,
    aiStatusBreakdown,
    recentActivity,
  };

  return NextResponse.json(data);
}
