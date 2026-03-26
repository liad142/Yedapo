'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Users, UserPlus, CheckCircle, ChevronDown, Trash2 } from 'lucide-react';
import dynamic from 'next/dynamic';
import { StatCard } from '@/components/admin/StatCard';
import { ChartCard } from '@/components/admin/ChartCard';
import { DataTable } from '@/components/admin/DataTable';
import { RefreshButton } from '@/components/admin/RefreshButton';

const AreaChartWidget = dynamic(() => import('@/components/admin/charts/AreaChartWidget').then(m => ({ default: m.AreaChartWidget })), { ssr: false, loading: () => <div className="h-64 animate-pulse bg-white/5 rounded-xl" /> });
const BarChartWidget = dynamic(() => import('@/components/admin/charts/BarChartWidget').then(m => ({ default: m.BarChartWidget })), { ssr: false, loading: () => <div className="h-64 animate-pulse bg-white/5 rounded-xl" /> });
const PieChartWidget = dynamic(() => import('@/components/admin/charts/PieChartWidget').then(m => ({ default: m.PieChartWidget })), { ssr: false, loading: () => <div className="h-64 animate-pulse bg-white/5 rounded-xl" /> });
import type { UserAnalytics } from '@/types/admin';

const PLANS = ['free', 'pro'] as const;

const PLAN_STYLES: Record<string, { badge: string; dot: string }> = {
  free:  { badge: 'bg-gray-100 text-gray-600', dot: 'bg-gray-400' },
  pro:   { badge: 'bg-blue-50 text-blue-700', dot: 'bg-blue-500' },
};

function PlanSelector({ userId, currentPlan, onChanged }: { userId: string; currentPlan: string; onChanged: (plan: string) => void }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  async function changePlan(plan: string) {
    if (plan === currentPlan) { setOpen(false); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/admin/users/plan', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, plan }),
      });
      if (res.ok) onChanged(plan);
    } finally {
      setSaving(false);
      setOpen(false);
    }
  }

  const style = PLAN_STYLES[currentPlan] || PLAN_STYLES.free;

  const btnRef = useRef<HTMLButtonElement>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      const dropdownHeight = PLANS.length * 30 + 8; // approximate
      const spaceBelow = window.innerHeight - rect.bottom;
      const openUpward = spaceBelow < dropdownHeight + 8;
      setMenuPos({
        top: openUpward ? rect.top - dropdownHeight - 4 : rect.bottom + 4,
        left: rect.left,
      });
    }
  }, [open]);

  return (
    <div className="inline-block">
      <button
        ref={btnRef}
        onClick={() => setOpen(!open)}
        disabled={saving}
        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition hover:shadow-sm ${style.badge} ${saving ? 'opacity-50' : 'cursor-pointer'}`}
      >
        {saving ? '...' : currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)}
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && menuPos && createPortal(
        <>
          <div className="fixed inset-0 z-[99]" onClick={() => setOpen(false)} />
          <div
            className="fixed z-[100] bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[110px]"
            style={{ top: menuPos.top, left: menuPos.left }}
          >
            {PLANS.map((p) => {
              const s = PLAN_STYLES[p];
              const active = p === currentPlan;
              return (
                <button
                  key={p}
                  onClick={() => changePlan(p)}
                  className={`w-full text-left px-3 py-1.5 text-xs transition flex items-center gap-2 hover:bg-gray-50 ${active ? 'font-semibold text-gray-900' : 'text-gray-600'}`}
                >
                  <span className={`inline-block w-2 h-2 rounded-full ${s.dot}`} />
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                  {active && <span className="ml-auto text-blue-500">&#10003;</span>}
                </button>
              );
            })}
          </div>
        </>,
        document.body,
      )}
    </div>
  );
}

export default function UsersPage() {
  const [data, setData] = useState<UserAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

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

  function handlePlanChanged(userId: string, newPlan: string) {
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        recentUsers: prev.recentUsers.map((u: any) =>
          u.id === userId ? { ...u, plan: newPlan } : u,
        ),
      };
    });
  }

  async function handleDeleteUser(userId: string) {
    setDeletingId(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, { method: 'DELETE' });
      if (res.ok) {
        setData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            totalUsers: prev.totalUsers - 1,
            recentUsers: prev.recentUsers.filter((u: any) => u.id !== userId),
          };
        });
      }
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  }

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
            render: (row) => (
              <PlanSelector
                userId={row.id as string}
                currentPlan={(row.plan as string) || 'free'}
                onChanged={(plan) => handlePlanChanged(row.id as string, plan)}
              />
            ),
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
          {
            key: 'actions',
            label: '',
            render: (row) => {
              const userId = row.id as string;
              if (confirmDeleteId === userId) {
                return (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleDeleteUser(userId)}
                      disabled={deletingId === userId}
                      className="px-2 py-1 text-xs font-medium text-white bg-red-600 rounded hover:bg-red-700 disabled:opacity-50"
                    >
                      {deletingId === userId ? '...' : 'Confirm'}
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700"
                    >
                      Cancel
                    </button>
                  </div>
                );
              }
              return (
                <button
                  onClick={() => setConfirmDeleteId(userId)}
                  className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50 transition-colors"
                  title="Delete user"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              );
            },
          },
        ]}
        data={data.recentUsers as unknown as Record<string, unknown>[]}
      />
    </div>
  );
}
