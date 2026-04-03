import React from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Easing,
  Sequence,
  Img,
  staticFile,
} from 'remotion';
import { loadFont } from '@remotion/google-fonts/Inter';
import { LIGHT } from '../design';
import { FadeUpWords } from '../components/AnimatedText';

const { fontFamily } = loadFont('normal', {
  weights: ['400', '500', '600', '700', '800'],
  subsets: ['latin'],
});

const PODCAST_ITEMS = [
  { show: 'Huberman Lab', episode: 'Protocols for Perfect Sleep', duration: '3h 08m', artwork: 'podcast-huberman.jpg' },
  { show: 'The Tim Ferriss Show', episode: '#742 — Optimize Your Morning', duration: '2h 14m', artwork: 'podcast-ferriss.jpg' },
  { show: 'Lex Fridman Podcast', episode: 'Sam Altman: AI & the Future', duration: '4h 22m', artwork: 'podcast-lex.jpg' },
  { show: 'All-In Podcast', episode: 'E180 — AI, Markets & Geopolitics', duration: '1h 47m', artwork: 'podcast-allin.jpg' },
  { show: 'My First Million', episode: 'The 5 Best Business Models', duration: '1h 12m', artwork: 'podcast-mfm.jpg' },
  { show: 'Diary of a CEO', episode: 'What Elite Athletes Know About Focus', duration: '1h 55m', artwork: 'podcast-doac.jpg' },
  { show: 'Joe Rogan Experience', episode: '#2200 — AI & Human Potential', duration: '3h 41m', artwork: 'podcast-rogan.jpg' },
];

/**
 * Scene 1: The Hook — emotional storytelling.
 *
 * Phase 1 (0–1.5s): "Your queue is growing..." alone on screen, atmospheric
 * Phase 2 (1.6s+):  Overlay fades, podcast cards cascade in, hours counter ticks up
 * Phase 3 (4.5s):   Cards blur — the overwhelm peaks
 * Phase 4 (5.2s):   "You're 47 hours behind." → "What if you never fell behind again?"
 */
export const PainPoint: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // --- Phase 1: Hook overlay "Your queue is growing..." ---
  const hookTextOpacity = interpolate(frame, [0, 18], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const hookOverlayOpacity = interpolate(
    frame,
    [Math.round(1.5 * fps), Math.round(2.2 * fps)],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );
  // Animated dots: appear one by one after text is visible
  const dotCount = Math.min(3, Math.max(0, Math.floor((frame - 20) / 12)));

  // --- Phase 2: Cards cascade from 1.6s ---
  const cardsStart = Math.round(1.6 * fps);

  // Hours counter: 0 → 47 over 2.4s
  const totalHours = interpolate(
    frame,
    [cardsStart, cardsStart + Math.round(2.4 * fps)],
    [0, 47],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.quad) },
  );
  const counterOpacity = interpolate(frame, [cardsStart, cardsStart + 10], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // --- Phase 3: Overwhelm blur at 4.5s ---
  const overwhelmStart = Math.round(4.5 * fps);
  const overwhelmProgress = interpolate(
    frame,
    [overwhelmStart, overwhelmStart + Math.round(0.6 * fps)],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.quad) },
  );

  return (
    <AbsoluteFill style={{ backgroundColor: LIGHT.bgAlt, fontFamily, overflow: 'hidden' }}>
      {/* Hours counter — top right */}
      <div
        style={{
          position: 'absolute',
          top: 52,
          right: 100,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          opacity: counterOpacity,
        }}
      >
        <div
          style={{
            fontSize: 80,
            fontWeight: 800,
            color: LIGHT.red,
            fontVariantNumeric: 'tabular-nums',
            lineHeight: 1,
            letterSpacing: '-0.03em',
          }}
        >
          {Math.round(totalHours)}h
        </div>
        <div
          style={{
            fontSize: 20,
            fontWeight: 700,
            color: LIGHT.textTertiary,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            marginTop: 5,
          }}
        >
          Unwatched
        </div>
      </div>

      {/* Podcast episode list — cascades in behind the hook overlay */}
      <div
        style={{
          position: 'absolute',
          top: 50,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 740,
          display: 'flex',
          flexDirection: 'column',
          gap: 9,
          filter: `blur(${overwhelmProgress * 7}px)`,
          opacity: interpolate(overwhelmProgress, [0, 1], [1, 0.15], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          }),
        }}
      >
        {PODCAST_ITEMS.map((item, i) => {
          const itemDelay = cardsStart + i * 5;
          const itemProgress = spring({
            frame: frame - itemDelay,
            fps,
            config: { damping: 22, stiffness: 260 },
          });

          return (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                padding: '14px 22px',
                background: LIGHT.bgCard,
                borderRadius: 14,
                border: `1px solid ${LIGHT.border}`,
                boxShadow: LIGHT.shadow,
                opacity: interpolate(itemProgress, [0, 1], [0, 1], {
                  extrapolateLeft: 'clamp',
                  extrapolateRight: 'clamp',
                }),
                transform: `translateY(${interpolate(itemProgress, [0, 1], [-28, 0], {
                  extrapolateLeft: 'clamp',
                  extrapolateRight: 'clamp',
                })}px)`,
              }}
            >
              <Img
                src={staticFile(item.artwork)}
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 11,
                  objectFit: 'cover',
                  flexShrink: 0,
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 22,
                    fontWeight: 600,
                    color: LIGHT.textPrimary,
                    marginBottom: 3,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {item.show}
                </div>
                <div
                  style={{
                    fontSize: 20,
                    color: LIGHT.textTertiary,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {item.episode}
                </div>
              </div>
              <div
                style={{
                  padding: '5px 12px',
                  borderRadius: 8,
                  background: LIGHT.surface1,
                  border: `1px solid ${LIGHT.border}`,
                  fontSize: 20,
                  fontWeight: 600,
                  color: LIGHT.textSecondary,
                  fontVariantNumeric: 'tabular-nums',
                  flexShrink: 0,
                }}
              >
                {item.duration}
              </div>
            </div>
          );
        })}
      </div>

      {/* Phase 1 overlay: "Your queue is growing..." — covers cards, fades to reveal them */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: LIGHT.bgAlt,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: hookOverlayOpacity,
          zIndex: 10,
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            fontSize: 48,
            fontWeight: 500,
            color: LIGHT.textSecondary,
            letterSpacing: '-0.01em',
            opacity: hookTextOpacity,
          }}
        >
          Your queue is growing{'.'.repeat(dotCount)}
        </div>
      </div>

      {/* Phase 4: Emotional tagline — fades in at 5.2s */}
      <Sequence from={Math.round(5.2 * fps)} layout="none">
        <AbsoluteFill
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
            background: 'rgba(248, 250, 252, 0.90)',
          }}
        >
          <FadeUpWords
            text="You're 47 hours behind."
            fontSize={56}
            fontWeight={700}
            color={LIGHT.textPrimary}
            delay={0}
            stagger={4}
          />
          <FadeUpWords
            text="What if you never fell behind again?"
            fontSize={36}
            fontWeight={400}
            color={LIGHT.textSecondary}
            delay={16}
            stagger={2}
          />
        </AbsoluteFill>
      </Sequence>
    </AbsoluteFill>
  );
};
