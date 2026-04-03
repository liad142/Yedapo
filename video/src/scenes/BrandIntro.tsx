import React from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from 'remotion';
import { loadFont } from '@remotion/google-fonts/Inter';
import { COLORS } from '../design';
import { GlowOrb } from '../components/UIElements';

const { fontFamily } = loadFont('normal', {
  weights: ['400', '700', '800'],
  subsets: ['latin'],
});

/**
 * Scene 2a: Brand reveal — Yedapo logo/name with premium entrance.
 * Tagline: "Know what matters."
 */
export const BrandIntro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Logo entrance
  const logoProgress = spring({
    frame,
    fps,
    config: { damping: 20, stiffness: 200 },
  });

  // Tagline entrance (delayed)
  const tagDelay = 20;
  const tagProgress = spring({
    frame: frame - tagDelay,
    fps,
    config: { damping: 200 },
  });

  // Line separator
  const lineDelay = 10;
  const lineProgress = spring({
    frame: frame - lineDelay,
    fps,
    config: { damping: 200 },
    durationInFrames: 30,
  });

  // Subtitle
  const subDelay = 35;
  const subProgress = spring({
    frame: frame - subDelay,
    fps,
    config: { damping: 200 },
  });

  const glowIntensity = interpolate(frame, [0, 1.5 * fps], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

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
      {/* Brand glow behind logo */}
      <GlowOrb
        x={960}
        y={480}
        size={600}
        color={`rgba(33, 150, 184, ${0.2 * glowIntensity})`}
        delay={0}
        pulse
      />
      <GlowOrb
        x={960}
        y={540}
        size={900}
        color={`rgba(139, 92, 246, ${0.08 * glowIntensity})`}
        delay={10}
        pulse
      />

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 0,
          zIndex: 1,
        }}
      >
        {/* Logo text */}
        <div
          style={{
            fontSize: 96,
            fontWeight: 800,
            background: 'linear-gradient(135deg, #ffffff 30%, #4abbe6 70%, #8b5cf6)',
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            color: 'transparent',
            letterSpacing: '-0.02em',
            opacity: interpolate(logoProgress, [0, 1], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            }),
            transform: `scale(${interpolate(logoProgress, [0, 1], [0.8, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            })})`,
            textShadow: `0 0 60px ${COLORS.primaryGlow}`,
          }}
        >
          Yedapo
        </div>

        {/* Separator line */}
        <div
          style={{
            width: interpolate(lineProgress, [0, 1], [0, 120], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            }),
            height: 2,
            background: `linear-gradient(90deg, transparent, ${COLORS.primaryLight}, transparent)`,
            marginTop: 8,
            marginBottom: 20,
          }}
        />

        {/* Tagline */}
        <div
          style={{
            fontSize: 28,
            fontWeight: 400,
            color: COLORS.textSecondary,
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            opacity: interpolate(tagProgress, [0, 1], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            }),
            transform: `translateY(${interpolate(tagProgress, [0, 1], [15, 0], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            })}px)`,
          }}
        >
          Know what matters.
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontSize: 20,
            fontWeight: 400,
            color: COLORS.textTertiary,
            marginTop: 16,
            opacity: interpolate(subProgress, [0, 1], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            }),
            transform: `translateY(${interpolate(subProgress, [0, 1], [10, 0], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            })}px)`,
          }}
        >
          AI-powered podcast intelligence
        </div>
      </div>
    </AbsoluteFill>
  );
};
