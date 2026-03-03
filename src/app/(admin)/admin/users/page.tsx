'use client';

import { useState, useEffect, useCallback } from 'react';
import { Users, UserPlus, CheckCircle } from 'lucide-react';
import dynamic from 'next/dynamic';
import { StatCard } from '@/components/admin/StatCard';
import { ChartCard } from '@/components/admin/ChartCard';
import { DataTable } from '@/components/admin/DataTable';
import { RefreshButton } from '@/components/admin/RefreshButton';

const AreaChartWidget = dynamic(() => import('@/components/admin/charts/AreaChartWidget').then(m => ({ default: m.AreaChartWidget })), { ssr: false, loading: () => <div className="h-64 animate-pulse bg-white/5 rounded-xl" /> });
const BarChartWidget = dynamic(() => import('@/components/admin/charts/BarChartWidget').then(m => ({ default: m.BarChartWidget })), { ssr: false, loading: () => <div className="h-64 animate-pulse bg-white/5 rounded-xl" /> });
const PieChartWidget = dynamic(() => import('@/components/admin/charts/PieChartWidget').then(m => ({ default: m.PieChartWidget })), { ssr: false, loading: () => <div className="h-64 animate-pulse bg-white/5 rounded-xl" /> });
import type { UserAnalytics } from '@/types/admin';

const PLAN_BADGE_COLORS: Record<string, string> = {
  free: 'bg-zinc-500/20 text-zinc-300',
  pro: 'bg-amber-500/20 text-amber-300',
  power: 'bg-purple-500/20 text-purple-300',
};

function PlanBadge({ plan }: { plan: string }) {
  const colors = PLAN_BADGE_COLORS[plan] || PLAN_BADGE_COLORS.free;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colors}`}>
      {plan}
    </span>
  );
}

export default function UsersPage() {
  const [data, setData] = useState<UserAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/users');
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading && !data) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" /></div>;
  }
  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Users</h1>
        <RefreshButton onClick={fetchData} isLoading={loading} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={Users} label="Total Users" value={data.totalUsers} />
        <StatCard icon={UserPlus} label="This Week" value={data.usersThisWeek} />
        <StatCard icon={CheckCircle} label="Onboarding %" value={`${data.onboardingRate}%`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Signups Over Time">
          <AreaChartWidget data={data.signupsOverTime} />
        </ChartCard>
        <ChartCard title="Genre Preferences">
          <BarChartWidget data={data.genreDistribution} />
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Country Distribution">
          <PieChartWidget data={data.countryDistribution} />
        </ChartCard>
        <ChartCard title="Plan Distribution">
          <PieChartWidget data={data.planDistribution} />
        </ChartCard>
      </div>

      <h2 className="text-lg font-semibold">Recent Signups</h2>
      <DataTable
        columns={[
          { key: 'display_name', label: 'Name', render: (row) => (row.display_name as string) || '—' },
          { key: 'email', label: 'Email' },
          {
            key: 'plan',
            label: 'Plan',
            render: (row) => <PlanBadge plan={(row.plan as string) || 'free'} />,
          },
          {
            key: 'onboarding_completed',
            label: 'Onboarded',
            render: (row) => row.onboarding_completed ? 'Yes' : 'No',
          },
          {
            key: 'created_at',
            label: 'Joined',
            sortable: true,
            render: (row) => new Date(row.created_at as string).toLocaleDateString(),
          },
        ]}
        data={data.recentUsers as unknown as Record<string, unknown>[]}
      />
    </div>
  );
}
