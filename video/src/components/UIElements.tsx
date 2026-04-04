import React from 'react';
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Easing,
  Img,
  staticFile,
} from 'remotion';
import { COLORS, LIGHT } from '../design';

// ---------------------------------------------------------------------------
// Dark mode: animated card that slides in and scales up (legacy)
// ---------------------------------------------------------------------------
type FloatingCardProps = {
  children: React.ReactNode;
  delay?: number;
  width?: number;
  height?: number;
  style?: React.CSSProperties;
};

export const FloatingCard: React.FC<FloatingCardProps> = ({
  children,
  delay = 0,
  width = 500,
  height = 340,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    frame: frame - delay,
    fps,
    config: { damping: 20, stiffness: 200 },
  });

  const opacity = interpolate(progress, [0, 1], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const y = interpolate(progress, [0, 1], [60, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const scale = interpolate(progress, [0, 1], [0.92, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        width,
        height,
        background: COLORS.bgCard,
        borderRadius: 20,
        border: `1px solid ${COLORS.surface3}`,
        boxShadow: `0 20px 60px rgba(0,0,0,0.5), 0 0 40px ${COLORS.primaryGlow}`,
        opacity,
        transform: `translateY(${y}px) scale(${scale})`,
        overflow: 'hidden',
        position: 'relative',
        ...style,
      }}
    >
      {children}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Light mode card — Notion-style, white with drop shadow
// ---------------------------------------------------------------------------
type LightCardProps = {
  children: React.ReactNode;
  delay?: number;
  width?: number;
  height?: number;
  style?: React.CSSProperties;
};

export const LightCard: React.FC<LightCardProps> = ({
  children,
  delay = 0,
  width = 500,
  height = 340,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    frame: frame - delay,
    fps,
    config: { damping: 22, stiffness: 220 },
  });

  const opacity = interpolate(progress, [0, 1], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const y = interpolate(progress, [0, 1], [40, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const scale = interpolate(progress, [0, 1], [0.94, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        width,
        height,
        background: LIGHT.bgCard,
        borderRadius: 20,
        border: `1px solid ${LIGHT.border}`,
        boxShadow: LIGHT.shadowLg,
        opacity,
        transform: `translateY(${y}px) scale(${scale})`,
        overflow: 'hidden',
        position: 'relative',
        ...style,
      }}
    >
      {children}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Pill badge (dark mode legacy)
// ---------------------------------------------------------------------------
type PillProps = {
  label: string;
  delay?: number;
  color?: string;
  bgColor?: string;
};

export const Pill: React.FC<PillProps> = ({
  label,
  delay = 0,
  color = COLORS.primaryLight,
  bgColor = 'rgba(33, 150, 184, 0.15)',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    frame: frame - delay,
    fps,
    config: { damping: 200 },
  });

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 20px',
        borderRadius: 100,
        background: bgColor,
        border: `1px solid ${color}33`,
        opacity: interpolate(progress, [0, 1], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
        transform: `scale(${interpolate(progress, [0, 1], [0.8, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })})`,
      }}
    >
      <span
        style={{
          fontSize: 20,
          fontWeight: 600,
          color,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </span>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Light mode pill badge
// ---------------------------------------------------------------------------
type LightPillProps = {
  label: string;
  delay?: number;
  color?: string;
  bgColor?: string;
};

export const LightPill: React.FC<LightPillProps> = ({
  label,
  delay = 0,
  color = LIGHT.accent,
  bgColor = LIGHT.accentBg,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    frame: frame - delay,
    fps,
    config: { damping: 200 },
  });

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '6px 16px',
        borderRadius: 100,
        background: bgColor,
        border: `1px solid ${color}33`,
        opacity: interpolate(progress, [0, 1], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
        transform: `translateY(${interpolate(progress, [0, 1], [8, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}px)`,
      }}
    >
      <span
        style={{
          fontSize: 20,
          fontWeight: 600,
          color,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </span>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Progress bar that fills up
// ---------------------------------------------------------------------------
type ProgressBarProps = {
  delay?: number;
  durationFrames?: number;
  color?: string;
  height?: number;
  width?: number;
  targetPercent?: number;
  trackColor?: string;
};

export const ProgressBar: React.FC<ProgressBarProps> = ({
  delay = 0,
  durationFrames = 60,
  color = COLORS.primary,
  height = 6,
  width = 400,
  targetPercent = 100,
  trackColor,
}) => {
  const frame = useCurrentFrame();
  const adjustedFrame = Math.max(0, frame - delay);

  const percent = interpolate(adjustedFrame, [0, durationFrames], [0, targetPercent], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.quad),
  });

  return (
    <div
      style={{
        width,
        height,
        borderRadius: height,
        background: trackColor ?? COLORS.surface3,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          width: `${percent}%`,
          height: '100%',
          borderRadius: height,
          background: `linear-gradient(90deg, ${color}, ${color}cc)`,
          boxShadow: `0 0 8px ${color}55`,
        }}
      />
    </div>
  );
};

// ---------------------------------------------------------------------------
// Glowing orb (ambient background effect — dark mode)
// ---------------------------------------------------------------------------
type GlowOrbProps = {
  x: number;
  y: number;
  size?: number;
  color?: string;
  delay?: number;
  pulse?: boolean;
};

export const GlowOrb: React.FC<GlowOrbProps> = ({
  x,
  y,
  size = 400,
  color = COLORS.primaryGlow,
  delay = 0,
  pulse = true,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entryProgress = spring({
    frame: frame - delay,
    fps,
    config: { damping: 200 },
    durationInFrames: 60,
  });

  const pulseScale = pulse
    ? 1 + 0.05 * Math.sin((frame - delay) * 0.03)
    : 1;

  return (
    <div
      style={{
        position: 'absolute',
        left: x - size / 2,
        top: y - size / 2,
        width: size,
        height: size,
        borderRadius: '50%',
        background: `radial-gradient(circle, ${color}, transparent 70%)`,
        opacity: interpolate(entryProgress, [0, 1], [0, 0.6], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        }),
        transform: `scale(${pulseScale})`,
        pointerEvents: 'none',
      }}
    />
  );
};

// ---------------------------------------------------------------------------
// Mock UI skeleton line
// ---------------------------------------------------------------------------
type SkeletonLineProps = {
  width: number | string;
  height?: number;
  delay?: number;
  color?: string;
  borderRadius?: number;
};

export const SkeletonLine: React.FC<SkeletonLineProps> = ({
  width,
  height = 12,
  delay = 0,
  color = COLORS.surface3,
  borderRadius = 6,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    frame: frame - delay,
    fps,
    config: { damping: 200 },
  });

  return (
    <div
      style={{
        width,
        height,
        borderRadius,
        background: color,
        opacity: interpolate(progress, [0, 1], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        }),
        transform: `scaleX(${interpolate(progress, [0, 1], [0.3, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        })})`,
        transformOrigin: 'left',
      }}
    />
  );
};

// ---------------------------------------------------------------------------
// Feature icon circle (dark mode)
// ---------------------------------------------------------------------------
type FeatureIconProps = {
  icon: string;
  delay?: number;
  size?: number;
};

export const FeatureIcon: React.FC<FeatureIconProps> = ({
  icon,
  delay = 0,
  size = 80,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    frame: frame - delay,
    fps,
    config: { damping: 20, stiffness: 200 },
  });

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        background: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.purple})`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.45,
        boxShadow: `0 8px 30px ${COLORS.primaryGlow}`,
        opacity: interpolate(progress, [0, 1], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        }),
        transform: `scale(${interpolate(progress, [0, 1], [0.5, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        })})`,
      }}
    >
      {icon}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Yedapo Premium Logo Mark — SVG soundwave, dark container, crisp at any size
// ---------------------------------------------------------------------------
type YedapoLogoMarkProps = {
  /** Size of the square container in pixels */
  size?: number;
  /** Renders continuously expanding teal ripple rings — for hero moments */
  showGlowRings?: boolean;
  /** Overall opacity of the entire mark */
  opacity?: number;
};

export const YedapoLogoMark: React.FC<YedapoLogoMarkProps> = ({
  size = 96,
  showGlowRings = false,
  opacity = 1,
}) => {
  const frame = useCurrentFrame();
  const r = Math.round(size * 0.24);

  return (
    <div style={{ position: 'relative', width: size, height: size, opacity, flexShrink: 0 }}>
      {/* Expanding ripple rings — 3 rings cycling every 90 frames */}
      {showGlowRings && [0, 30, 60].map((phaseOffset, i) => {
        const cycle = ((frame + phaseOffset) % 90 + 90) % 90;
        const ro = interpolate(cycle, [0, 45, 89], [0.55, 0.18, 0], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });
        const rs = interpolate(cycle, [0, 89], [1.0, 2.4], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: r,
              border: `1.5px solid rgba(33, 150, 184, ${ro})`,
              transform: `scale(${rs})`,
              pointerEvents: 'none',
            }}
          />
        );
      })}

      {/* Dark gradient container */}
      <div
        style={{
          width: size,
          height: size,
          borderRadius: r,
          background: 'linear-gradient(148deg, #0e1e35 0%, #0c2540 55%, #091a2c 100%)',
          boxShadow: [
            `0 ${Math.round(size * 0.06)}px ${Math.round(size * 0.22)}px rgba(33, 150, 184, 0.30)`,
            `0 ${Math.round(size * 0.14)}px ${Math.round(size * 0.45)}px rgba(10, 22, 40, 0.45)`,
          ].join(', '),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Inner teal glow bloom */}
        <div
          style={{
            position: 'absolute',
            bottom: -(size * 0.2),
            left: '50%',
            transform: 'translateX(-50%)',
            width: size * 1.5,
            height: size * 0.85,
            borderRadius: '50%',
            background: 'radial-gradient(ellipse, rgba(33, 150, 184, 0.22) 0%, transparent 65%)',
            pointerEvents: 'none',
          }}
        />

        {/* Original Yedapo logo */}
        <Img
          src={staticFile('logo-icon.png')}
          style={{
            width: size * 0.82,
            height: size * 0.82,
            objectFit: 'contain',
            position: 'relative',
            zIndex: 1,
            filter: 'drop-shadow(0 4px 12px rgba(33, 150, 184, 0.5))',
          }}
        />
      </div>
    </div>
  );
};
