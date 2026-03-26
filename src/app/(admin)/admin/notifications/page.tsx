'use client';

import { useState, useEffect, useCallback } from 'react';
import { Send, Clock, AlertTriangle, MessageSquare } from 'lucide-react';
import dynamic from 'next/dynamic';
import { StatCard } from '@/components/admin/StatCard';
import { ChartCard } from '@/components/admin/ChartCard';
import { DataTable } from '@/components/admin/DataTable';
import { RefreshButton } from '@/components/admin/RefreshButton';

const AreaChartWidget = dynamic(() => import('@/components/admin/charts/AreaChartWidget').then(m => ({ default: m.AreaChartWidget })), { ssr: false, loading: () => <div className="h-64 animate-pulse bg-white/5 rounded-xl" /> });
const PieChartWidget = dynamic(() => import('@/components/admin/charts/PieChartWidget').then(m => ({ default: m.PieChartWidget })), { ssr: false, loading: () => <div className="h-64 animate-pulse bg-white/5 rounded-xl" /> });
const BarChartWidget = dynamic(() => import('@/components/admin/charts/BarChartWidget').then(m => ({ default: m.BarChartWidget })), { ssr: false, loading: () => <div className="h-64 animate-pulse bg-white/5 rounded-xl" /> });
import { Button } from '@/components/ui/button';
import type { AdminNotificationData } from '@/types/notifications';

export default function NotificationsPage() {
  const [data, setData] = useState<AdminNotificationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/notifications');
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAction = async (id: string, action: 'resend' | 'cancel' | 'force-send') => {
    setActionLoading(`${id}-${action}`);
    try {
      const res = await fetch(`/api/admin/notifications/${id}/${action}`, { method: 'POST' });
      if (res.ok) {
        await fetchData();
      }
    } finally {
      setActionLoading(null);
    }
  };

  if (loading && !data) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" /></div>;
  }
  if (!data) return null;

  const statusColors: Record<string, string> = {
    sent: 'text-green-600 dark:text-green-400',
    failed: 'text-red-600 dark:text-red-400',
    pending: 'text-yellow-600 dark:text-yellow-400',
    cancelled: 'text-muted-foreground',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl sm:text-2xl font-bold">Notifications</h1>
        <RefreshButton onClick={fetchData} isLoading={loading} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        <StatCard icon={Send} label="Total Sent" value={data.metrics.totalSent} />
        <StatCard icon={Send} label="Sent Today" value={data.metrics.sentToday} />
        <StatCard icon={Clock} label="Pending" value={data.metrics.pending} />
        <StatCard icon={AlertTriangle} label="Failure Rate" value={`${data.metrics.failureRate}%`} />
        <StatCard icon={MessageSquare} label="Telegram Links" value={data.metrics.activeTelegramConnections} />
      </div>

      <ChartCard title="Notifications Over Time (sent)">
        <AreaChartWidget data={data.notificationsOverTime} />
      </ChartCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="By Channel">
          <PieChartWidget data={data.byChannel} />
        </ChartCard>
        <ChartCard title="Scheduled vs Instant">
          <BarChartWidget data={data.scheduledVsInstant} />
        </ChartCard>
      </div>

      <h2 className="text-lg font-semibold">Pending Notifications</h2>
      <DataTable
        columns={[
          { key: 'episode_title', label: 'Episode', render: (row) => {
            const title = row.episode_title as string;
            return title.length > 40 ? title.slice(0, 40) + '...' : title;
          }},
          { key: 'channel', label: 'Channel', render: (row) => (
            <span className="capitalize">{row.channel as string}</span>
          )},
          { key: 'recipient', label: 'Recipient', render: (row) => {
            const r = row.recipient as string;
            return r.length > 25 ? r.slice(0, 25) + '...' : r;
          }},
          { key: 'created_at', label: 'Queued', sortable: true, render: (row) =>
            new Date(row.created_at as string).toLocaleString()
          },
          { key: 'actions', label: 'Actions', render: (row) => (
            <div className="flex gap-1 sm:gap-2">
              <Button
                size="sm"
                variant="outline"
                className="text-xs px-2 sm:px-3"
                onClick={() => handleAction(row.id as string, 'force-send')}
                disabled={actionLoading === `${row.id}-force-send`}
              >
                {actionLoading === `${row.id}-force-send` ? '...' : 'Send'}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-red-600 hover:text-red-700 text-xs px-2 sm:px-3"
                onClick={() => handleAction(row.id as string, 'cancel')}
                disabled={actionLoading === `${row.id}-cancel`}
              >
                {actionLoading === `${row.id}-cancel` ? '...' : 'Cancel'}
              </Button>
            </div>
          )},
        ]}
        data={data.pendingList as unknown as Record<string, unknown>[]}
      />

      <h2 className="text-lg font-semibold">Recent Sends</h2>
      <DataTable
        columns={[
          { key: 'episode_title', label: 'Episode', render: (row) => {
            const title = row.episode_title as string;
            return title.length > 40 ? title.slice(0, 40) + '...' : title;
          }},
          { key: 'channel', label: 'Channel', render: (row) => (
            <span className="capitalize">{row.channel as string}</span>
          )},
          { key: 'status', label: 'Status', render: (row) => (
            <span className={statusColors[row.status as string] || ''}>
              {row.status as string}
            </span>
          )},
          { key: 'error_message', label: 'Error', render: (row) => {
            if (!row.error_message) return <span className="text-muted-foreground">-</span>;
            const msg = row.error_message as string;
            return <span className="text-red-600 dark:text-red-400 text-xs">{msg.length > 60 ? msg.slice(0, 60) + '...' : msg}</span>;
          }},
          { key: 'sent_at', label: 'Time', sortable: true, render: (row) =>
            row.sent_at ? new Date(row.sent_at as string).toLocaleString() : new Date(row.updated_at as string).toLocaleString()
          },
          { key: 'actions', label: '', render: (row) => {
            if (row.status !== 'failed') return null;
            return (
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleAction(row.id as string, 'resend')}
                disabled={actionLoading === `${row.id}-resend`}
              >
                {actionLoading === `${row.id}-resend` ? '...' : 'Resend'}
              </Button>
            );
          }},
        ]}
        data={data.recentSends as unknown as Record<string, unknown>[]}
      />
    </div>
  );
}
