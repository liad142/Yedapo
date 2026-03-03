/**
 * Plan Definitions — Single source of truth for all plan limits and content cutoffs.
 *
 * UX naming: "Daily limit" / "Creations left today" — NOT "credits".
 */

export type UserPlan = 'free' | 'pro' | 'power';

// ---------------------------------------------------------------------------
// Daily generation quotas
// ---------------------------------------------------------------------------
export interface PlanLimits {
  summariesPerDay: number;  // Infinity = unlimited
  askAiPerDay: number;
}

export const PLAN_LIMITS: Record<UserPlan, PlanLimits> = {
  free:  { summariesPerDay: 3,        askAiPerDay: 10 },
  pro:   { summariesPerDay: 15,       askAiPerDay: 50 },
  power: { summariesPerDay: Infinity, askAiPerDay: Infinity },
};

// ---------------------------------------------------------------------------
// Content gating cutoffs (item-based, not character %)
// Values represent how many items FREE users can see.
// Pro/Power see everything (cutoff = Infinity).
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

export const FREE_CUTOFFS: ContentCutoffs = {
  deepSummaryParagraphs: 2,
  coreConcepts: 2,
  chapters: 1,
  takeaways: 3,
  transcriptSegments: 5,
  highlights: 1,
  counterpoints: 0,
  shownotes: 0,
};

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
  free: FREE_CUTOFFS,
  pro: FULL_ACCESS,
  power: FULL_ACCESS,
};

// ---------------------------------------------------------------------------
// Pricing display metadata (used by pricing page & upgrade modal)
// ---------------------------------------------------------------------------
export interface PlanMeta {
  label: string;
  price: string;         // display string, e.g. "$9/mo"
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
      '10 Ask AI questions per day',
      'Quick Summary (always full)',
      'Preview of deep insights',
      'Keywords & discovery',
    ],
  },
  pro: {
    label: 'Pro',
    price: '$6.99/mo',
    description: 'Unlock the full depth of every episode',
    features: [
      '15 AI summaries per day',
      '50 Ask AI questions per day',
      'Full deep summaries & chapters',
      'Full transcript with search',
      'All highlights & counterpoints',
      'Complete shownotes',
    ],
  },
  power: {
    label: 'Power',
    price: '$13.99/mo',
    description: 'For power listeners and teams',
    features: [
      'Unlimited AI summaries',
      'Unlimited Ask AI',
      'Everything in Pro',
      'Automations (coming soon)',
      'Priority support',
    ],
  },
};
