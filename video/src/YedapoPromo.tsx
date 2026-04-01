import React from 'react';
import { TransitionSeries, linearTiming } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import { VIDEO, SCENE_DURATIONS } from './design';

import { PainPoint } from './scenes/PainPoint';
import { BrandIntro } from './scenes/BrandIntro';
import { SummaryDemo } from './scenes/SummaryDemo';
import {
  FeatureAskAI,
  FeatureDeepSummaries,
  FeatureUnified,
} from './scenes/FeatureShowcase';
import { CtaFinale } from './scenes/CtaFinale';

const { FPS } = { FPS: VIDEO.FPS };

const sec = (s: number) => Math.round(s * FPS);

// V2 transition constants — shorter, snappier, consistent
const FADE_FAST = 12;  // 0.4s — default between scenes
const FADE_LONG = 20;  // 0.67s — used for the brand reveal moment

/**
 * Yedapo Promo Video — V2 Composition
 *
 * Story arc:
 * 1. Pain point (overwhelm) — frame 0 visible, fast cascade
 * 2. Brand reveal (Yedapo)
 * 3. Summary generation demo
 * 4. Feature: Ask AI (best interaction demo)
 * 5. Feature: Deep Summaries (core value)
 * 6. Feature: Unified experience (differentiator)
 * 7. CTA finale — harder landing
 *
 * V2 changes vs V1:
 * - Cut 3 repetitive feature scenes (SmartPlayer, ActionItems, Chapters)
 * - Standardized transitions to fast fade (12 frames) — no mixed slide/fade
 * - Longer fade into brand intro for dramatic effect (20 frames)
 * - Total runtime ~30s (was ~42s)
 */
export const YedapoPromo: React.FC = () => {
  return (
    <TransitionSeries>
      {/* Scene 1: The Pain */}
      <TransitionSeries.Sequence durationInFrames={sec(SCENE_DURATIONS.painPoint)}>
        <PainPoint />
      </TransitionSeries.Sequence>

      {/* Longer fade into brand — gives the emotional beat room */}
      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: FADE_LONG })}
      />

      {/* Scene 2: Brand Intro */}
      <TransitionSeries.Sequence durationInFrames={sec(SCENE_DURATIONS.brandIntro)}>
        <BrandIntro />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: FADE_FAST })}
      />

      {/* Scene 3: Summary Demo */}
      <TransitionSeries.Sequence durationInFrames={sec(SCENE_DURATIONS.summaryDemo)}>
        <SummaryDemo />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: FADE_FAST })}
      />

      {/* Feature: Ask AI */}
      <TransitionSeries.Sequence durationInFrames={sec(SCENE_DURATIONS.featureAskAI)}>
        <FeatureAskAI />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: FADE_FAST })}
      />

      {/* Feature: Deep Summaries */}
      <TransitionSeries.Sequence durationInFrames={sec(SCENE_DURATIONS.featureDeepSummaries)}>
        <FeatureDeepSummaries />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: FADE_FAST })}
      />

      {/* Feature: Unified Experience */}
      <TransitionSeries.Sequence durationInFrames={sec(SCENE_DURATIONS.featureUnified)}>
        <FeatureUnified />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: FADE_LONG })}
      />

      {/* Scene 7: CTA Finale */}
      <TransitionSeries.Sequence durationInFrames={sec(SCENE_DURATIONS.ctaFinale)}>
        <CtaFinale />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  );
};
