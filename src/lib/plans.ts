/**
 * Plan Definitions — Single source of truth for all plan limits and content cutoffs.
 *
 * UX naming: "Daily limit" / "Creations left today" — NOT "credits".
 */

export type UserPlan = 'free' | 'pro';
export type BillingInterval = 'monthly' | 'yearly';

// ---------------------------------------------------------------------------
// Pricing constants
// ---------------------------------------------------------------------------
export const PRICING = {
  pro: {
    monthly: 12.99,
    yearlyDiscount: 0.20, // 20% off
    get yearly() {
      return +(this.monthly * 12 * (1 - this.yearlyDiscount)).toFixed(2);
    },
    get yearlyPerMonth() {
      return +(this.yearly / 12).toFixed(2);
    },
    get yearlySavings() {
      return +(this.monthly * 12 - this.yearly).toFixed(2);
    },
  },
} as const;

// ---------------------------------------------------------------------------
// Daily generation quotas
// ---------------------------------------------------------------------------
export interface PlanLimits {
  summariesPerDay: number;  // Infinity = unlimited
  askAiPerDay: number;
  maxPodcastSubs: number;   // Infinity = unlimited
  maxYoutubeFollows: number;
}

export const PLAN_LIMITS: Record<UserPlan, PlanLimits> = {
  free:  { summariesPerDay: 3,        askAiPerDay: 0,        maxPodcastSubs: 5,        maxYoutubeFollows: 5 },
  pro:   { summariesPerDay: Infinity, askAiPerDay: Infinity, maxPodcastSubs: Infinity, maxYoutubeFollows: Infinity },
};

// ---------------------------------------------------------------------------
// Notification / delivery gating
// ---------------------------------------------------------------------------
export interface NotificationAccess {
  inApp: boolean;
  email: boolean;
  telegram: boolean;
  whatsapp: boolean;
  digestMode: boolean;
  frequencyControl: boolean;
  canConnect: boolean; // Can connect channels (even if delivery is gated)
}

export const NOTIFICATION_ACCESS: Record<UserPlan, NotificationAccess> = {
  free: {
    inApp: true,
    email: false,
    telegram: false,
    whatsapp: false,
    digestMode: false,
    frequencyControl: false,
    canConnect: true, // Free users CAN connect (investment → conversion trigger)
  },
  pro: {
    inApp: true,
    email: true,
    telegram: true,
    whatsapp: true,
    digestMode: true,
    frequencyControl: true,
    canConnect: true,
  },
};

// ---------------------------------------------------------------------------
// Content gating cutoffs (item-based, not character %)
// Values represent how many items FREE users can see.
// Pro sees everything (cutoff = Infinity).
// ---------------------------------------------------------------------------
export interface ContentCutoffs {
  deepSummaryParagraphs: number;
  coreConcepts: number;
  chapters: number;
  takeaways: number;
  transcriptSegments: number;
  highlights: number;
  counterpoints: number;
  shownotes: number;
}

// Guest users (not signed in) see a teaser with blur + sign-up CTA.
export const GUEST_CUTOFFS: ContentCutoffs = {
  deepSummaryParagraphs: 3,
  coreConcepts: 2,
  chapters: 3,
  takeaways: 2,
  transcriptSegments: 0,
  highlights: 2,
  counterpoints: 0,
  shownotes: 0,
};

// Registered users (even free plan) can VIEW all summary content.
// Gating for free plan is only on generation quotas (3 summaries/day, 5 asks/day).
const FULL_ACCESS: ContentCutoffs = {
  deepSummaryParagraphs: Infinity,
  coreConcepts: Infinity,
  chapters: Infinity,
  takeaways: Infinity,
  transcriptSegments: Infinity,
  highlights: Infinity,
  counterpoints: Infinity,
  shownotes: Infinity,
};

export const PLAN_CUTOFFS: Record<UserPlan, ContentCutoffs> = {
  free: FULL_ACCESS,
  pro: FULL_ACCESS,
};

// ---------------------------------------------------------------------------
// Pricing display metadata (used by pricing page & upgrade modal)
// ---------------------------------------------------------------------------

/** Feature category for the comparison table */
export interface PlanFeature {
  label: string;
  free: string | boolean;  // true = included, false = excluded, string = specific value
  pro: string | boolean;
}

export interface FeatureCategory {
  name: string;
  features: PlanFeature[];
}

export const FEATURE_COMPARISON: FeatureCategory[] = [
  {
    name: 'AI Brainpower',
    features: [
      { label: 'AI summaries per day', free: '3/day', pro: 'Unlimited' },
      { label: 'Ask AI (episode Q&A)', free: false, pro: 'Unlimited' },
      { label: 'Priority generation queue', free: false, pro: true },
    ],
  },
  {
    name: 'Depth of Insight',
    features: [
      { label: 'Full summaries & insights', free: true, pro: true },
      { label: 'Chapters & takeaways', free: true, pro: true },
      { label: 'Full transcript with search', free: true, pro: true },
      { label: 'Highlights & counterpoints', free: true, pro: true },
      { label: 'Complete shownotes', free: true, pro: true },
      { label: 'Export summaries', free: false, pro: true },
    ],
  },
  {
    name: 'Your Coverage',
    features: [
      { label: 'Podcast subscriptions', free: '5', pro: 'Unlimited' },
      { label: 'YouTube channel follows', free: '5', pro: 'Unlimited' },
    ],
  },
  {
    name: 'Summaries Delivered to You',
    features: [
      { label: 'In-app notifications', free: true, pro: true },
      { label: 'Email delivery', free: false, pro: true },
      { label: 'Telegram delivery', free: false, pro: true },
      { label: 'WhatsApp delivery', free: false, pro: 'Coming soon' },
      { label: 'Daily/weekly digest', free: true, pro: true },
      { label: 'Choose delivery time', free: false, pro: true },
    ],
  },
];

export interface PlanMeta {
  label: string;
  monthlyPrice: number;     // 0 for free
  description: string;
  badge?: string;            // e.g. "Most Popular"
  features: string[];        // quick bullet list (for upgrade modals)
}

export const PLAN_META: Record<UserPlan, PlanMeta> = {
  free: {
    label: 'Free',
    monthlyPrice: 0,
    description: 'Free forever',
    features: [
      '3 AI summaries per day',
      'Full summaries & insights',
      'Full transcript with search',
      'Daily & weekly digest',
      '5 podcast subscriptions',
      '5 YouTube channels',
      'In-app notifications',
    ],
  },
  pro: {
    label: 'Pro',
    monthlyPrice: PRICING.pro.monthly,
    badge: 'Most Popular',
    description: 'Unlimited',
    features: [
      'Unlimited AI summaries',
      'Unlimited Ask AI',
      'Unlimited subscriptions & follows',
      'Email, Telegram & WhatsApp alerts',
      'Export summaries (Markdown)',
      'Priority generation queue',
    ],
  },
};

// Legacy compat — old code referenced PLAN_META.*.price as a string
// TODO: migrate callers to use monthlyPrice number + PRICING constants
