import type { Metadata } from 'next';
import { Sparkles } from 'lucide-react';
import { PLAN_LIMITS } from '@/lib/plans';
import { PricingCard } from './PricingCard';
import type { Tier } from './PricingCard';

export const metadata: Metadata = {
  title: 'Pricing — Yedapo',
  description:
    'Choose the right plan for how you listen. Free forever for casual listeners, Pro for power users.',
  openGraph: {
    title: 'Pricing — Yedapo',
    description:
      'AI-powered podcast summaries. Free forever for casual listeners, Pro for power users.',
    type: 'website',
    siteName: 'Yedapo',
  },
};

/* ────────────────────────────────────────────────── */
/*  Tier Data (static — defined at module scope)      */
/* ────────────────────────────────────────────────── */

const TIERS: Tier[] = [
  {
    name: 'Free',
    subtitle: 'Listener',
    iconName: 'headphones',
    price: 0,
    priceSuffix: 'Free forever',
    tagline: 'ALWAYS FREE',
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
    iconName: 'sparkles',
    price: 9.99,
    priceSuffix: '/ month',
    tagline: 'UNLIMITED',
    tagDescription: 'No limits. Every feature. Maximum insight.',
    highlighted: true,
    badge: 'Recommended',
    features: [
      { label: 'Unlimited AI summaries', status: 'included' },
      { label: 'Unlimited Ask AI', status: 'included' },
      { label: 'Full deep summaries & chapters', status: 'included' },
      { label: 'Full transcript with search', status: 'included' },
      { label: 'All highlights & counterpoints', status: 'included' },
      { label: 'Unlimited podcast subscriptions', status: 'included' },
      { label: 'Unlimited YouTube channels', status: 'included' },
      { label: 'Priority generation queue', status: 'included' },
      { label: 'Email notifications', status: 'included' },
      { label: 'Early access to new features', status: 'included' },
    ],
    cta: 'Join Waitlist',
    ctaDisabled: true,
  },
];

/* ────────────────────────────────────────────────── */
/*  FAQ Data                                          */
/* ────────────────────────────────────────────────── */

const FAQS = [
  {
    q: 'What counts as an AI summary?',
    a: "Each time you generate a Quick or Deep summary for a podcast episode or YouTube video, it counts as one summary. Summaries already generated and cached don't count against your limit.",
  },
  {
    q: 'Can I switch plans anytime?',
    a: "Yes. Upgrade or downgrade whenever you like. If you downgrade, you'll keep your current plan until the end of your billing period.",
  },
  {
    q: 'What happens when I hit my daily limit?',
    a: "You'll see a friendly nudge to upgrade. Your limit resets at midnight UTC every day, so you can always come back tomorrow.",
  },
  {
    q: 'Do cached summaries count against my quota?',
    a: 'No. If someone already generated a summary for an episode, you can read it for free. Your quota only covers new AI generations.',
  },
];

/* ────────────────────────────────────────────────── */
/*  Page (Server Component)                           */
/* ────────────────────────────────────────────────── */

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="max-w-5xl mx-auto px-4 pt-8 sm:pt-12 space-y-12">

        {/* Header */}
        <div className="text-center max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-semibold text-primary mb-4">
            <Sparkles className="h-3.5 w-3.5" />
            Pricing
          </div>
          <h1 className="text-h1 sm:text-display tracking-tight text-foreground">
            Listen more. Understand deeper.
          </h1>
          <p className="text-muted-foreground mt-3 text-base sm:text-lg leading-relaxed">
            Every plan includes full podcast browsing and playback.
            Pick the AI tier that matches how you listen.
          </p>
        </div>

        {/* Cards (interactive — client component) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-5 items-start max-w-3xl mx-auto">
          {TIERS.map((tier, i) => (
            <PricingCard key={tier.name} tier={tier} index={i} />
          ))}
        </div>

        {/* Bottom note */}
        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            All plans include unlimited podcast browsing, search, playback, and episode sharing.
          </p>
        </div>

        {/* FAQ */}
        <div className="max-w-2xl mx-auto">
          <h2 className="text-h3 text-foreground mb-6 text-center">
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
