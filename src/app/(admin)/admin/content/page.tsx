'use client';

import { useState, useEffect, useCallback } from 'react';
import { Radio, Layers, Youtube } from 'lucide-react';
import dynamic from 'next/dynamic';
import { StatCard } from '@/components/admin/StatCard';
import { ChartCard } from '@/components/admin/ChartCard';
import { DataTable } from '@/components/admin/DataTable';
import { RefreshButton } from '@/components/admin/RefreshButton';

const AreaChartWidget = dynamic(() => import('@/components/admin/charts/AreaChartWidget').then(m => ({ default: m.AreaChartWidget })), { ssr: false, loading: () => <div className="h-64 animate-pulse bg-white/5 rounded-xl" /> });
const BarChartWidget = dynamic(() => import('@/components/admin/charts/BarChartWidget').then(m => ({ default: m.BarChartWidget })), { ssr: false, loading: () => <div className="h-64 animate-pulse bg-white/5 rounded-xl" /> });
import type { ContentAnalytics } from '@/types/admin';

export default function ContentPage() {
  const [data, setData] = useState<ContentAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/content');
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
        <h1 className="text-xl sm:text-2xl font-bold">Content</h1>
        <RefreshButton onClick={fetchData} isLoading={loading} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
        <StatCard icon={Radio} label="Podcasts" value={data.totalPodcasts} />
        <StatCard icon={Layers} label="Episodes" value={data.totalEpisodes} />
        <StatCard icon={Youtube} label="YouTube Channels" value={data.youtubeChannels} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Episodes Added (by Week)">
          <AreaChartWidget data={data.episodesOverTime} />
        </ChartCard>
        <ChartCard title="Podcasts by Language">
          <BarChartWidget data={data.podcastsByLanguage} />
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Top Podcasts (by Episodes)</h2>
          <DataTable
            columns={[
              { key: 'title', label: 'Podcast' },
              { key: 'episode_count', label: 'Episodes', sortable: true },
            ]}
            data={data.topPodcasts as unknown as Record<string, unknown>[]}
          />
        </div>
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Top YouTube Channels</h2>
          <DataTable
            columns={[
              { key: 'title', label: 'Channel' },
              { key: 'follow_count', label: 'Followers', sortable: true },
            ]}
            data={data.topYoutubeChannels as unknown as Record<string, unknown>[]}
          />
        </div>
      </div>
    </div>
  );
}
