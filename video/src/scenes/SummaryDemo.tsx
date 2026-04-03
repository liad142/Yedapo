import React from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Easing,
  Sequence,
} from 'remotion';
import { loadFont } from '@remotion/google-fonts/Inter';
import { COLORS } from '../design';
import { FloatingCard, ProgressBar, GlowOrb, SkeletonLine, Pill } from '../components/UIElements';
import { Typewriter } from '../components/AnimatedText';

const { fontFamily } = loadFont('normal', {
  weights: ['400', '500', '600', '700'],
  subsets: ['latin'],
});

const SUMMARY_LINES = [
  'The episode explores how AI is reshaping podcast consumption...',
  '3 key takeaways identified across the 2-hour discussion.',
  'Action items: Review suggested frameworks, test AI tools.',
];

/**
 * Scene 2b: Show Yedapo generating a summary in real-time.
 * A podcast card appears -> "Generating Summary..." -> summary text types in.
 */
export const SummaryDemo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.bgDark,
        fontFamily,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      <GlowOrb x={960} y={540} size={700} color="rgba(33, 150, 184, 0.12)" delay={0} />

      <div
        style={{
          display: 'flex',
          gap: 40,
          alignItems: 'flex-start',
        }}
      >
        {/* Left: podcast episode card */}
        <FloatingCard delay={0} width={420} height={280}>
          <div style={{ padding: 28 }}>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 20 }}>
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 12,
                  background: 'linear-gradient(135deg, #e74c3c, #c0392b)',
                  flexShrink: 0,
                }}
              />
              <div>
                <div style={{ fontSize: 17, fontWeight: 600, color: COLORS.textPrimary }}>
                  The Tim Ferriss Show
                </div>
                <div style={{ fontSize: 13, color: COLORS.textTertiary, marginTop: 2 }}>
                  #742 — Tools of Titans Revisited
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <Pill label="Interview" delay={10} />
              <Pill label="2h 14m" delay={16} />
            </div>
            {/* Waveform placeholder */}
            <div
              style={{
                display: 'flex',
                gap: 2,
                alignItems: 'flex-end',
                height: 40,
                marginBottom: 16,
              }}
            >
              {Array.from({ length: 60 }, (_, i) => {
                // Deterministic bar shape — no Math.random() to prevent per-frame flicker
                const barHeight = 8 + Math.sin(i * 0.5 + frame * 0.05) * 16 + Math.sin(i * 1.7) * 3;
                return (
                  <div
                    key={i}
                    style={{
                      width: 3,
                      height: Math.max(4, barHeight),
                      borderRadius: 2,
                      background:
                        i < (frame / fps) * 12
                          ? COLORS.primary
                          : COLORS.surface3,
                    }}
                  />
                );
              })}
            </div>
            <div style={{ fontSize: 13, color: COLORS.textTertiary }}>
              0:00 / 2:14:22
            </div>
          </div>
        </FloatingCard>

        {/* Right: summary generation */}
        <FloatingCard delay={15} width={520} height={380}>
          <div style={{ padding: 28 }}>
            {/* Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                marginBottom: 20,
              }}
            >
              <div
                style={{
                  fontSize: 20,
                  color: COLORS.primaryLight,
                }}
              >
                ✨
              </div>
              <div style={{ fontSize: 16, fontWeight: 600, color: COLORS.textPrimary }}>
                AI Summary
              </div>
            </div>

            {/* Progress bar */}
            <Sequence from={Math.round(1 * fps)} layout="none" premountFor={Math.round(0.5 * fps)}>
              <div style={{ marginBottom: 20 }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: 8,
                  }}
                >
                  <span style={{ fontSize: 13, color: COLORS.textSecondary }}>
                    Analyzing transcript...
                  </span>
                  <span style={{ fontSize: 13, color: COLORS.primaryLight, fontVariantNumeric: 'tabular-nums' }}>
                    {Math.min(100, Math.round(interpolate(
                      useCurrentFrame(),
                      [0, 2.5 * fps],
                      [0, 100],
                      { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.quad) }
                    )))}%
                  </span>
                </div>
                <ProgressBar delay={0} durationFrames={Math.round(2.5 * fps)} width={464} />
              </div>
            </Sequence>

            {/* Summary text typing in */}
            <Sequence from={Math.round(2 * fps)} layout="none" premountFor={Math.round(0.5 * fps)}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {SUMMARY_LINES.map((line, i) => (
                  <Sequence key={i} from={i * Math.round(0.8 * fps)} layout="none" premountFor={Math.round(0.3 * fps)}>
                    <Typewriter
                      text={line}
                      fontSize={15}
                      color={COLORS.textSecondary}
                      charFrames={1}
                      delay={0}
                      cursorColor={COLORS.primary}
                      showCursor={i === SUMMARY_LINES.length - 1}
                    />
                  </Sequence>
                ))}
              </div>
            </Sequence>
          </div>
        </FloatingCard>
      </div>
    </AbsoluteFill>
  );
};
