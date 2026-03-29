'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { FileText, Brain, Layers, AlertTriangle, RotateCcw, Loader2, Clock, Zap, Youtube } from 'lucide-react';
import dynamic from 'next/dynamic';
import { StatCard } from '@/components/admin/StatCard';
import { ChartCard } from '@/components/admin/ChartCard';
import { DataTable } from '@/components/admin/DataTable';
import { RefreshButton } from '@/components/admin/RefreshButton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

const AreaChartWidget = dynamic(() => import('@/components/admin/charts/AreaChartWidget').then(m => ({ default: m.AreaChartWidget })), { ssr: false, loading: () => <div className="h-64 animate-pulse bg-white/5 rounded-xl" /> });
const StatusBreakdown = dynamic(() => import('@/components/admin/charts/StatusBreakdown').then(m => ({ default: m.StatusBreakdown })), { ssr: false, loading: () => <div className="h-64 animate-pulse bg-white/5 rounded-xl" /> });
import type { AiAnalytics, YouTubePipelineRow } from '@/types/admin';

interface StuckItem {
  id: string;
  episode_id: string;
  episode_title: string;
  level?: string;
  language?: string;
  status: string;
  updated_at: string;
  stuck_minutes: number;
}

interface StuckData {
  stuckSummaries: StuckItem[];
  stuckTranscripts: StuckItem[];
}

