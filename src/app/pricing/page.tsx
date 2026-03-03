'use client';

import { Check, X, Headphones, Sparkles, Zap, ArrowRight, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { PLAN_META, PLAN_LIMITS } from '@/lib/plans';

/* ────────────────────────────────────────────────── */
/*  Types                                             */
/* ────────────────────────────────────────────────── */

type FeatureStatus = 'included' | 'excluded';

interface Feature {
  label: string;
  status: FeatureStatus;
}

interface Tier {
  name: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
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
/*  Tier Data                                         */
/* ────────────────────────────────────────────────── */

const TIERS: Tier[] = [
  {
    name: 'Free',
    subtitle: 'Listener',
    icon: Headphones,
    price: 0,
    priceSuffix: 'Free forever',
    tagline: 'EVERY NEW USER',
    tagDescription: 'Start listening smarter, zero commitment',
    features: [
      { label: `${PLAN_LIMITS.free.summariesPerDay} AI summaries per day`, status: 'included' },
      { label: `${PLAN_LIMITS.free.askAiPerDay} Ask AI questions per day`, status: 'included' },
      { label: 'Quick summaries (always full)', status: 'included' },
      { label: 'Preview of deep insights', status: 'included' },
      { label: 'Follow 3 YouTube channels', status: 'included' },
      { label: 'Subscribe to 15 podcasts', status: 'included' },
      { label: 'Basic discovery feed', status: 'included' },
      { label: 'Full deep summaries & chapters', status: 'excluded' },
      { label: 'Priority processing', status: 'excluded' },
      { label: 'Notifications', status: 'excluded' },
    ],
    cta: 'Current Plan',
  },
  {
    name: 'Pro',
    subtitle: 'Explorer',
    icon: Sparkles,
    price: 6.99,
    priceSuffix: '/ month',
    tagline: 'MOST POPULAR',
    tagDescription: 'Best for avid podcast listeners',
    highlighted: true,
    badge: 'Most Popular',
    features: [
      { label: `${PLAN_LIMITS.pro.summariesPerDay} AI summaries per day`, status: 'included' },
      { label: `${PLAN_LIMITS.pro.askAiPerDay} Ask AI questions per day`, status: 'included' },
      { label: 'Full deep summaries & chapters', status: 'included' },
      { label: 'Full transcript with search', status: 'included' },
      { label: 'All highlights & counterpoints', status: 'included' },
      { label: 'Unlimited podcast subscriptions', status: 'included' },
      { label: 'Follow 20 YouTube channels', status: 'included' },
      { label: 'Full personalized discovery', status: 'included' },
      { label: 'Priority processing', status: 'included' },
      { label: 'Email notifications', status: 'included' },
    ],
    cta: 'Join Waitlist',
    ctaDisabled: true,
  },
  {
    name: 'Power',
    subtitle: 'Obsessed',
    icon: Zap,
    price: 13.99,
    priceSuffix: '/ month',
    tagline: 'POWER USER',
    tagDescription: 'No limits. Every feature. Maximum insight.',
    features: [
      { label: 'Unlimited AI summaries', status: 'included' },
      { label: 'Unlimited Ask AI', status: 'included' },
      { label: 'Everything in Pro', status: 'included' },
      { label: 'Unlimited podcast subscriptions', status: 'included' },
      { label: 'Unlimited YouTube channels', status: 'included' },
      { label: 'Personalized + Curiosity feed', status: 'included' },
      { label: 'Automations (coming soon)', status: 'included' },
      { label: 'Priority processing', status: 'included' },
      { label: 'Email + Telegram + Scheduling', status: 'included' },
      { label: 'Early access to new features', status: 'included' },
    ],
    cta: 'Coming Soon',
    ctaDisabled: true,
  },
];

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
/*  Pricing Card                                      */
/* ────────────────────────────────────────────────── */

function PricingCard({ tier, index }: { tier: Tier; index: number }) {
  const Icon = tier.icon;
  const { user, setShowAuthModal } = useAuth();

  const handleCTA = () => {
    if (!user && tier.price > 0) {
      setShowAuthModal(true);
    }
    // TODO: Stripe integration for paid tiers
  };

  return (
    <div
      className={cn(
        'relative flex flex-col rounded-2xl border bg-card p-6 sm:p-8 transition-all duration-300',
        tier.highlighted
          ? 'border-primary shadow-xl shadow-primary/10 scale-[1.02] ring-1 ring-primary/20'
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
          <p className="text-lg font-bold text-foreground leading-tight">{tier.name}</p>
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
      ) : tier.ctaDisabled ? (
        <Button
          size="lg"
          disabled
          className={cn(
            'w-full rounded-full font-semibold gap-2',
            tier.highlighted
              ? 'bg-primary/60 text-primary-foreground'
              : 'bg-foreground/60 text-background'
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

/* ────────────────────────────────────────────────── */
/*  FAQ Section                                       */
/* ────────────────────────────────────────────────── */

const FAQS = [
  {
    q: 'What counts as an AI summary?',
    a: 'Each time you generate a Quick or Deep summary for a podcast episode or YouTube video, it counts as one summary. Summaries already generated and cached don\'t count against your limit.',
  },
  {
    q: 'Can I switch plans anytime?',
    a: 'Yes. Upgrade or downgrade whenever you like. If you downgrade, you\'ll keep your current plan until the end of your billing period.',
  },
  {
    q: 'What happens when I hit my daily limit?',
    a: 'You\'ll see a friendly nudge to upgrade. Your limit resets at midnight UTC every day, so you can always come back tomorrow.',
  },
  {
    q: 'Do cached summaries count against my quota?',
    a: 'No. If someone already generated a summary for an episode, you can read it for free. Your quota only covers new AI generations.',
  },
];

/* ────────────────────────────────────────────────── */
/*  Page                                              */
/* ────────────────────────────────────────────────── */

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="max-w-5xl mx-auto px-4 pt-8 sm:pt-12 space-y-12">

        {/* ── Header ── */}
        <div className="text-center max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-semibold text-primary mb-4">
            <Sparkles className="h-3.5 w-3.5" />
            Pricing
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
            Listen more. Understand deeper.
          </h1>
          <p className="text-muted-foreground mt-3 text-base sm:text-lg leading-relaxed">
            Every plan includes full podcast browsing and playback.
            Pick the AI tier that matches how you listen.
          </p>
        </div>

        {/* ── Cards ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-5 items-start">
          {TIERS.map((tier, i) => (
            <PricingCard key={tier.name} tier={tier} index={i} />
          ))}
        </div>

        {/* ── Bottom note ── */}
        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            All plans include unlimited podcast browsing, search, playback, and episode sharing.
          </p>
        </div>

        {/* ── FAQ ── */}
        <div className="max-w-2xl mx-auto">
          <h2 className="text-xl font-bold text-foreground mb-6 text-center">
            Frequently Asked Questions
          </h2>
          <div className="space-y-4">
            {FAQS.map((faq) => (
              <div
                key={faq.q}
                className="rounded-2xl border border-border bg-card p-5"
              >
                <p className="font-semibold text-foreground text-sm">{faq.q}</p>
                <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                  {faq.a}
                </p>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
