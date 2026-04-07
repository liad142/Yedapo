'use client';

import Link from 'next/link';
import { CreditCard, Sparkles, ArrowRight } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useUsage } from '@/contexts/UsageContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { UsageMeter } from '@/components/UsageMeter';
import { PLAN_META, PRICING } from '@/lib/plans';
import type { UserPlan } from '@/lib/plans';

export default function BillingPage() {
  const { user } = useAuth();
  const { usage } = useUsage();
  const userPlan: UserPlan = usage?.plan ?? 'free';
  const meta = PLAN_META[userPlan];

  if (!user) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Sign in to view billing.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Current Plan */}
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-foreground">{meta.label}</h3>
              <Badge variant={userPlan === 'pro' ? 'default' : 'secondary'} className="text-xs">
                {userPlan === 'pro' ? `$${PRICING.pro.monthly}/mo` : 'Free'}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">{meta.description}</p>
          </div>

          {userPlan === 'free' ? (
            <Button
              className="gap-2 bg-gradient-to-r from-primary to-[#8b5cf6] text-white hover:opacity-90"
              asChild
            >
              <Link href="/pricing">
                <Sparkles className="h-4 w-4" />
                Upgrade to Explorer
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          ) : (
            <Button variant="ghost" size="sm">
              Manage Subscription
            </Button>
          )}
        </div>
      </div>

      {/* Today's Usage */}
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-foreground">Today&apos;s Usage</h3>
          <p className="text-xs text-muted-foreground">Resets daily at midnight</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UsageMeter
            label="Summaries"
            used={usage?.summary?.used ?? 0}
            limit={usage?.summary?.limit ?? 3}
          />
          <UsageMeter
            label="Ask AI"
            used={usage?.askAi?.used ?? 0}
            limit={usage?.askAi?.limit ?? 5}
          />
        </div>
      </div>

      {/* Billing History */}
      <div className="rounded-2xl border border-dashed border-border p-8 text-center">
        <CreditCard className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">Billing history will appear here.</p>
        <p className="text-xs text-muted-foreground mt-1">
          No charges yet — you&apos;re on the {meta.label} plan.
        </p>
      </div>
    </div>
  );
}