export default function AiPage() {
  const [data, setData] = useState<AiAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [stuck, setStuck] = useState<StuckData | null>(null);
  const [resetting, setResetting] = useState<string | null>(null);
  const [youtubeRows, setYouTubeRows] = useState<YouTubePipelineRow[]>([]);
  const [youtubeStatus, setYouTubeStatus] = useState('all');
  const [youtubeLevel, setYouTubeLevel] = useState('all');

  const fetchData = useCallback(async (status = youtubeStatus, level = youtubeLevel) => {
    setLoading(true);
    try {
      const youtubeParams = new URLSearchParams({ status, level, limit: '100' });
      const [aiRes, stuckRes, youtubeRes] = await Promise.all([
        fetch('/api/admin/ai'),
        fetch('/api/admin/ai/stuck'),
        fetch(`/api/admin/ai/youtube-pipeline?${youtubeParams.toString()}`),
      ]);
      if (aiRes.ok) setData(await aiRes.json());
      if (stuckRes.ok) setStuck(await stuckRes.json());
      if (youtubeRes.ok) {
        const payload = await youtubeRes.json();
        setYouTubeRows(payload.rows ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [youtubeLevel, youtubeStatus]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (data) {
      fetchData(youtubeStatus, youtubeLevel);
    }
  }, [youtubeStatus, youtubeLevel]);

  const resetStuck = async (type: 'summary' | 'transcript' | 'all', ids?: string[]) => {
    setResetting(type);
    try {
      const res = await fetch('/api/admin/ai/stuck', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, ids }),
      });
      if (res.ok) {
        await fetchData();
      }
    } finally {
      setResetting(null);
    }
  };

  const youtubeUserCount = useMemo(() => new Set(youtubeRows.map(row => row.requested_by_user_id).filter(Boolean)).size, [youtubeRows]);
  const youtubeVideoCount = useMemo(() => new Set(youtubeRows.map(row => row.episode_id)).size, [youtubeRows]);

  if (loading && !data) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" /></div>;
  }
  if (!data) return null;

  // Build status breakdown from summariesByLevelAndStatus
  const summaryStatusTotals: Record<string, number> = {};
  data.summariesByLevelAndStatus.forEach(s => {
    summaryStatusTotals[s.status] = (summaryStatusTotals[s.status] || 0) + s.count;
  });

  const statusColors: Record<string, string> = {
    ready: 'bg-green-500',
    queued: 'bg-yellow-500',
    transcribing: 'bg-blue-500',
    summarizing: 'bg-blue-400',
    failed: 'bg-red-500',
    not_ready: 'bg-gray-400',
  };

  const summaryBreakdown = Object.entries(summaryStatusTotals).map(([label, value]) => ({
    label,
    value,
    color: statusColors[label] || 'bg-gray-400',
  }));

  const transcriptBreakdown = data.transcriptsByStatus.map(t => ({
    label: t.label,
    value: t.count,
    color: statusColors[t.label] || 'bg-gray-400',
  }));

  const hasStuckItems = stuck ? (stuck.stuckSummaries.length > 0 || stuck.stuckTranscripts.length > 0) : false;
  const stuckCount = stuck ? stuck.stuckSummaries.length + stuck.stuckTranscripts.length : 0;
  const youtubeHealth = data.youtubeSummaryHealth ?? {
    totalSummaries: 0,
    queuedSummaries: 0,
    failedSummaries: 0,
    failureRate: 0,
    totalTranscripts: 0,
    failedTranscripts: 0,
    youtubeChannels: 0,
    recentFailures: [],
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl sm:text-2xl font-bold">AI Pipeline</h1>
        <RefreshButton onClick={() => fetchData()} isLoading={loading} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard icon={FileText} label="Total Summaries" value={data.totalSummaries} />
        <StatCard icon={Brain} label="Total Transcripts" value={data.totalTranscripts} />
        <StatCard icon={Layers} label="Queue Depth" value={data.queueDepth} />
        <StatCard icon={AlertTriangle} label="Failure Rate" value={`${data.failureRate}%`} />
      </div>

      <ChartCard title="Generation Over Time (completed summaries)">
        <AreaChartWidget data={data.generationOverTime} />
      </ChartCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Summary Status">
          <StatusBreakdown items={summaryBreakdown} />
        </ChartCard>
        <ChartCard title="Transcript Status">
          <StatusBreakdown items={transcriptBreakdown} />
        </ChartCard>
      </div>

      {/* Stuck Pipeline Controls — always visible */}
      <Card className={hasStuckItems ? 'border-yellow-500/30 bg-yellow-500/5' : ''}>
        <CardContent className="p-3 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <Clock className={`h-5 w-5 ${hasStuckItems ? 'text-yellow-500' : 'text-muted-foreground'}`} />
              <h2 className="text-lg font-semibold">Stuck Pipeline Items</h2>
              {hasStuckItems && (
                <Badge variant="outline" className="text-yellow-600 border-yellow-500">
                  {stuckCount}
                </Badge>
              )}
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => resetStuck('all')}
              disabled={resetting !== null || !hasStuckItems}
            >
              {resetting === 'all' ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Zap className="h-4 w-4 mr-1" />}
              Reset All Stuck
            </Button>
          </div>

          {!hasStuckItems && (
            <p className="text-sm text-muted-foreground">No stuck items in the pipeline.</p>
          )}

          {stuck && stuck.stuckSummaries.length > 0 && (
            <div className="mb-4">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <h3 className="text-sm font-medium text-muted-foreground">
                  Summaries ({stuck.stuckSummaries.length})
                </h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => resetStuck('summary')}
                  disabled={resetting !== null}
                >
                  {resetting === 'summary' ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <RotateCcw className="h-3 w-3 mr-1" />}
                  Reset Summaries
                </Button>
              </div>
              <div className="space-y-1">
                {stuck.stuckSummaries.map((s) => (
                  <div key={s.id} className="flex items-center justify-between gap-2 text-sm py-1.5 px-3 rounded bg-white/5">
                    <span className="truncate min-w-0" title={s.episode_title}>{s.episode_title}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="outline" className="text-xs hidden sm:inline-flex">
                        {s.status} · {s.level}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{s.stuck_minutes}m</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => resetStuck('summary', [s.id])}
                        disabled={resetting !== null}
                      >
                        <RotateCcw className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {stuck && stuck.stuckTranscripts.length > 0 && (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <h3 className="text-sm font-medium text-muted-foreground">
                  Transcripts ({stuck.stuckTranscripts.length})
                </h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => resetStuck('transcript')}
                  disabled={resetting !== null}
                >
                  {resetting === 'transcript' ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <RotateCcw className="h-3 w-3 mr-1" />}
                  Reset Transcripts
                </Button>
              </div>
              <div className="space-y-1">
                {stuck.stuckTranscripts.map((t) => (
                  <div key={t.id} className="flex items-center justify-between gap-2 text-sm py-1.5 px-3 rounded bg-white/5">
                    <span className="truncate min-w-0" title={t.episode_title}>{t.episode_title}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="outline" className="text-xs hidden sm:inline-flex">{t.status}</Badge>
                      <span className="text-xs text-muted-foreground">{t.stuck_minutes}m</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => resetStuck('transcript', [t.id])}
                        disabled={resetting !== null}
                      >
                        <RotateCcw className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">YouTube Summary Health</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatCard icon={Youtube} label="YouTube Summaries" value={youtubeHealth.totalSummaries} />
          <StatCard icon={Layers} label="YouTube Queue" value={youtubeHealth.queuedSummaries} />
          <StatCard icon={AlertTriangle} label="YouTube Failure Rate" value={`${youtubeHealth.failureRate}%`} />
          <StatCard icon={Brain} label="YouTube Channels" value={youtubeHealth.youtubeChannels} />
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatCard icon={FileText} label="Visible Videos" value={youtubeVideoCount} />
          <StatCard icon={Brain} label="Visible Users" value={youtubeUserCount} />
          <StatCard icon={FileText} label="YouTube Transcripts" value={youtubeHealth.totalTranscripts} />
          <StatCard icon={AlertTriangle} label="Failed Transcripts" value={youtubeHealth.failedTranscripts} />
        </div>

        <div className="flex flex-wrap gap-2">
          <select
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={youtubeStatus}
            onChange={(e) => setYouTubeStatus(e.target.value)}
          >
            <option value="all">All statuses</option>
            <option value="ready">Ready</option>
            <option value="failed">Failed</option>
            <option value="queued">Queued</option>
            <option value="transcribing">Transcribing</option>
            <option value="summarizing">Summarizing</option>
          </select>
          <select
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={youtubeLevel}
            onChange={(e) => setYouTubeLevel(e.target.value)}
          >
            <option value="all">All levels</option>
            <option value="quick">Quick</option>
            <option value="deep">Deep</option>
          </select>
        </div>

        <DataTable
          columns={[
            { key: 'episode_title', label: 'Episode', render: (row) => {
              const title = row.episode_title as string;
              return title.length > 42 ? title.slice(0, 42) + '...' : title;
            }},
            { key: 'podcast_title', label: 'Channel', render: (row) => {
              const title = row.podcast_title as string;
              return title.length > 28 ? title.slice(0, 28) + '...' : title;
            }},
            { key: 'requested_by_email', label: 'User', render: (row) => (row.requested_by_email as string) || ((row.requested_by_user_id as string) ? String(row.requested_by_user_id).slice(0, 8) + '...' : '-') },
            { key: 'level', label: 'Level' },
            { key: 'summary_status', label: 'Summary', sortable: true },
            { key: 'transcript_status', label: 'Transcript', sortable: true },
            { key: 'transcript_provider', label: 'Provider' },
            { key: 'summary_error', label: 'Error', render: (row) => {
              const msg = (row.summary_error as string) || (row.transcript_error as string) || '-';
              return <span className="text-xs">{msg.length > 52 ? msg.slice(0, 52) + '...' : msg}</span>;
            }},
            {
              key: 'updated_at',
              label: 'Updated',
              sortable: true,
              render: (row) => new Date(row.updated_at as string).toLocaleString(),
            },
          ]}
          data={youtubeRows as unknown as Record<string, unknown>[]}
        />
      </div>

      <h2 className="text-lg font-semibold">Recent Failures</h2>
      <DataTable
        columns={[
          { key: 'type', label: 'Type' },
          { key: 'episode_title', label: 'Episode', render: (row) => {
            const title = row.episode_title as string;
            return title.length > 50 ? title.slice(0, 50) + '...' : title;
          }},
          { key: 'error_message', label: 'Error', render: (row) => {
            const msg = (row.error_message as string) || 'Unknown';
            return <span className="text-red-600 dark:text-red-400 text-xs">{msg.length > 80 ? msg.slice(0, 80) + '...' : msg}</span>;
          }},
          {
            key: 'failed_at',
            label: 'Time',
            sortable: true,
            render: (row) => new Date(row.failed_at as string).toLocaleString(),
          },
        ]}
        data={data.recentFailures as unknown as Record<string, unknown>[]}
      />
    </div>
  );
}
