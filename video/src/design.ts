// =============================================================================
// Yedapo Video — Design System
// Brand colors, typography, and shared constants
// =============================================================================

export const COLORS = {
  // Core brand
  primary: '#2196b8',        // HSL(200, 70%, 41%) — Yedapo teal
  primaryLight: '#4abbe6',   // HSL(200, 75%, 58%)
  primaryDark: '#1a6e8a',    // HSL(200, 70%, 32%)
  primaryGlow: 'rgba(33, 150, 184, 0.35)',
  primarySubtle: 'rgba(33, 150, 184, 0.08)',

  // Surfaces
  bgDark: '#0a0a0a',
  bgCard: '#141414',
  bgCardHover: '#1a1a1a',
  surface1: '#111111',
  surface2: '#1c1c1c',
  surface3: '#262626',

  // Text
  textPrimary: '#f5f5f5',
  textSecondary: '#a1a1a1',
  textTertiary: '#6b6b6b',
  textMuted: '#4a4a4a',

  // Accents
  amber: '#f59e0b',
  green: '#22c55e',
  purple: '#8b5cf6',
  red: '#ef4444',

  // Gradients (as CSS values)
  gradientBrand: 'linear-gradient(135deg, #2196b8, #8b5cf6)',
  gradientGlow: 'radial-gradient(ellipse 60% 40% at 50% 50%, rgba(33, 150, 184, 0.25), transparent)',
  gradientHeroGlow: 'radial-gradient(ellipse 80% 50% at 50% 40%, rgba(33, 150, 184, 0.15), transparent 70%)',
} as const;

export const VIDEO = {
  WIDTH: 1920,
  HEIGHT: 1080,
  FPS: 30,
} as const;

// Scene durations in seconds — V2 (cut 3 repeat feature scenes, tightened pacing)
export const SCENE_DURATIONS = {
  painPoint: 4.5,
  brandIntro: 3.5,
  summaryDemo: 4.5,
  featureAskAI: 4,
  featureDeepSummaries: 4,
  featureUnified: 3.5,
  ctaFinale: 6,
} as const;

export const TOTAL_DURATION_SECONDS = Object.values(SCENE_DURATIONS).reduce(
  (sum, d) => sum + d,
  0
);

export const TOTAL_FRAMES = Math.ceil(TOTAL_DURATION_SECONDS * VIDEO.FPS);
