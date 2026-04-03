import React from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Sequence,
  Img,
  staticFile,
} from 'remotion';
import { YedapoLogoMark } from '../components/UIElements';
import { loadFont } from '@remotion/google-fonts/Inter';
import { LIGHT } from '../design';

const { fontFamily } = loadFont('normal', {
  weights: ['400', '500', '600', '700', '800'],
  subsets: ['latin'],
});

/**
 * Scene 2: Brand reveal — Yedapo is the solution.
 *
 * Notion-inspired: clean white background, large dark text,
 * teal accent underline, minimal supporting copy.
 * No glows, no gradients — confidence through simplicity.
 */
export const BrandIntro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const iconProgress = spring({ frame, fps, config: { damping: 20, stiffness: 160 } });
  const logoProgress = spring({ frame: frame - 15, fps, config: { damping: 22, stiffness: 180 } });
  const lineProgress = spring({ frame: frame - 28, fps, config: { damping: 200 }, durationInFrames: 28 });
  const tagProgress = spring({ frame: frame - 40, fps, config: { damping: 200 } });
  const subProgress = spring({ frame: frame - 58, fps, config: { damping: 200 } });
  const badgeProgress = spring({ frame: frame - 76, fps, config: { damping: 200 } });

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
      {/* Very subtle teal ambient behind the logo */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: 900,
          height: 700,
          borderRadius: '50%',
          background: 'radial-gradient(ellipse, rgba(33, 150, 184, 0.05) 0%, transparent 65%)',
          pointerEvents: 'none',
        }}
      />

      {/* Subtle dot grid background */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'radial-gradient(rgba(33, 150, 184, 0.09) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          zIndex: 1,
        }}
      >
        {/* Yedapo premium logo mark — appears first with ripple rings */}
        <div
          style={{
            marginBottom: 28,
            opacity: interpolate(iconProgress, [0, 1], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            }),
            transform: `scale(${interpolate(iconProgress, [0, 1], [0.45, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            })})`,
          }}
        >
          <YedapoLogoMark size={148} showGlowRings />
        </div>

        {/* Logo wordmark */}
        <div
          style={{
            fontSize: 108,
            fontWeight: 800,
            color: LIGHT.textPrimary,
            letterSpacing: '-0.04em',
            lineHeight: 1,
            opacity: interpolate(logoProgress, [0, 1], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            }),
            transform: `translateY(${interpolate(logoProgress, [0, 1], [32, 0], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            })}px)`,
          }}
        >
          Yedapo
        </div>

        {/* Teal accent underline — draws in from center */}
        <div
          style={{
            width: interpolate(lineProgress, [0, 1], [0, 148], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            }),
            height: 5,
            background: LIGHT.accent,
            borderRadius: 3,
            marginTop: 14,
            marginBottom: 32,
          }}
        />

        {/* Primary tagline */}
        <div
          style={{
            fontSize: 38,
            fontWeight: 600,
            color: LIGHT.textPrimary,
            letterSpacing: '-0.015em',
            opacity: interpolate(tagProgress, [0, 1], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            }),
            transform: `translateY(${interpolate(tagProgress, [0, 1], [18, 0], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            })}px)`,
          }}
        >
          Know what matters. In minutes.
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontSize: 26,
            fontWeight: 400,
            color: LIGHT.textTertiary,
            marginTop: 16,
            letterSpacing: '-0.005em',
            opacity: interpolate(subProgress, [0, 1], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            }),
            transform: `translateY(${interpolate(subProgress, [0, 1], [12, 0], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            })}px)`,
          }}
        >
          AI summaries for podcasts & YouTube
        </div>

        {/* Platform badges */}
        <Sequence from={Math.round(2.6 * fps)} layout="none">
          <div
            style={{
              display: 'flex',
              gap: 12,
              marginTop: 36,
              opacity: interpolate(badgeProgress, [0, 1], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              }),
              transform: `translateY(${interpolate(badgeProgress, [0, 1], [10, 0], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              })}px)`,
            }}
          >
            {/* Podcast badge — dark premium pill */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 22px',
                background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
                borderRadius: 100,
                border: '1px solid rgba(255, 255, 255, 0.08)',
                boxShadow: '0 2px 12px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.06)',
              }}
            >
              <span style={{ fontSize: 18 }}>🎙️</span>
              <span style={{ color: '#e0e0e0', fontSize: 22, fontWeight: 600, letterSpacing: '0.5px' }}>
                Podcasts
              </span>
            </div>
            {/* Teal divider dot */}
            <div style={{ width: 4, height: 4, borderRadius: '50%', background: 'rgba(33, 150, 184, 0.5)' }} />
            {/* YouTube badge — dark premium pill */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 22px',
                background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
                borderRadius: 100,
                border: '1px solid rgba(255, 255, 255, 0.08)',
                boxShadow: '0 2px 12px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.06)',
              }}
            >
              <Img
                src={staticFile('youtube-logo.svg')}
                style={{ width: 22, height: 16, objectFit: 'contain' }}
              />
              <span style={{ color: '#e0e0e0', fontSize: 22, fontWeight: 600, letterSpacing: '0.5px' }}>
                YouTube
              </span>
            </div>
          </div>
        </Sequence>
      </div>
    </AbsoluteFill>
  );
};
