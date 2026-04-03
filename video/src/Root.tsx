import { Composition, Folder } from 'remotion';
import { YedapoPromo } from './YedapoPromo';
import { PainPoint } from './scenes/PainPoint';
import { BrandIntro } from './scenes/BrandIntro';
import { SummaryDemo } from './scenes/SummaryDemo';
import {
  FeatureAskAI,
  FeatureDeepSummaries,
  FeatureUnified,
} from './scenes/FeatureShowcase';
import { CtaFinale } from './scenes/CtaFinale';
import { VIDEO, SCENE_DURATIONS, TOTAL_FRAMES } from './design';

const { WIDTH, HEIGHT, FPS } = VIDEO;
const sec = (s: number) => Math.round(s * FPS);

// Transition overlap: 6 transitions (V3): 2×FADE_LONG(30) + 4×FADE_FAST(20) = 140 frames
const TRANSITION_OVERLAP = 140;

export const RemotionRoot = () => {
  return (
    <>
      {/* Full promo video */}
      <Composition
        id="YedapoPromo"
        component={YedapoPromo}
        durationInFrames={TOTAL_FRAMES - TRANSITION_OVERLAP}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />

      {/* Individual scenes for iteration/preview */}
      <Folder name="Scenes">
        <Composition
          id="PainPoint"
          component={PainPoint}
          durationInFrames={sec(SCENE_DURATIONS.painPoint)}
          fps={FPS}
          width={WIDTH}
          height={HEIGHT}
        />
        <Composition
          id="BrandIntro"
          component={BrandIntro}
          durationInFrames={sec(SCENE_DURATIONS.brandIntro)}
          fps={FPS}
          width={WIDTH}
          height={HEIGHT}
        />
        <Composition
          id="SummaryDemo"
          component={SummaryDemo}
          durationInFrames={sec(SCENE_DURATIONS.summaryDemo)}
          fps={FPS}
          width={WIDTH}
          height={HEIGHT}
        />
        <Composition
          id="FeatureAskAI"
          component={FeatureAskAI}
          durationInFrames={sec(SCENE_DURATIONS.featureAskAI)}
          fps={FPS}
          width={WIDTH}
          height={HEIGHT}
        />
        <Composition
          id="FeatureDeepSummaries"
          component={FeatureDeepSummaries}
          durationInFrames={sec(SCENE_DURATIONS.featureDeepSummaries)}
          fps={FPS}
          width={WIDTH}
          height={HEIGHT}
        />
        <Composition
          id="FeatureUnified"
          component={FeatureUnified}
          durationInFrames={sec(SCENE_DURATIONS.featureUnified)}
          fps={FPS}
          width={WIDTH}
          height={HEIGHT}
        />
        <Composition
          id="CtaFinale"
          component={CtaFinale}
          durationInFrames={sec(SCENE_DURATIONS.ctaFinale)}
          fps={FPS}
          width={WIDTH}
          height={HEIGHT}
        />
      </Folder>
    </>
  );
};
