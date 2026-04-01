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
import { FadeUpWords } from '../components/AnimatedText';

const { fontFamily } = loadFont('normal', {
  weights: ['400', '600', '700', '800'],
  subsets: ['latin'],
});

const PODCAST_ITEMS = [
  { title: 'The Tim Ferriss Show', duration: '2h 14m', color: '#e74c3c' },
  { title: 'Huberman Lab', duration: '3h 08m', color: '#3498db' },
  { title: 'Lex Fridman Podcast', duration: '4h 22m', color: '#9b59b6' },
  { title: 'All-In Podcast', duration: '1h 47m', color: '#2ecc71' },
  { title: 'My First Million', duration: '1h 12m', color: '#f39c12' },
  { title: 'The Diary of a CEO', duration: '1h 55m', color: '#e67e22' },
  { title: 'Joe Rogan Experience', duration: '3h 41m', color: '#1abc9c' },
];

/**
 * Scene 1: The pain — too much content, not enough time. V2.
 *
 * V2 changes:
 * - Frame 0 is NOT black: counter visible immediately via fast linear reveal
 * - Items cascade 2x faster (3-frame stagger vs 6)
 * - Blur + overwhelm kicks in earlier (1.5s vs 2.5s)
 * - Tagline appears at 2.5s to leave reading time before scene ends at 4.5s
 */
export const PainPoint: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Phase 1: items cascade in (0–1.5s) — faster than V1
  // Phase 2: overwhelm blur (1.5–2.0s)
  // Phase 3: tagline fades in (2.5–4.5s)

  const blurStart = Math.round(1.5 * fps);
  const blurProgress = interpolate(frame, [blurStart, blurStart + Math.round(0.5 * fps)], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.quad),
  });

  // Counter counts up over 1.2s then holds
  const totalHours = interpolate(frame, [0, Math.round(1.2 * fps)], [0, 18], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.quad),
  });

  // Fast linear reveal for the counter — visible from frame 0 (fixes black opening)
  const counterOpacity = interpolate(frame, [0, 4], [0.5, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Ambient glow fades in fast
  const glowOpacity = interpolate(frame, [0, 8], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.bgDark,
        fontFamily,
        overflow: 'hidden',
      }}
    >
      {/* Ambient glow — fast entry */}
      <div
        style={{
          position: 'absolute',
          left: 960 - 400,
          top: 540 - 400,
          width: 800,
          height: 800,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(239,68,68,0.10), transparent 70%)',
          opacity: glowOpacity,
          pointerEvents: 'none',
        }}
      />

      {/* Hours counter — visible from frame 0, no Sequence delay */}
      <div
        style={{
          position: 'absolute',
          top: 40,
          right: 80,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          opacity: counterOpacity,
        }}
      >
        <div
          style={{
            fontSize: 80,
            fontWeight: 800,
            color: COLORS.red,
            fontVariantNumeric: 'tabular-nums',
            textShadow: `0 0 40px rgba(239, 68, 68, 0.5)`,
            lineHeight: 1,
          }}
        >
          {Math.round(totalHours)}h+
        </div>
        <div style={{ fontSize: 15, color: COLORS.textTertiary, fontWeight: 700, letterSpacing: '0.1em', marginTop: 6 }}>
          THIS WEEK
        </div>
      </div>

      {/* Podcast list — cascades in fast (3-frame stagger) */}
      <div
        style={{
          position: 'absolute',
          top: 80,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 680,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          filter: `blur(${blurProgress * 8}px)`,
          opacity: interpolate(blurProgress, [0, 1], [1, 0.25], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          }),
        }}
      >
        {PODCAST_ITEMS.map((item, i) => {
          // 3-frame stagger: all 7 items visible by frame 18 (0.6s)
          const itemDelay = i * 3;
          const itemProgress = spring({
            frame: frame - itemDelay,
            fps,
            config: { damping: 18, stiffness: 280 },
          });

          return (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                padding: '13px 20px',
                background: COLORS.bgCard,
                borderRadius: 12,
                border: `1px solid ${COLORS.surface3}`,
                opacity: interpolate(itemProgress, [0, 1], [0, 1], {
                  extrapolateLeft: 'clamp',
                  extrapolateRight: 'clamp',
                }),
                transform: `translateX(${interpolate(itemProgress, [0, 1], [60, 0], {
                  extrapolateLeft: 'clamp',
                  extrapolateRight: 'clamp',
                })}px)`,
              }}
            >
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 9,
                  background: item.color,
                  flexShrink: 0,
                }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 600, color: COLORS.textPrimary, marginBottom: 1 }}>
                  {item.title}
                </div>
                <div style={{ fontSize: 12, color: COLORS.textTertiary }}>New episode</div>
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.textSecondary, fontVariantNumeric: 'tabular-nums' }}>
                {item.duration}
              </div>
            </div>
          );
        })}
      </div>

      {/* Overwhelm overlay — tagline at 2.5s */}
      <Sequence from={Math.round(2.5 * fps)} layout="none">
        <AbsoluteFill
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
          }}
        >
          <FadeUpWords
            text="Too much to listen to."
            fontSize={60}
            fontWeight={700}
            color={COLORS.textPrimary}
            delay={0}
            stagger={4}
          />
          <FadeUpWords
            text="Not enough time."
            fontSize={60}
            fontWeight={700}
            color={COLORS.textSecondary}
            delay={18}
            stagger={4}
          />
        </AbsoluteFill>
      </Sequence>
    </AbsoluteFill>
  );
};
