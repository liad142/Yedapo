// =============================================================================
// Yedapo Landing Page — Marketing Copy
// Clean, confident, conversion-focused. No fluff, no fabricated proof.
// =============================================================================

export const LANDING_COPY = {

  // ---------------------------------------------------------------------------
  // 1. HERO SECTION
  // ---------------------------------------------------------------------------
  hero: {
    badge: "AI-Powered Podcast Intelligence",
    headline: "Know what matters.\nSkip the rest.",
    subheadline:
      "AI summaries, key insights, and cited answers from any podcast or YouTube video. Hours of content, absorbed in minutes.",
    primaryCta: "Start Free",
    secondaryCta: "See How It Works",
  },

  // ---------------------------------------------------------------------------
  // 2. TRUST SIGNALS (replaces fabricated metrics)
  // ---------------------------------------------------------------------------
  trustSignals: [
    { label: "Podcasts", sublabel: "Full catalog" },
    { label: "YouTube", sublabel: "Channels & videos" },
    { label: "GPT-4o", sublabel: "AI engine" },
    { label: "Free forever", sublabel: "No credit card" },
  ],

  // ---------------------------------------------------------------------------
  // 3. FEATURES
  // ---------------------------------------------------------------------------
  features: [
    {
      overline: "AI SUMMARIES",
      title: "Get the full picture without the full runtime",
      description:
        "Every episode gets a quick brief and a deep analysis — key takeaways, chapter breakdowns, and actionable insights. Two-minute read for an hour-long episode.",
    },
    {
      overline: "SMART DISCOVERY",
      title: "A feed that actually knows what you care about",
      description:
        "Your daily mix learns what you like and surfaces episodes worth your time. Trending topics, personalized recommendations, and genre-based curation — zero noise.",
    },
    {
      overline: "ASK AI",
      title: "Ask anything. Get cited answers.",
      description:
        "Have a question about an episode? Ask it. Yedapo responds with precise answers drawn directly from the transcript, with timestamps you can jump to.",
    },
    {
      overline: "PODCASTS + YOUTUBE",
      title: "One app for everything you follow",
      description:
        "Podcasts and YouTube channels live side by side. Follow, summarize, and explore across both — no switching apps, no fragmented experience.",
    },
  ],

  // ---------------------------------------------------------------------------
  // 4. HOW IT WORKS
  // ---------------------------------------------------------------------------
  howItWorks: [
    {
      step: 1,
      title: "Find",
      description:
        "Search or browse podcasts and YouTube channels across every genre.",
      icon: "search",
    },
    {
      step: 2,
      title: "Summarize",
      description:
        "Tap any episode to generate an AI summary with chapters, highlights, and key takeaways.",
      icon: "sparkles",
    },
    {
      step: 3,
      title: "Know",
      description:
        "Read the brief, ask follow-up questions, and walk away informed — in minutes, not hours.",
      icon: "lightbulb",
    },
  ],

  // ---------------------------------------------------------------------------
  // 5. USE CASES (replaces fabricated testimonials — more honest, more credible)
  // ---------------------------------------------------------------------------
  useCases: [
    {
      persona: "The Power Listener",
      description:
        "Follow 30+ podcasts? Scan AI summaries in your morning coffee break. Deep-dive only the episodes that actually matter.",
      metric: "10+ hours saved per week",
      icon: "headphones",
    },
    {
      persona: "The Researcher",
      description:
        "Need specific quotes from a 3-hour interview? Ask AI pulls them instantly — with transcript citations and timestamps.",
      metric: "Find any quote in seconds",
      icon: "book-open",
    },
    {
      persona: "The Creator",
      description:
        "Stay on top of every conversation in your niche. Get key takeaways from new episodes automatically, every day.",
      metric: "Never miss a trend",
      icon: "pen-tool",
    },
  ],

  // ---------------------------------------------------------------------------
  // 6. PRICING CTA
  // ---------------------------------------------------------------------------
  pricingCta: {
    headline: "Start free. Upgrade when you need more.",
    description:
      "3 AI summaries per day, forever free. No credit card required.",
  },

  // ---------------------------------------------------------------------------
  // 7. FINAL CTA
  // ---------------------------------------------------------------------------
  finalCta: {
    headline: "Stop listening to everything.\nStart knowing what matters.",
    subheadline: "Free forever. No credit card needed.",
    buttonText: "Get Started Free",
  },

  // ---------------------------------------------------------------------------
  // 8. FOOTER TAGLINE
  // ---------------------------------------------------------------------------
  footerTagline: "Know what matters.",
} as const;

// Type export for consumers
export type LandingCopy = typeof LANDING_COPY;
