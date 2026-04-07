'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Sparkles,
  Check,
  X,
  ArrowRight,
  Headphones,
  Clock,
  ChevronDown,
  Zap,
  BookOpen,
  Library,
  Bell,
} from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import {
  PRICING,
  PLAN_META,
  FEATURE_COMPARISON,
  type BillingInterval,
  type FeatureCategory,
  type PlanFeature,
} from '@/lib/plans';
import { ScrollReveal, StaggerContainer, StaggerItem } from '@/components/landing/ScrollReveal';

/* ═══════════════════════════════════════════════════════════════════════
   BILLING TOGGLE
   ═══════════════════════════════════════════════════════════════════════ */

function BillingToggle({
  interval,
  onToggle,
}: {
  interval: BillingInterval;
  onToggle: (v: BillingInterval) => void;
}) {
  const prefersReduced = useReducedMotion();

  return (
    <div className="flex items-center justify-center gap-3">
      <div
        className="relative inline-flex items-center rounded-full bg-muted p-1"
        role="radiogroup"
        aria-label="Billing interval"
      >
        <button
          role="radio"
          aria-checked={interval === 'monthly'}
          onClick={() => onToggle('monthly')}
          className={cn(
            'relative z-10 rounded-full px-5 py-2 text-sm font-medium transition-colors duration-200',
            interval === 'monthly'
              ? 'text-foreground'
              : 'text-muted-foreground hover:text-foreground/70'
          )}
        >
          Monthly
        </button>
        <button
          role="radio"
          aria-checked={interval === 'yearly'}
          onClick={() => onToggle('yearly')}
          className={cn(
            'relative z-10 rounded-full px-5 py-2 text-sm font-medium transition-colors duration-200',
            interval === 'yearly'
              ? 'text-foreground'
              : 'text-muted-foreground hover:text-foreground/70'
          )}
        >
          Yearly
        </button>
        {/* Sliding indicator */}
        <motion.div
          className="absolute top-1 bottom-1 rounded-full bg-card shadow-sm border border-border/50"
          layout
          layoutId="billing-toggle-indicator"
          transition={
            prefersReduced
              ? { duration: 0 }
              : { type: 'spring', stiffness: 500, damping: 35 }
          }
          style={{
            left: interval === 'monthly' ? '4px' : '50%',
            right: interval === 'monthly' ? '50%' : '4px',
          }}
        />
      </div>

      {/* Savings badge */}
      <AnimatePresence mode="wait">
        {interval === 'yearly' && (
          <motion.div
            initial={prefersReduced ? { opacity: 1 } : { opacity: 0, scale: 0.8, x: -8 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={prefersReduced ? { opacity: 0 } : { opacity: 0, scale: 0.8, x: -8 }}
            transition={{ duration: 0.2 }}
          >
            <Badge
              variant="subtle"
              className="text-xs font-bold whitespace-nowrap"
            >
              Save ${PRICING.pro.yearlySavings}/yr
            </Badge>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   PRICING CARD
   ═══════════════════════════════════════════════════════════════════════ */

function PricingCardFree() {
  const { user, setShowAuthModal } = useAuth();
  const router = useRouter();
  const features = PLAN_META.free.features;

  return (
    <div className="relative flex flex-col rounded-2xl border border-border bg-card p-6 sm:p-8 landing-card-lift h-full">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Headphones className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">
            {PLAN_META.free.label}
          </p>
          <p className="text-h3 text-foreground leading-tight">Free</p>
        </div>
      </div>

      {/* Price */}
      <div className="mb-5">
        <div className="flex items-baseline gap-1">
          <span className="text-4xl font-extrabold tracking-tight text-foreground">
            $0
          </span>
        </div>
        <p className="text-sm text-muted-foreground mt-0.5">Free forever</p>
      </div>

      {/* Tagline */}
      <div className="mb-5 pb-5 border-b border-border">
        <p className="text-xs font-bold uppercase tracking-widest mb-1 text-primary/70">
          FREE FOREVER
        </p>
      </div>

      {/* Features */}
      <ul className="flex-1 space-y-3 mb-8">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2.5">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Check className="h-3 w-3" />
            </span>
            <span className="text-sm leading-snug text-foreground">{f}</span>
          </li>
        ))}
      </ul>

      {/* CTA */}
      {user ? (
        <Button
          variant="outline"
          size="lg"
          className="w-full rounded-full font-semibold"
          disabled
        >
          Current Plan
        </Button>
      ) : (
        <Button
          variant="outline"
          size="lg"
          className="w-full rounded-full font-semibold gap-2"
          onClick={() => router.push('/discover')}
        >
          Get Started Free
          <ArrowRight className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

function PricingCardPro({ interval }: { interval: BillingInterval }) {
  const { user, setShowAuthModal } = useAuth();
  const prefersReduced = useReducedMotion();
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);
  const features = PLAN_META.pro.features;

  const displayPrice =
    interval === 'yearly' ? PRICING.pro.yearlyPerMonth : PRICING.pro.monthly;
  const priceSuffix = '/ month';
  const billingNote =
    interval === 'yearly'
      ? `$${PRICING.pro.yearly}/year, billed annually`
      : 'Billed monthly';

  const handleCTA = async () => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }

    setIsCheckoutLoading(true);
    try {
      const priceId =
        interval === 'yearly'
          ? process.env.NEXT_PUBLIC_STRIPE_PRO_YEARLY_PRICE_ID
          : process.env.NEXT_PUBLIC_STRIPE_PRO_MONTHLY_PRICE_ID;

      const res = await fetch('/api/stripe/checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId }),
      });

      const data = await res.json();

      if (!res.ok) {
        console.error('Checkout error:', data.error);
        return;
      }

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error('Failed to start checkout:', err);
    } finally {
      setIsCheckoutLoading(false);
    }
  };

  return (
    /* Gradient border wrapper */
    <div className="relative rounded-2xl p-px bg-gradient-to-br from-primary via-[#8b5cf6] to-primary md:scale-[1.02] h-full landing-card-lift group/pro">
      {/* Glow effect behind card */}
      <div
        className={cn(
          'absolute -inset-1 rounded-2xl opacity-0 transition-opacity duration-500',
          'group-hover/pro:opacity-100'
        )}
        style={{
          background:
            'radial-gradient(ellipse at center, hsl(var(--primary) / 0.15), transparent 70%)',
          filter: 'blur(20px)',
        }}
        aria-hidden="true"
      />

      {/* "Most Popular" badge */}
      <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-10">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold text-white shadow-lg landing-shimmer-btn"
          style={{
            background: 'linear-gradient(135deg, hsl(var(--primary)), #8b5cf6)',
          }}
        >
          <Sparkles className="h-3 w-3 fill-white/20" />
          Most Popular
        </span>
      </div>

      {/* Inner card */}
      <div className="relative flex flex-col rounded-[calc(1rem-1px)] bg-card p-6 sm:p-8 h-full">
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/30">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">
              {PLAN_META.pro.label}
            </p>
            <p className="text-h3 text-foreground leading-tight">Pro</p>
          </div>
        </div>

        {/* Price */}
        <div className="mb-5">
          <div className="flex items-baseline gap-1">
            <span className="text-4xl font-extrabold tracking-tight text-foreground">
              <AnimatePresence mode="wait">
                <motion.span
                  key={displayPrice}
                  initial={
                    prefersReduced
                      ? { opacity: 1 }
                      : { opacity: 0, y: -10 }
                  }
                  animate={{ opacity: 1, y: 0 }}
                  exit={
                    prefersReduced
                      ? { opacity: 0 }
                      : { opacity: 0, y: 10 }
                  }
                  transition={{ duration: 0.2 }}
                  className="inline-block"
                >
                  ${displayPrice.toFixed(2)}
                </motion.span>
              </AnimatePresence>
            </span>
            <span className="text-sm font-medium text-muted-foreground">
              {priceSuffix}
            </span>
          </div>
          <AnimatePresence mode="wait">
            <motion.p
              key={billingNote}
              initial={prefersReduced ? { opacity: 1 } : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={prefersReduced ? { opacity: 0 } : { opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="text-sm text-muted-foreground mt-0.5"
            >
              {billingNote}
            </motion.p>
          </AnimatePresence>
          {interval === 'yearly' && (
            <motion.p
              initial={prefersReduced ? { opacity: 1 } : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-xs font-semibold text-primary mt-1"
            >
              Save ${PRICING.pro.yearlySavings} per year
            </motion.p>
          )}
        </div>

        {/* Tagline */}
        <div className="mb-5 pb-5 border-b border-border">
          <p className="text-xs font-bold uppercase tracking-widest mb-1 text-primary">
            UNLIMITED
          </p>
        </div>

        {/* Features */}
        <ul className="flex-1 space-y-3 mb-8">
          {features.map((f) => (
            <li key={f} className="flex items-start gap-2.5">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                <Check className="h-3 w-3" />
              </span>
              <span className="text-sm leading-snug text-foreground">{f}</span>
            </li>
          ))}
        </ul>

        {/* CTA */}
        <Button
          size="lg"
          onClick={handleCTA}
          disabled={isCheckoutLoading}
          className={cn(
            'w-full rounded-full font-semibold gap-2 transition-all',
            'bg-primary text-primary-foreground',
            'shadow-lg shadow-primary/25',
            'hover:shadow-primary/40 hover:scale-[1.02] active:scale-[0.98]'
          )}
        >
          {isCheckoutLoading ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              Redirecting...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 fill-white/20" />
              Start Pro Plan
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   FEATURE COMPARISON TABLE
   ═══════════════════════════════════════════════════════════════════════ */

const CATEGORY_ICONS: Record<string, typeof Zap> = {
  'AI Brainpower': Zap,
  'Depth of Insight': BookOpen,
  'Your Coverage': Library,
  'Summaries Delivered to You': Bell,
};

function FeatureCellValue({ value }: { value: string | boolean }) {
  if (value === true) {
    return (
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Check className="h-3 w-3" />
      </span>
    );
  }
  if (value === false) {
    return (
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-muted-foreground/40">
        <X className="h-3 w-3" />
      </span>
    );
  }
  if (value === 'Coming soon') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Clock className="h-3 w-3" />
        Soon
      </span>
    );
  }
  return (
    <span className="text-sm font-medium text-foreground">{value}</span>
  );
}

function ComparisonRow({ feature }: { feature: PlanFeature }) {
  return (
    <div className="grid grid-cols-[1fr_80px_80px] sm:grid-cols-[1fr_100px_100px] items-center py-3 border-b border-border/50 last:border-b-0">
      <span className="text-sm text-foreground pr-2">{feature.label}</span>
      <span className="flex justify-center">
        <FeatureCellValue value={feature.free} />
      </span>
      <span className="flex justify-center">
        <FeatureCellValue value={feature.pro} />
      </span>
    </div>
  );
}

function CategoryGroup({ category }: { category: FeatureCategory }) {
  const Icon = CATEGORY_ICONS[category.name] || Zap;

  return (
    <div className="mb-2">
      {/* Category header */}
      <div className="grid grid-cols-[1fr_80px_80px] sm:grid-cols-[1fr_100px_100px] items-center py-3 border-b border-border">
        <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Icon className="h-4 w-4 text-primary" />
          {category.name}
        </span>
        <span className="text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Free
        </span>
        <span className="text-center text-xs font-semibold text-primary uppercase tracking-wider">
          Pro
        </span>
      </div>
      {/* Feature rows */}
      {category.features.map((feature) => (
        <ComparisonRow key={feature.label} feature={feature} />
      ))}
    </div>
  );
}

function FeatureComparisonTable() {
  return (
    <div className="max-w-2xl mx-auto">
      <ScrollReveal>
        <h2 className="text-h2 sm:text-h1 text-foreground text-center mb-2">
          Compare plans in detail
        </h2>
        <p className="text-center text-muted-foreground mb-8 text-sm sm:text-base">
          Everything you need to know about what each plan includes.
        </p>
      </ScrollReveal>

      <ScrollReveal delay={0.1}>
        <div className="rounded-2xl border border-border bg-card p-4 sm:p-6">
          {FEATURE_COMPARISON.map((category) => (
            <CategoryGroup key={category.name} category={category} />
          ))}
        </div>
      </ScrollReveal>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   FAQ SECTION
   ═══════════════════════════════════════════════════════════════════════ */

const FAQS = [
  {
    q: 'Is the free plan really free forever?',
    a: 'Yes. No credit card. No trial that expires. You get 3 AI summaries and 5 Ask AI questions every day, indefinitely. We cap usage, not time.',
  },
  {
    q: 'What happens when I hit the free limit?',
    a: `Your existing summaries stay accessible. You just can't generate new ones until the next day. If you consistently hit the ceiling, that's your signal — the content you consume outgrew the free plan.`,
  },
  {
    q: 'Can I cancel anytime?',
    a: `One click, no questions. Cancel from your settings page and keep access through the end of your billing period. No exit interviews, no dark patterns.`,
  },
  {
    q: 'Do cached summaries count against my quota?',
    a: 'No. If someone already generated a summary for an episode, you can read it for free. Your daily quota only covers new AI generations.',
  },
  {
    q: 'Is the yearly plan worth it?',
    a: `With the yearly plan, you save $${PRICING.pro.yearlySavings} per year (20% off). That's $${PRICING.pro.yearlyPerMonth}/month instead of $${PRICING.pro.monthly}/month. If you use Yedapo regularly, the yearly plan pays for itself quickly.`,
  },
];

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  const prefersReduced = useReducedMotion();

  return (
    <div
      className={cn(
        'rounded-2xl border bg-card overflow-hidden transition-all duration-300',
        open
          ? 'border-primary/20 shadow-md shadow-primary/5'
          : 'border-border hover:border-primary/10'
      )}
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-5 text-left gap-3"
        aria-expanded={open}
      >
        <span className="font-semibold text-foreground text-sm">{q}</span>
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200',
            open && 'rotate-180'
          )}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={prefersReduced ? { opacity: 1, height: 'auto' } : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={prefersReduced ? { opacity: 0, height: 0 } : { opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
          >
            <div className="px-5 pb-5">
              <p className="text-sm text-muted-foreground leading-relaxed">
                {a}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function FAQSection() {
  return (
    <div className="max-w-2xl mx-auto">
      <ScrollReveal>
        <h2 className="text-h2 sm:text-h1 text-foreground text-center mb-2">
          Frequently asked questions
        </h2>
        <p className="text-center text-muted-foreground mb-8 text-sm sm:text-base">
          Everything you need to know about our plans.
        </p>
      </ScrollReveal>

      <StaggerContainer className="space-y-3" staggerDelay={0.05}>
        {FAQS.map((faq) => (
          <StaggerItem key={faq.q}>
            <FAQItem q={faq.q} a={faq.a} />
          </StaggerItem>
        ))}
      </StaggerContainer>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   SOCIAL PROOF
   ═══════════════════════════════════════════════════════════════════════ */

function SocialProofStrip() {
  return (
    <div className="text-center">
      <p className="text-sm text-muted-foreground">
        Used by product managers, founders, and researchers who refuse to fall behind.
      </p>
      <p className="text-xs text-muted-foreground mt-1">
        All plans include unlimited podcast browsing, search, playback, and episode sharing.
      </p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   MAIN CLIENT COMPONENT
   ═══════════════════════════════════════════════════════════════════════ */

export function PricingClient() {
  const [interval, setInterval] = useState<BillingInterval>('monthly');

  return (
    <div className="max-w-5xl mx-auto px-4 pt-28 sm:pt-32 pb-20 space-y-16 relative overflow-hidden">
      {/* Gradient orbs background */}
      <div
        className="landing-orb -top-20 left-[20%] w-[400px] h-[400px] bg-primary/[0.08] dark:bg-primary/[0.04]"
        style={{
          filter: 'blur(120px)',
          animation: 'landing-float 8s ease-in-out infinite',
        }}
      />
      <div
        className="landing-orb top-10 right-[15%] w-[350px] h-[350px] bg-[#8b5cf6]/[0.06] dark:bg-[#8b5cf6]/[0.03]"
        style={{
          filter: 'blur(100px)',
          animation: 'landing-float-reverse 10s ease-in-out infinite',
        }}
      />

      {/* ── Header ── */}
      <div className="relative text-center max-w-2xl mx-auto space-y-4">
        <ScrollReveal>
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm font-semibold text-primary mb-4">
            <Sparkles className="h-3.5 w-3.5" />
            Pricing
          </div>
          <h1 className="text-h1 sm:text-display tracking-tight text-foreground">
            Every episode you skip is knowledge you lose.
          </h1>
        </ScrollReveal>

        {/* Billing toggle */}
        <ScrollReveal delay={0.1}>
          <BillingToggle interval={interval} onToggle={setInterval} />
        </ScrollReveal>
      </div>

      {/* ── Pricing Cards ── */}
      <StaggerContainer
        className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-5 items-stretch max-w-3xl mx-auto"
        staggerDelay={0.12}
      >
        <StaggerItem>
          <PricingCardFree />
        </StaggerItem>
        <StaggerItem>
          <PricingCardPro interval={interval} />
        </StaggerItem>
      </StaggerContainer>

      {/* ── Social proof ── */}
      <ScrollReveal>
        <SocialProofStrip />
      </ScrollReveal>

      {/* ── Feature Comparison Table ── */}
      <FeatureComparisonTable />

      {/* ── FAQ ── */}
      <FAQSection />

      {/* ── Bottom CTA ── */}
      <ScrollReveal>
        <div className="text-center space-y-4 py-8">
          <h2 className="text-h2 text-foreground">
            Ready to unlock everything?
          </h2>
          <p className="text-muted-foreground text-sm sm:text-base max-w-md mx-auto">
            Start free today. Upgrade when you want unlimited AI power.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              size="lg"
              className="rounded-full px-8 landing-shimmer-btn gap-2"
              asChild
            >
              <a href="/discover">
                Get Started Free
                <ArrowRight className="h-4 w-4" />
              </a>
            </Button>
          </div>
        </div>
      </ScrollReveal>
    </div>
  );
}
