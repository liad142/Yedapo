import React from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Sequence,
} from 'remotion';
import { YedapoLogoMark } from '../components/UIElements';
import { loadFont } from '@remotion/google-fonts/Inter';
import { LIGHT } from '../design';
import { FadeUpWords } from '../components/AnimatedText';

const { fontFamily } = loadFont('normal', {
  weights: ['400', '600', '700', '800'],
  subsets: ['latin'],
});

/**
 * Scene 7: CTA Finale — light mode, homepage-appropriate.
 *
 * "Know more. Listen less."
 * Teal CTA button: "Try Free"
 * Subtitle: "Free forever · No credit card needed"
 * URL: yedapo.app
 * Yedapo wordmark at the bottom
 */
export const CtaFinale: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // CTA button appears at 1.2s with a satisfying bounce
  const ctaDelay = Math.round(1.2 * fps);
  const ctaProgress = spring({
    frame: frame - ctaDelay,
    fps,
    config: { damping: 16, stiffness: 260 },
  });

  // Subtle pulse after button settles
  const pulseStart = ctaDelay + Math.round(1.0 * fps);
  const pulseOffset = Math.max(0, frame - pulseStart);
  const buttonPulse = 1 + 0.014 * Math.sin(pulseOffset * 0.08);

  // Subtitle + URL
  const subDelay = Math.round(2.0 * fps);
  const subProgress = spring({ frame: frame - subDelay, fps, config: { damping: 200 } });

  // Logo mark
  const logoDelay = Math.round(3.2 * fps);
  const logoProgress = spring({ frame: frame - logoDelay, fps, config: { damping: 200 } });

  // Teal accent line under headline
  const lineDelay = Math.round(0.8 * fps);
  const lineProgress = spring({ frame: frame - lineDelay, fps, config: { damping: 200 }, durationInFrames: 24 });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: LIGHT.bg,
        fontFamily,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {/* Very subtle teal ambient */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: 1000,
          height: 800,
          borderRadius: '50%',
          background: 'radial-gradient(ellipse, rgba(33, 150, 184, 0.06) 0%, transparent 65%)',
          pointerEvents: 'none',
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
        {/* Line 1: secondary */}
        <Sequence from={4} layout="none">
          <div style={{ marginBottom: 8 }}>
            <FadeUpWords
              text="Know more."
              fontSize={72}
              fontWeight={700}
              color={LIGHT.textPrimary}
              delay={0}
              stagger={5}
            />
          </div>
        </Sequence>

        {/* Line 2: hero statement in teal */}
        <Sequence from={Math.round(0.5 * fps)} layout="none">
          <FadeUpWords
            text="Listen less."
            fontSize={72}
            fontWeight={800}
            color={LIGHT.accent}
            delay={0}
            stagger={5}
          />
        </Sequence>

        {/* Teal accent underline */}
        <div
          style={{
            width: interpolate(lineProgress, [0, 1], [0, 180], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            }),
            height: 5,
            background: LIGHT.accent,
            borderRadius: 3,
            marginTop: 18,
            marginBottom: 52,
          }}
        />

        {/* CTA Button — bounces in + pulses */}
        <div
          style={{
            opacity: interpolate(ctaProgress, [0, 1], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            }),
            transform: `translateY(${interpolate(ctaProgress, [0, 1], [28, 0], {
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
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '20px 60px',
              borderRadius: 18,
              background: LIGHT.accent,
              fontSize: 24,
              fontWeight: 700,
              color: '#ffffff',
              boxShadow: `0 8px 32px rgba(33, 150, 184, 0.35), 0 2px 8px rgba(33, 150, 184, 0.2)`,
              letterSpacing: '-0.01em',
            }}
          >
            Try Free
            <span style={{ fontSize: 20 }}>→</span>
          </div>
        </div>

        {/* Subtitle row */}
        <div
          style={{
            marginTop: 24,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 10,
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
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 20,
              fontSize: 22,
              color: LIGHT.textTertiary,
            }}
          >
            <span>Free forever</span>
            <span style={{ opacity: 0.4 }}>·</span>
            <span>No credit card needed</span>
            <span style={{ opacity: 0.4 }}>·</span>
            <span>Podcasts & YouTube</span>
          </div>
          <div
            style={{
              fontSize: 24,
              fontWeight: 700,
              color: LIGHT.accent,
              letterSpacing: '0.02em',
              opacity: 0.85,
            }}
          >
            yedapo.app
          </div>
        </div>

        {/* Yedapo premium logo + wordmark — appears at the end */}
        <div
          style={{
            marginTop: 56,
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            opacity: interpolate(logoProgress, [0, 1], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            }),
            transform: `scale(${interpolate(logoProgress, [0, 1], [0.88, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            })})`,
          }}
        >
          <YedapoLogoMark size={52} />
          <div
            style={{
              fontSize: 34,
              fontWeight: 800,
              color: LIGHT.textPrimary,
              letterSpacing: '-0.03em',
            }}
          >
            Yedapo
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
