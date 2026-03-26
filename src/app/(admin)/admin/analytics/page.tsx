'use client';

import { useState, useEffect, useCallback } from 'react';
import { Users, UserCheck, UsersRound, Activity } from 'lucide-react';
import dynamic from 'next/dynamic';
import { StatCard } from '@/components/admin/StatCard';
import { ChartCard } from '@/components/admin/ChartCard';
import { DataTable } from '@/components/admin/DataTable';
import { RefreshButton } from '@/components/admin/RefreshButton';
import { elevation } from '@/lib/elevation';
import { cn } from '@/lib/utils';
import type { PostHogAnalytics } from '@/types/admin';

const AreaChartWidget = dynamic(
  () =>
    import('@/components/admin/charts/AreaChartWidget').then((m) => ({
      default: m.AreaChartWidget,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="h-64 animate-pulse bg-white/5 rounded-xl" />
    ),
  }
);
const BarChartWidget = dynamic(
  () =>
    import('@/components/admin/charts/BarChartWidget').then((m) => ({
      default: m.BarChartWidget,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="h-64 animate-pulse bg-white/5 rounded-xl" />
    ),
  }
);

export default function AnalyticsPage() {
  const [data, setData] = useState<PostHogAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (refresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const url = refresh
        ? '/api/admin/analytics?refresh=true'
        : '/api/admin/analytics';
      const res = await fetch(url);
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }
      setData(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-muted-foreground text-sm">{error}</p>
        <button
          onClick={() => fetchData()}
          className="text-sm text-primary hover:underline"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  // Map funnel data for BarChartWidget (needs label + count)
  const funnelChartData = data.funnel.map((f) => ({
    label: f.step,
    count: f.count,
  }));

  // Map feature adoption for BarChartWidget (top 10 by unique users)
  const adoptionChartData = data.featureAdoption.slice(0, 10).map((f) => ({
    label: f.event.replace(/_/g, ' '),
    count: f.uniqueUsers,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Analytics</h1>
          {data.lastUpdated && (
            <p className="text-xs text-muted-foreground mt-1">
              Last updated:{' '}
              {new Date(data.lastUpdated).toLocaleString()}
            </p>
          )}
        </div>
        <RefreshButton onClick={() => fetchData(true)} isLoading={loading} />
      </div>

      {/* Row 1: Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard icon={Users} label="DAU" value={data.dau.toLocaleString()} />
        <StatCard
          icon={UserCheck}
          label="WAU"
          value={data.wau.toLocaleString()}
        />
        <StatCard
          icon={UsersRound}
          label="MAU"
          value={data.mau.toLocaleString()}
        />
        <StatCard
          icon={Activity}
          label="Engagement (DAU/MAU)"
          value={`${data.dauMauRatio}%`}
        />
      </div>

      {/* Row 2: Active Users Trend */}
      <ChartCard title="Active Users (30-day trend)">
        <AreaChartWidget data={data.activeUsersTrend} />
      </ChartCard>

      {/* Row 3: Funnel + Feature Adoption */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="User Funnel (30 days)">
          <BarChartWidget data={funnelChartData} />
          <div className="mt-3 flex flex-wrap gap-2">
            {data.funnel.map((f) => (
              <span
                key={f.step}
                className="text-xs text-muted-foreground"
              >
                {f.step}: {f.conversionPct}%
              </span>
            ))}
          </div>
        </ChartCard>
        <ChartCard title="Feature Adoption (by unique users)">
          <BarChartWidget data={adoptionChartData} color="hsl(var(--chart-2))" />
        </ChartCard>
      </div>

      {/* Correlation Card */}
      <div className={cn(elevation.card, 'rounded-xl p-3 sm:p-5')}>
        <h3 className="text-sm font-medium text-muted-foreground mb-4">
          Supabase ↔ PostHog Correlation
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <CorrelationStat
            label="Registered Users"
            value={data.correlation.totalRegistered}
          />
          <CorrelationStat
            label="Onboarding Rate"
            value={`${data.correlation.onboardingRate}%`}
            sub={`${data.correlation.completedOnboarding} users`}
          />
          <CorrelationStat
            label="Play Rate"
            value={`${data.correlation.playRate}%`}
            sub={`${data.correlation.hasPlayed} users`}
          />
          <CorrelationStat
            label="Subscribe Rate"
            value={`${data.correlation.subscribeRate}%`}
            sub={`${data.correlation.hasSubscribed} users`}
          />
        </div>
      </div>

      {/* Row 4: Top Events Table */}
      <h2 className="text-lg font-semibold">Top Events (30 days)</h2>
      <DataTable
        columns={[
          { key: 'event', label: 'Event Name' },
          {
            key: 'count',
            label: 'Total Fires',
            sortable: true,
            render: (row) =>
              Number(row.count).toLocaleString(),
          },
          {
            key: 'uniqueUsers',
            label: 'Unique Users',
            sortable: true,
            render: (row) =>
              Number(row.uniqueUsers).toLocaleString(),
          },
        ]}
        data={
          data.topEvents as unknown as Record<string, unknown>[]
        }
      />
    </div>
  );
}

function CorrelationStat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="text-center">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-bold mt-1">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
      {sub && (
        <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
      )}
    </div>
  );
}
