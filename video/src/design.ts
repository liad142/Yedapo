// =============================================================================
// Yedapo Video — Design System
// Brand colors, typography, and shared constants
// =============================================================================

// Dark mode palette (kept for backwards compatibility)
export const COLORS = {
  primary: '#2196b8',
  primaryLight: '#4abbe6',
  primaryDark: '#1a6e8a',
  primaryGlow: 'rgba(33, 150, 184, 0.35)',
  primarySubtle: 'rgba(33, 150, 184, 0.08)',
  bgDark: '#0a0a0a',
  bgCard: '#141414',
  bgCardHover: '#1a1a1a',
  surface1: '#111111',
  surface2: '#1c1c1c',
  surface3: '#262626',
  textPrimary: '#f5f5f5',
  textSecondary: '#a1a1a1',
  textTertiary: '#6b6b6b',
  textMuted: '#4a4a4a',
  amber: '#f59e0b',
  green: '#22c55e',
  purple: '#8b5cf6',
  red: '#ef4444',
  gradientBrand: 'linear-gradient(135deg, #2196b8, #8b5cf6)',
  gradientGlow: 'radial-gradient(ellipse 60% 40% at 50% 50%, rgba(33, 150, 184, 0.25), transparent)',
  gradientHeroGlow: 'radial-gradient(ellipse 80% 50% at 50% 40%, rgba(33, 150, 184, 0.15), transparent 70%)',
} as const;

// Light mode palette — Notion-inspired (V3 creative direction)
export const LIGHT = {
  bg: '#ffffff',
  bgAlt: '#f8fafc',
  bgCard: '#ffffff',
  surface1: '#f1f5f9',
  surface2: '#f8fafc',
  surface3: '#e2e8f0',

  textPrimary: '#0f172a',
  textSecondary: '#475569',
  textTertiary: '#94a3b8',
  textMuted: '#cbd5e1',

  border: '#e2e8f0',
  borderStrong: '#cbd5e1',

  accent: '#2196b8',          // Yedapo teal
  accentLight: '#4abbe6',
  accentDark: '#1a6e8a',
  accentBg: 'rgba(33, 150, 184, 0.08)',
  accentBorder: 'rgba(33, 150, 184, 0.20)',

  green: '#16a34a',
  greenBg: 'rgba(22, 163, 74, 0.08)',
  amber: '#d97706',
  amberBg: 'rgba(217, 119, 6, 0.08)',
  red: '#dc2626',
  redBg: 'rgba(220, 38, 38, 0.08)',
  purple: '#7c3aed',
  purpleBg: 'rgba(124, 58, 237, 0.08)',

  shadow: '0 1px 3px rgba(15,23,42,0.05), 0 4px 16px rgba(15,23,42,0.05)',
  shadowMd: '0 4px 16px rgba(15,23,42,0.08), 0 1px 3px rgba(15,23,42,0.05)',
  shadowLg: '0 8px 32px rgba(15,23,42,0.10), 0 2px 8px rgba(15,23,42,0.06)',
} as const;

export const VIDEO = {
  WIDTH: 1920,
  HEIGHT: 1080,
  FPS: 30,
} as const;

// Scene durations — V3 Round 3 (scrolling demos, emotional hook, ~60s)
// Story: emotional hook → brand reveal → podcast demo (scroll) → YouTube demo (scroll) → Ask AI (scroll) → feature grid → CTA
export const SCENE_DURATIONS = {
  painPoint: 8.0,              // Hook: "Your queue is growing..." → emotional overwhelm
  brandIntro: 6.0,             // Brand reveal: Yedapo = the solution
  summaryDemo: 12.0,           // Podcast summary — full scroll through chapters, actions, takeaways
  featureAskAI: 10.0,          // YouTube/freeCodeCamp — scrolling summary with chapters
  featureDeepSummaries: 8.5,   // Ask AI — multi-exchange chat + scrolling chapters
  featureUnified: 6.0,         // Feature grid: summaries + ask AI + chapters
  ctaFinale: 9.0,              // CTA: Know more. Listen less.
} as const;

export const TOTAL_DURATION_SECONDS = Object.values(SCENE_DURATIONS).reduce(
  (sum, d) => sum + d,
  0,
);

export const TOTAL_FRAMES = Math.ceil(TOTAL_DURATION_SECONDS * VIDEO.FPS);
