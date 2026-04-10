'use client';

import { Suspense, useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  CreditCard,
  Sparkles,
  ArrowRight,
  CheckCircle,
  ExternalLink,
  LifeBuoy,
  Loader2,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useUsage } from '@/contexts/UsageContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Toast } from '@/components/ui/toast';
import { UsageMeter } from '@/components/UsageMeter';
import { PLAN_META, PRICING } from '@/lib/plans';
import type { UserPlan } from '@/lib/plans';

export default function BillingPage() {
  return (
    <Suspense>
      <BillingContent />
    </Suspense>
  );
}

function BillingContent() {
  const { user } = useAuth();
  const { usage } = useUsage();
  const searchParams = useSearchParams();
  const [isPortalLoading, setIsPortalLoading] = useState(false);
  const [hasStripeCustomer, setHasStripeCustomer] = useState<boolean | null>(null);
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const userPlan: UserPlan = usage?.plan ?? 'free';
  const meta = PLAN_META[userPlan];
  const isSuccess = searchParams.get('success') === 'true';

  // Check whether the user has a real Stripe customer on file.
  // Users whose plan was manually assigned by support will have plan='pro'
  // but no stripe_customer_id — the billing portal can't help them.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/stripe/portal');
        if (!res.ok) {
          if (!cancelled) setHasStripeCustomer(false);
          return;
        }
        const data = await res.json();
        if (!cancelled) setHasStripeCustomer(!!data.hasCustomer);
      } catch {
        if (!cancelled) setHasStripeCustomer(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const handleManageSubscription = async () => {
    setIsPortalLoading(true);
    setErrorToast(null);
    try {
      const res = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorToast(data.error || 'Failed to open billing portal');
        return;
      }

      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      setErrorToast('Failed to open billing portal. Please try again.');
    } finally {
      setIsPortalLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Sign in to view billing.
      </div>
    );
  }

  // True only when we've confirmed there's no Stripe customer AND the user is
  // on a paid plan. Don't block free users from the upgrade CTA.
  const showManualPlanNotice =
    userPlan === 'pro' && hasStripeCustomer === false;

  return (
    <div className="space-y-6">
      {/* Success Banner */}
      {isSuccess && (
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 flex items-center gap-3">
          <CheckCircle className="h-5 w-5 text-primary shrink-0" />
          <div>
            <p className="text-sm font-semibold text-foreground">Welcome to Pro!</p>
            <p className="text-xs text-muted-foreground">
              Your subscription is active. Enjoy unlimited AI summaries, Ask AI, and all Pro features.
            </p>
          </div>
        </div>
      )}

      {/* Current Plan */}
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-foreground">{meta.label}</h3>
              <Badge
                variant={userPlan === 'pro' ? 'default' : 'secondary'}
                className="text-xs"
              >
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
                Upgrade to Pro
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          ) : showManualPlanNotice ? null : (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleManageSubscription}
              disabled={isPortalLoading || hasStripeCustomer === null}
              className="gap-2"
            >
              {isPortalLoading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Loading...
                </>
              ) : (
                <>
                  <ExternalLink className="h-3.5 w-3.5" />
                  Manage Subscription
                </>
              )}
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
        <div className="grid grid-cols-1 gap-4">
          <UsageMeter
            label="Summaries"
            used={usage?.summary?.used ?? 0}
            limit={usage?.summary?.limit ?? 3}
          />
        </div>
      </div>

      {/* Billing History / Manage / Manual plan notice */}
      {showManualPlanNotice ? (
        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <LifeBuoy className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-foreground">
                Plan assigned by support
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Your Pro plan was activated manually and isn&apos;t linked to a Stripe
                subscription, so there&apos;s no self-serve billing portal. Contact us if
                you need to change payment details or cancel.
              </p>
              <Button variant="outline" size="sm" className="mt-3 gap-2" asChild>
                <a href="mailto:support@yedapo.com?subject=Billing%20question">
                  <LifeBuoy className="h-3.5 w-3.5" />
                  Contact support
                </a>
              </Button>
            </div>
          </div>
        </div>
      ) : userPlan === 'pro' ? (
        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-foreground">Billing</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            Manage your payment method, view invoices, or cancel your subscription from
            the Stripe billing portal.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={handleManageSubscription}
            disabled={isPortalLoading || hasStripeCustomer === null}
            className="mt-3 gap-2"
          >
            {isPortalLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ExternalLink className="h-3.5 w-3.5" />
            )}
            Open Billing Portal
          </Button>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center">
          <CreditCard className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Billing history will appear here.</p>
          <p className="text-xs text-muted-foreground mt-1">
            No charges yet — you&apos;re on the {meta.label} plan.
          </p>
        </div>
      )}

      {/* Error Toast */}
      <Toast open={!!errorToast} onOpenChange={() => setErrorToast(null)} position="top">
        <p className="text-sm text-destructive font-medium">{errorToast}</p>
      </Toast>
    </div>
  );
}
