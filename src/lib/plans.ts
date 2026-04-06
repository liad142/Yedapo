/**
 * Plan Definitions — Single source of truth for all plan limits and content cutoffs.
 *
 * UX naming: "Daily limit" / "Creations left today" — NOT "credits".
 */

export type UserPlan = 'free' | 'pro';

// ---------------------------------------------------------------------------
// Daily generation quotas
// ---------------------------------------------------------------------------
export interface PlanLimits {
  summariesPerDay: number;  // Infinity = unlimited
  askAiPerDay: number;
}

export const PLAN_LIMITS: Record<UserPlan, PlanLimits> = {
  free:  { summariesPerDay: 3,        askAiPerDay: 5 },
  pro:   { summariesPerDay: Infinity, askAiPerDay: Infinity },
};

// ---------------------------------------------------------------------------
// Content gating cutoffs (item-based, not character %)
// Values represent how many items FREE users can see.
// Pro sees everything (cutoff = Infinity).
// ---------------------------------------------------------------------------
export interface ContentCutoffs {
  deepSummaryParagraphs: number; // paragraphs of comprehensive_overview (split by \n, blanks filtered)
  coreConcepts: number;
  chapters: number;              // chronological_breakdown items
  takeaways: number;             // actionable_takeaways items
  transcriptSegments: number;    // transcript segments visible (no search for free)
  highlights: number;
  counterpoints: number;         // 0 = fully locked
  shownotes: number;             // 0 = fully locked
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
// If free-plan content restrictions are added later, split into separate objects.
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
export interface PlanMeta {
  label: string;
  price: string;         // display string, e.g. "$9.99/mo"
  description: string;
  features: string[];
}

export const PLAN_META: Record<UserPlan, PlanMeta> = {
  free: {
    label: 'Free',
    price: '$0',
    description: 'Get instant value from any podcast',
    features: [
      '3 AI summaries per day',
      '5 Ask AI questions per day',
      'Full summaries & insights',
      'All chapters & takeaways',
      '15 podcast subscriptions',
      '3 YouTube channel follows',
      '25 saved episodes',
    ],
  },
  pro: {
    label: 'Pro',
    price: '$12.99/mo',
    description: 'Unlimited AI power for every episode',
    features: [
      'Unlimited AI summaries',
      'Unlimited Ask AI',
      'Full deep summaries & chapters',
      'Full transcript with search',
      'All highlights & counterpoints',
      'Complete shownotes',
      'Unlimited subscriptions',
      'Unlimited YouTube channels',
      'Export summaries',
      'Priority generation queue',
      'Email notifications',
      'Early access to new features',
    ],
  },
};
