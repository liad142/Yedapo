'use client';

import { useState } from 'react';
import { Check, X, Sparkles, ArrowRight, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

/* ────────────────────────────────────────────────── */
/*  Types                                             */
/* ────────────────────────────────────────────────── */

type FeatureStatus = 'included' | 'excluded';

interface Feature {
  label: string;
  status: FeatureStatus;
}

export interface Tier {
  name: string;
  subtitle: string;
  iconName: 'headphones' | 'sparkles';
  price: number;
  priceSuffix: string;
  tagline: string;
  tagDescription: string;
  features: Feature[];
  cta: string;
  ctaDisabled?: boolean;
  highlighted?: boolean;
  badge?: string;
}

/* ────────────────────────────────────────────────── */
/*  Feature Row                                       */
/* ────────────────────────────────────────────────── */

function FeatureRow({ feature, highlighted }: { feature: Feature; highlighted?: boolean }) {
  const included = feature.status === 'included';
  return (
    <li className="flex items-start gap-2.5">
      <span
        className={cn(
          'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full',
          included
            ? highlighted
              ? 'bg-primary/15 text-primary'
              : 'bg-primary/10 text-primary'
            : 'bg-muted text-muted-foreground/50'
        )}
      >
        {included ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
      </span>
      <span
        className={cn(
          'text-sm leading-snug',
          included ? 'text-foreground' : 'text-muted-foreground line-through decoration-muted-foreground/30'
        )}
      >
        {feature.label}
      </span>
    </li>
  );
}

/* ────────────────────────────────────────────────── */
/*  Icon lookup (avoid passing React components as    */
/*  serialized props from Server → Client)            */
/* ────────────────────────────────────────────────── */

import { Headphones } from 'lucide-react';

const ICONS = {
  headphones: Headphones,
  sparkles: Sparkles,
} as const;

/* ────────────────────────────────────────────────── */
/*  Pricing Card                                      */
/* ────────────────────────────────────────────────── */

export function PricingCard({ tier, index }: { tier: Tier; index: number }) {
  const Icon = ICONS[tier.iconName];
  const { user, setShowAuthModal } = useAuth();
  const [waitlistEmail, setWaitlistEmail] = useState('');
  const [waitlistLoading, setWaitlistLoading] = useState(false);
  const [waitlistSubmitted, setWaitlistSubmitted] = useState(false);

  const handleCTA = () => {
    if (!user && tier.price > 0) {
      setShowAuthModal(true);
    }
  };

  const handleWaitlistSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setWaitlistLoading(true);
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: waitlistEmail }),
      });
      if (res.ok) {
        setWaitlistSubmitted(true);
      }
    } catch {
      // silently fail
    } finally {
      setWaitlistLoading(false);
    }
  };

  return (
    <div
      className={cn(
        'relative flex flex-col rounded-2xl border bg-card p-6 sm:p-8 transition-all duration-300',
        tier.highlighted
          ? 'border-primary shadow-xl shadow-primary/10 md:scale-[1.02] ring-1 ring-primary/20'
          : 'border-border shadow-sm hover:shadow-md hover:border-border-strong'
      )}
      style={{ animationDelay: `${index * 100}ms` }}
    >
      {/* Badge */}
      {tier.badge && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="inline-flex items-center gap-1 rounded-full bg-primary px-4 py-1 text-xs font-bold text-primary-foreground shadow-lg shadow-primary/25">
            <Sparkles className="h-3 w-3 fill-white/20" />
            {tier.badge}
          </span>
        </div>
      )}

      {/* Header: Icon + Name */}
      <div className="flex items-center gap-3 mb-5">
        <div
          className={cn(
            'flex h-11 w-11 items-center justify-center rounded-xl',
            tier.highlighted
              ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/30'
              : 'bg-primary/10 text-primary'
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">{tier.subtitle}</p>
          <p className="text-h3 text-foreground leading-tight">{tier.name}</p>
        </div>
      </div>

      {/* Price */}
      <div className="mb-5">
        <div className="flex items-baseline gap-1">
          {tier.price === 0 ? (
            <span className="text-4xl font-extrabold tracking-tight text-foreground">$0</span>
          ) : (
            <>
              <span className="text-4xl font-extrabold tracking-tight text-foreground">
                ${tier.price.toFixed(2)}
              </span>
              <span className="text-sm font-medium text-muted-foreground">{tier.priceSuffix}</span>
            </>
          )}
        </div>
        {tier.price === 0 && (
          <p className="text-sm text-muted-foreground mt-0.5">{tier.priceSuffix}</p>
        )}
      </div>

      {/* Tag */}
      <div className="mb-5 pb-5 border-b border-border">
        <p
          className={cn(
            'text-xs font-bold uppercase tracking-widest mb-1',
            tier.highlighted ? 'text-primary' : 'text-primary/70'
          )}
        >
          {tier.tagline}
        </p>
        <p className="text-sm text-muted-foreground">{tier.tagDescription}</p>
      </div>

      {/* Features */}
      <ul className="flex-1 space-y-3 mb-8">
        {tier.features.map((f) => (
          <FeatureRow key={f.label} feature={f} highlighted={tier.highlighted} />
        ))}
      </ul>

      {/* CTA */}
      {tier.price === 0 ? (
        <Button
          variant="outline"
          size="lg"
          className="w-full rounded-full font-semibold"
          disabled
        >
          {tier.cta}
        </Button>
      ) : tier.highlighted && tier.ctaDisabled ? (
        waitlistSubmitted ? (
          <p className="text-center text-sm font-medium text-primary py-2">
            You&apos;re on the list! We&apos;ll notify you when Pro launches.
          </p>
        ) : (
          <form onSubmit={handleWaitlistSubmit} className="flex gap-2">
            <input
              type="email"
              placeholder="Enter your email"
              value={waitlistEmail}
              onChange={(e) => setWaitlistEmail(e.target.value)}
              required
              className="flex-1 px-4 py-2 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <button
              type="submit"
              disabled={waitlistLoading}
              className="px-6 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {waitlistLoading ? 'Joining...' : 'Join Waitlist'}
            </button>
          </form>
        )
      ) : tier.ctaDisabled ? (
        <Button
          size="lg"
          disabled
          className={cn(
            'w-full rounded-full font-semibold gap-2',
            'bg-foreground/60 text-background'
          )}
        >
          <Lock className="h-4 w-4" />
          {tier.cta}
        </Button>
      ) : (
        <Button
          size="lg"
          onClick={handleCTA}
          className={cn(
            'w-full rounded-full font-semibold gap-2 transition-all',
            tier.highlighted
              ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:scale-[1.02] active:scale-[0.98]'
              : 'bg-foreground text-background hover:bg-foreground/90 hover:scale-[1.02] active:scale-[0.98]'
          )}
        >
          {tier.cta}
          <ArrowRight className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
