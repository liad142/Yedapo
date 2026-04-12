'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Brain, Mic, Database, Server, Mail,
  Layers, ExternalLink, CheckCircle2, AlertTriangle,
  XCircle, MinusCircle, BarChart3, Globe, DollarSign,
} from 'lucide-react';
import { YouTubeIcon } from '@/components/icons/BrandIcons';
import { cn } from '@/lib/utils';
import { elevation } from '@/lib/elevation';
import { RefreshButton } from '@/components/admin/RefreshButton';
import type { ProvidersResponse, ProviderData, ProviderMetric, ProviderBilling } from '@/app/api/admin/providers/route';

// ---------------------------------------------------------------------------
// Cost summary bar
// ---------------------------------------------------------------------------

function CostSummaryBar({ providers }: { providers: ProvidersResponse['providers'] }) {
  const entries = Object.entries(providers) as [string, ProviderData][];

  const items = entries
    .filter(([, p]) => p.billing?.plan || p.billing?.estimatedMonthly)
    .map(([key, p]) => ({
      name: PROVIDER_META[key as keyof typeof PROVIDER_META]?.name ?? key,
      plan: p.billing?.plan ?? '—',
      cost: p.billing?.estimatedMonthly ?? '?',
      balance: p.billing?.balance,
    }));

  // Sum known fixed monthly costs (strip ~ and /mo)
  const knownFixed = items.reduce((sum, item) => {
    const raw = item.cost.replace(/[~$\/mo\s]/g, '');
    const n = parseFloat(raw);
    return isNaN(n) ? sum : sum + n;
  }, 0);

  return (
    <div className={cn(elevation.card, 'rounded-xl p-5')}>
      <div className="flex items-center gap-2 mb-4">
        <DollarSign className="h-5 w-5 text-primary" />
        <h2 className="font-semibold text-sm">Estimated Monthly Costs</h2>
        <span className="ml-auto text-xs text-muted-foreground">
          Known fixed: <span className="font-bold text-foreground">${knownFixed.toFixed(0)}/mo</span>
          <span className="ml-1 text-muted-foreground">(pay-as-you-go excluded)</span>
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2">
        {items.map((item) => (
          <div key={item.name} className="flex flex-col gap-0.5 px-3 py-2 rounded-lg bg-muted/40 border border-border/50">
            <span className="text-[11px] text-muted-foreground truncate">{item.name}</span>
            <span className="text-sm font-bold text-foreground">{item.cost}</span>
            <span className="text-[10px] text-muted-foreground truncate">{item.plan}</span>
            {item.balance && (
              <span className="text-[10px] text-green-600 truncate">{item.balance}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Provider metadata (name + icon per key)
// ---------------------------------------------------------------------------

const PROVIDER_META = {
  gemini:   { name: 'Gemini',          icon: <Brain className="h-5 w-5 text-teal-600" /> },
  deepgram: { name: 'Deepgram',        icon: <Mic className="h-5 w-5 text-indigo-600" /> },
  voxtral:  { name: 'Voxtral (Mistral)', icon: <Mic className="h-5 w-5 text-orange-500" /> },
  supadata: { name: 'Supadata',        icon: <YouTubeIcon className="h-5 w-5" /> },
  posthog:  { name: 'PostHog',         icon: <BarChart3 className="h-5 w-5 text-orange-600" /> },
  supabase: { name: 'Supabase',        icon: <Database className="h-5 w-5 text-emerald-600" /> },
  redis:    { name: 'Redis (Upstash)', icon: <Server className="h-5 w-5 text-purple-600" /> },
  youtube:  { name: 'YouTube Data API', icon: <YouTubeIcon className="h-5 w-5" /> },
  qstash:   { name: 'QStash (Upstash)', icon: <Layers className="h-5 w-5 text-violet-600" /> },
  resend:   { name: 'Resend',          icon: <Mail className="h-5 w-5 text-blue-600" /> },
  vercel:   { name: 'Vercel',          icon: <Globe className="h-5 w-5 text-foreground" /> },
} as const;

// ---------------------------------------------------------------------------
// Status config
// ---------------------------------------------------------------------------

const STATUS_CONFIG = {
  ok:           { label: 'OK',             icon: CheckCircle2, classes: 'text-green-600 bg-green-50 border-green-200 dark:bg-green-950/40 dark:border-green-800' },
  warn:         { label: 'Warning',        icon: AlertTriangle, classes: 'text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:border-amber-800' },
  error:        { label: 'Error',          icon: XCircle, classes: 'text-red-600 bg-red-50 border-red-200 dark:bg-red-950/40 dark:border-red-800' },
  unconfigured: { label: 'Not configured', icon: MinusCircle, classes: 'text-muted-foreground bg-muted/40 border-border' },
} as const;

// ---------------------------------------------------------------------------
// Billing badge
// ---------------------------------------------------------------------------

function BillingSection({ billing }: { billing: ProviderBilling }) {
  return (
    <div className="mt-2 pt-2 border-t border-border/60 space-y-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Billing</span>
        {billing.plan && (
          <span className="text-[11px] font-semibold bg-primary/8 text-primary px-1.5 py-0.5 rounded-full border border-primary/15">
            {billing.plan}
          </span>
        )}
      </div>
      {billing.estimatedMonthly && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Est. monthly</span>
          <span className="text-sm font-bold text-foreground">{billing.estimatedMonthly}</span>
        </div>
      )}
      {billing.balance && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Balance</span>
          <span className="text-sm font-semibold text-green-600">{billing.balance}</span>
        </div>
      )}
      {billing.rateInfo && (
        <p className="text-[11px] text-muted-foreground italic leading-tight">{billing.rateInfo}</p>
      )}
      {billing.resetDate && (
        <p className="text-[11px] text-muted-foreground">{billing.resetDate}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Provider card
// ---------------------------------------------------------------------------

function ProviderCard({ name, icon, data }: { name: string; icon: React.ReactNode; data: ProviderData }) {
  const cfg = STATUS_CONFIG[data.status];
  const StatusIcon = cfg.icon;

  return (
    <div className={cn(elevation.card, 'rounded-xl p-5 flex flex-col gap-3')}>
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="leading-none shrink-0">{icon}</div>
          <span className="font-semibold text-sm">{name}</span>
        </div>
        <span className={cn('inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium shrink-0', cfg.classes)}>
          <StatusIcon className="h-3 w-3" />
          {cfg.label}
        </span>
      </div>

      {/* Metrics */}
      <div className="flex-1 space-y-2">
        {data.metrics.map((m: ProviderMetric, i: number) => (
          <div key={i} className="flex items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground leading-tight">{m.label}</span>
            <span className={cn(
              'text-sm font-semibold tabular-nums shrink-0',
              m.highlight && 'text-primary',
              m.warn && 'text-amber-600',
            )}>
              {m.value}
            </span>
          </div>
        ))}
        {data.metrics.length === 0 && (
          <p className="text-xs text-muted-foreground">No data available</p>
        )}
      </div>

      {/* Billing */}
      {data.billing && <BillingSection billing={data.billing} />}

      {/* Footer */}
      <div className="flex items-center justify-between gap-2 pt-1">
        {data.note ? (
          <p className="text-[11px] text-muted-foreground italic leading-tight max-w-[70%]">{data.note}</p>
        ) : (
          <span />
        )}
        <Link
          href={data.dashboardUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline shrink-0"
        >
          Dashboard <ExternalLink className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section
// ---------------------------------------------------------------------------

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-4">
        <h2 className="text-base font-semibold">{title}</h2>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {children}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ProvidersPage() {
  const [data, setData] = useState<ProvidersResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async (refresh = false) => {
    setLoading(true);
    try {
      const res = await fetch(refresh ? '/api/admin/providers?refresh=true' : '/api/admin/providers');
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
      </div>
    );
  }
  if (!data) return null;

  const { providers, period, fetchedAt } = data;

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Providers</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Usage & billing across all external providers · {period.label}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Last fetched: {new Date(fetchedAt).toLocaleTimeString()} · cached 5 min
          </p>
        </div>
        <RefreshButton onClick={() => fetchData(true)} isLoading={loading} />
      </div>

      {/* Cost summary */}
      <CostSummaryBar providers={providers} />

      {/* AI & Processing */}
      <Section title="AI & Processing" subtitle="Content generation and transcription">
        <ProviderCard {...PROVIDER_META.gemini}   data={providers.gemini} />
        <ProviderCard {...PROVIDER_META.deepgram} data={providers.deepgram} />
        <ProviderCard {...PROVIDER_META.voxtral}  data={providers.voxtral} />
        <ProviderCard {...PROVIDER_META.supadata} data={providers.supadata} />
      </Section>

      {/* Infrastructure */}
      <Section title="Infrastructure" subtitle="Database, cache, and job queue">
        <ProviderCard {...PROVIDER_META.supabase} data={providers.supabase} />
        <ProviderCard {...PROVIDER_META.redis}    data={providers.redis} />
        <ProviderCard {...PROVIDER_META.qstash}   data={providers.qstash} />
        <ProviderCard {...PROVIDER_META.vercel}   data={providers.vercel} />
      </Section>

      {/* Communication & APIs */}
      <Section title="Communication & APIs" subtitle="Email, analytics, and quota-tracked APIs">
        <ProviderCard {...PROVIDER_META.resend}   data={providers.resend} />
        <ProviderCard {...PROVIDER_META.posthog}  data={providers.posthog} />
        <ProviderCard {...PROVIDER_META.youtube}  data={providers.youtube} />
      </Section>
    </div>
  );
}
