import React from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Sequence,
  Easing,
} from 'remotion';
import { loadFont } from '@remotion/google-fonts/Inter';
import { COLORS } from '../design';
import { GlowOrb } from '../components/UIElements';
import { GlowText, FadeUpWords } from '../components/AnimatedText';

const { fontFamily } = loadFont('normal', {
  weights: ['400', '600', '700', '800'],
  subsets: ['latin'],
});

/**
 * Scene 7: Closing CTA — "Know what matters." V2
 *
 * V2 changes:
 * - CTA button appears at 1s (was 2.5s) — lands harder, more screen time
 * - Subtitle + URL hint at 1.8s (was 3s)
 * - Button has subtle pulse after settling
 * - Logo is larger and more prominent
 * - Rotating ring is more visible
 * - Second tagline line is bigger / bolder
 */
export const CtaFinale: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Spinning gradient ring entrance
  const ringProgress = spring({
    frame,
    fps,
    config: { damping: 200 },
    durationInFrames: 45,
  });
  const ringScale = interpolate(ringProgress, [0, 1], [0.4, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const ringOpacity = interpolate(ringProgress, [0, 1], [0, 0.55], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // CTA button — earlier than V1 (1s vs 2.5s)
  const ctaDelay = Math.round(1 * fps);
  const ctaProgress = spring({
    frame: frame - ctaDelay,
    fps,
    config: { damping: 18, stiffness: 250 },
  });

  // Pulse animation on button after it settles (~1.5s after ctaDelay)
  const pulseStart = ctaDelay + Math.round(1.2 * fps);
  const pulseOffset = Math.max(0, frame - pulseStart);
  const buttonPulse = 1 + 0.018 * Math.sin(pulseOffset * 0.07);

  // Subtitle + URL — earlier (1.8s vs 3s)
  const subDelay = Math.round(1.8 * fps);
  const subProgress = spring({
    frame: frame - subDelay,
    fps,
    config: { damping: 200 },
  });

  // Logo entrance
  const logoDelay = Math.round(2.5 * fps);
  const logoProgress = spring({
    frame: frame - logoDelay,
    fps,
    config: { damping: 200 },
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
      {/* Background glow — stronger than V1 */}
      <GlowOrb x={960} y={540} size={1000} color="rgba(33, 150, 184, 0.15)" delay={0} pulse />
      <GlowOrb x={960} y={540} size={650} color="rgba(139, 92, 246, 0.10)" delay={5} pulse />

      {/* Decorative spinning gradient ring — more visible */}
      <div
        style={{
          position: 'absolute',
          width: 560,
          height: 560,
          borderRadius: '50%',
          border: '2px solid transparent',
          background: `conic-gradient(from ${frame * 1.8}deg, ${COLORS.primary}00, ${COLORS.primary}, ${COLORS.purple}, ${COLORS.primary}00) border-box`,
          WebkitMask: 'linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0)',
          WebkitMaskComposite: 'xor',
          maskComposite: 'exclude',
          opacity: ringOpacity,
          transform: `scale(${ringScale})`,
        }}
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
        {/* First line — secondary weight */}
        <Sequence from={5} layout="none">
          <div style={{ marginBottom: 12 }}>
            <FadeUpWords
              text="Stop listening to everything."
              fontSize={44}
              fontWeight={600}
              color={COLORS.textSecondary}
              delay={0}
              stagger={4}
            />
          </div>
        </Sequence>

        {/* Second line — the hero statement */}
        <Sequence from={Math.round(0.7 * fps)} layout="none">
          <GlowText
            text="Start knowing what matters."
            fontSize={62}
            fontWeight={800}
            color={COLORS.textPrimary}
            glowColor="rgba(33, 150, 184, 0.55)"
            delay={0}
          />
        </Sequence>

        {/* CTA Button — appears at 1s with bounce + pulse */}
        <div
          style={{
            marginTop: 52,
            opacity: interpolate(ctaProgress, [0, 1], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            }),
            transform: `translateY(${interpolate(ctaProgress, [0, 1], [24, 0], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            })}px) scale(${
              interpolate(ctaProgress, [0, 1], [0.88, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              }) * buttonPulse
            })`,
          }}
        >
          <div
            style={{
              padding: '18px 56px',
              borderRadius: 16,
              background: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.purple})`,
              fontSize: 22,
              fontWeight: 700,
              color: '#ffffff',
              boxShadow: `0 10px 40px ${COLORS.primaryGlow}, 0 0 80px rgba(139, 92, 246, 0.25)`,
              letterSpacing: '0.02em',
            }}
          >
            Get Started Free
          </div>
        </div>

        {/* Subtitle + URL */}
        <div
          style={{
            marginTop: 22,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8,
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
          <div style={{ fontSize: 16, color: COLORS.textTertiary }}>
            Free forever · No credit card needed
          </div>
          <div
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: COLORS.primaryLight,
              letterSpacing: '0.05em',
            }}
          >
            yedapo.app
          </div>
        </div>

        {/* Logo mark — appears at 2.5s, more prominent than V1 */}
        <div
          style={{
            marginTop: 52,
            opacity: interpolate(logoProgress, [0, 1], [0, 0.85], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            }),
            transform: `scale(${interpolate(logoProgress, [0, 1], [0.9, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            })})`,
          }}
        >
          <div
            style={{
              fontSize: 36,
              fontWeight: 800,
              background: 'linear-gradient(135deg, #ffffff 30%, #4abbe6 70%, #8b5cf6)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              color: 'transparent',
              letterSpacing: '-0.02em',
              textShadow: 'none',
            }}
          >
            Yedapo
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
