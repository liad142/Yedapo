import React from 'react';
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Easing,
} from 'remotion';

// ---------------------------------------------------------------------------
// Fade-up text: each word fades in + slides up with stagger
// ---------------------------------------------------------------------------
type FadeUpWordsProps = {
  text: string;
  fontSize?: number;
  fontWeight?: number;
  color?: string;
  delay?: number;        // frames
  stagger?: number;      // frames between words
  lineHeight?: number;
  textAlign?: React.CSSProperties['textAlign'];
  maxWidth?: number;
};

export const FadeUpWords: React.FC<FadeUpWordsProps> = ({
  text,
  fontSize = 64,
  fontWeight = 700,
  color = '#f5f5f5',
  delay = 0,
  stagger = 4,
  lineHeight = 1.15,
  textAlign = 'center',
  maxWidth,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = text.split(' ');

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent:
          textAlign === 'center' ? 'center' : textAlign === 'right' ? 'flex-end' : 'flex-start',
        gap: `0 ${fontSize * 0.3}px`,
        lineHeight,
        maxWidth: maxWidth ?? '100%',
      }}
    >
      {words.map((word, i) => {
        const wordDelay = delay + i * stagger;
        const progress = spring({
          frame: frame - wordDelay,
          fps,
          config: { damping: 200 },
        });

        const opacity = interpolate(progress, [0, 1], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });
        const y = interpolate(progress, [0, 1], [30, 0], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });

        return (
          <span
            key={i}
            style={{
              fontSize,
              fontWeight,
              color,
              opacity,
              transform: `translateY(${y}px)`,
              display: 'inline-block',
              whiteSpace: 'pre',
            }}
          >
            {word}
          </span>
        );
      })}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Typewriter text
// ---------------------------------------------------------------------------
type TypewriterProps = {
  text: string;
  fontSize?: number;
  fontWeight?: number;
  color?: string;
  delay?: number;           // frames before typing starts
  charFrames?: number;      // frames per character
  cursorColor?: string;
  showCursor?: boolean;
};

export const Typewriter: React.FC<TypewriterProps> = ({
  text,
  fontSize = 28,
  fontWeight = 400,
  color = '#a1a1a1',
  delay = 0,
  charFrames = 2,
  cursorColor = '#2196b8',
  showCursor = true,
}) => {
  const frame = useCurrentFrame();
  const adjustedFrame = Math.max(0, frame - delay);
  const charCount = Math.min(text.length, Math.floor(adjustedFrame / charFrames));
  const displayed = text.slice(0, charCount);

  const cursorOpacity = interpolate(
    frame % 16,
    [0, 8, 16],
    [1, 0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  return (
    <div
      style={{
        fontSize,
        fontWeight,
        color,
        fontFamily: "'Inter', sans-serif",
        whiteSpace: 'pre-wrap',
      }}
    >
      <span>{displayed}</span>
      {showCursor && (
        <span style={{ opacity: cursorOpacity, color: cursorColor }}>|</span>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Glow text: text with animated glow behind it
// ---------------------------------------------------------------------------
type GlowTextProps = {
  text: string;
  fontSize?: number;
  fontWeight?: number;
  color?: string;
  glowColor?: string;
  delay?: number;
};

export const GlowText: React.FC<GlowTextProps> = ({
  text,
  fontSize = 80,
  fontWeight = 800,
  color = '#f5f5f5',
  glowColor = 'rgba(33, 150, 184, 0.6)',
  delay = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    frame: frame - delay,
    fps,
    config: { damping: 200 },
    durationInFrames: 30,
  });

  const opacity = interpolate(progress, [0, 1], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const scale = interpolate(progress, [0, 1], [0.9, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const glowSize = interpolate(progress, [0, 1], [0, 40], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        fontSize,
        fontWeight,
        color,
        opacity,
        transform: `scale(${scale})`,
        textShadow: `0 0 ${glowSize}px ${glowColor}, 0 0 ${glowSize * 2}px ${glowColor}`,
        textAlign: 'center',
      }}
    >
      {text}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Counter: animated number counting up
// ---------------------------------------------------------------------------
type CounterProps = {
  from?: number;
  to: number;
  suffix?: string;
  prefix?: string;
  fontSize?: number;
  fontWeight?: number;
  color?: string;
  delay?: number;
  durationFrames?: number;
};

export const Counter: React.FC<CounterProps> = ({
  from = 0,
  to,
  suffix = '',
  prefix = '',
  fontSize = 64,
  fontWeight = 800,
  color = '#f5f5f5',
  delay = 0,
  durationFrames = 45,
}) => {
  const frame = useCurrentFrame();
  const adjustedFrame = Math.max(0, frame - delay);

  const value = interpolate(adjustedFrame, [0, durationFrames], [from, to], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.quad),
  });

  return (
    <span style={{ fontSize, fontWeight, color, fontVariantNumeric: 'tabular-nums' }}>
      {prefix}{Math.round(value)}{suffix}
    </span>
  );
};
