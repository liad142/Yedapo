'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { useUsage } from '@/contexts/UsageContext';
import { UsageMeter } from '@/components/UsageMeter';
import { PLAN_META } from '@/lib/plans';
import type { UserPlan } from '@/lib/plans';
import { FieldLabel } from './SectionLabel';

/**
 * Teaser plan summary shown in Profile tab.
 * Canonical Plan & Usage UI lives in /settings/billing.
 */
export function PlanSummaryCard() {
  const { usage } = useUsage();
  if (!usage) return null;

  const meta = PLAN_META[usage.plan as UserPlan] || PLAN_META.free;

  return (
    <div>
      <FieldLabel>Your Plan</FieldLabel>
      <div className="mt-2 p-4 rounded-2xl bg-card border border-border space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-foreground">{meta.label} Plan</span>
          {usage.resetsAt && (
            <span className="text-[11px] text-muted-foreground">
              Resets{' '}
              {new Date(usage.resetsAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          )}
        </div>
        <UsageMeter
          label="Summaries"
          used={usage.summary.used}
          limit={usage.summary.limit}
          variant="sidebar"
        />
        <UsageMeter
          label="Questions"
          used={usage.askAi.used}
          limit={usage.askAi.limit}
          variant="sidebar"
        />
        <Link
          href="/settings/billing"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors pt-1"
        >
          Manage subscription
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}
