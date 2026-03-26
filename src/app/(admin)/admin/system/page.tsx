'use client';

import { useState, useEffect, useCallback } from 'react';
import { Activity, Clock, Database } from 'lucide-react';
import { StatCard } from '@/components/admin/StatCard';
import { DataTable } from '@/components/admin/DataTable';
import { RefreshButton } from '@/components/admin/RefreshButton';
import type { SystemHealth } from '@/types/admin';

export default function SystemPage() {
  const [data, setData] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/system');
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
        <h1 className="text-xl sm:text-2xl font-bold">System Health</h1>
        <RefreshButton onClick={fetchData} isLoading={loading} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
        <StatCard
          icon={Activity}
          label="Redis Status"
          value={data.redis.connected ? 'Connected' : 'Down'}
          className={data.redis.connected ? '' : 'border-red-500/50'}
        />
        <StatCard icon={Clock} label="Latency" value={`${data.redis.latencyMs}ms`} />
        <StatCard icon={Database} label="Cache Keys" value={data.redis.cacheKeys} />
      </div>

      <h2 className="text-lg font-semibold">Error Log</h2>
      <DataTable
        columns={[
          { key: 'type', label: 'Type' },
          {
            key: 'message',
            label: 'Error',
            render: (row) => {
              const msg = row.message as string;
              return <span className="text-red-600 dark:text-red-400 text-xs">{msg.length > 100 ? msg.slice(0, 100) + '...' : msg}</span>;
            },
          },
          {
            key: 'episode_id',
            label: 'Episode',
            render: (row) => {
              const id = row.episode_id as string | undefined;
              return id ? id.slice(0, 8) + '...' : '—';
            },
          },
          {
            key: 'timestamp',
            label: 'Time',
            sortable: true,
            render: (row) => new Date(row.timestamp as string).toLocaleString(),
          },
        ]}
        data={data.recentErrors as unknown as Record<string, unknown>[]}
      />
    </div>
  );
}
