'use client';

import { useState, useEffect, useCallback } from 'react';
import { Users, Radio, FileText, AlertTriangle, Layers, TrendingUp } from 'lucide-react';
import dynamic from 'next/dynamic';
import { StatCard } from '@/components/admin/StatCard';
import { ChartCard } from '@/components/admin/ChartCard';
import { DataTable } from '@/components/admin/DataTable';
import { RefreshButton } from '@/components/admin/RefreshButton';
import { TodoList } from '@/components/admin/TodoList';

const AreaChartWidget = dynamic(() => import('@/components/admin/charts/AreaChartWidget').then(m => ({ default: m.AreaChartWidget })), {
  ssr: false,
  loading: () => <div className="h-64 animate-pulse bg-white/5 rounded-xl" />,
});
const PieChartWidget = dynamic(() => import('@/components/admin/charts/PieChartWidget').then(m => ({ default: m.PieChartWidget })), {
  ssr: false,
  loading: () => <div className="h-64 animate-pulse bg-white/5 rounded-xl" />,
});
import type { OverviewStats } from '@/types/admin';

export default function OverviewPage() {
  const [data, setData] = useState<OverviewStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/overview');
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
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl sm:text-2xl font-bold">Overview</h1>
        <RefreshButton onClick={fetchData} isLoading={loading} />
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        <StatCard icon={Users} label="Users" value={data.totalUsers} />
        <StatCard icon={Radio} label="Podcasts" value={data.totalPodcasts} />
        <StatCard icon={Layers} label="Episodes" value={data.totalEpisodes} />
        <StatCard icon={FileText} label="Summaries Ready" value={data.summariesReady} />
        <StatCard icon={TrendingUp} label="Queue Depth" value={data.queueDepth} />
        <StatCard icon={AlertTriangle} label="Failure Rate" value={`${data.failureRate}%`} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="User Signups">
          <AreaChartWidget data={data.signupsOverTime} />
        </ChartCard>
        <ChartCard title="AI Summary Status">
          <PieChartWidget data={data.aiStatusBreakdown} />
        </ChartCard>
      </div>

      {/* Recent Activity */}
      <DataTable
        columns={[
          { key: 'type', label: 'Type' },
          { key: 'description', label: 'Description' },
          {
            key: 'timestamp',
            label: 'Time',
            sortable: true,
            render: (row) => new Date(row.timestamp as string).toLocaleString(),
          },
        ]}
        data={data.recentActivity as Record<string, unknown>[]}
      />

      {/* Todo List */}
      <TodoList />
    </div>
  );
}
