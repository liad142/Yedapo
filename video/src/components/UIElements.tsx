import React from 'react';
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Easing,
} from 'remotion';
import { COLORS } from '../design';

// ---------------------------------------------------------------------------
// Animated card that slides in and scales up
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
// Pill badge
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
          fontSize: 14,
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
// Progress bar that fills up
// ---------------------------------------------------------------------------
type ProgressBarProps = {
  delay?: number;
  durationFrames?: number;
  color?: string;
  height?: number;
  width?: number;
  targetPercent?: number;
};

export const ProgressBar: React.FC<ProgressBarProps> = ({
  delay = 0,
  durationFrames = 60,
  color = COLORS.primary,
  height = 6,
  width = 400,
  targetPercent = 100,
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
        background: COLORS.surface3,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          width: `${percent}%`,
          height: '100%',
          borderRadius: height,
          background: `linear-gradient(90deg, ${color}, ${COLORS.primaryLight})`,
          boxShadow: `0 0 10px ${color}66`,
        }}
      />
    </div>
  );
};

// ---------------------------------------------------------------------------
// Glowing orb (ambient background effect)
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
// Mock UI skeleton line (for simulating content)
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
// Feature icon circle
// ---------------------------------------------------------------------------
type FeatureIconProps = {
  icon: string;   // emoji or text
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
