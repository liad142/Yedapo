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
import { LightCard, ProgressBar } from '../components/UIElements';

const { fontFamily } = loadFont('normal', {
  weights: ['400', '500', '600', '700', '800'],
  subsets: ['latin'],
});

const SUMMARY_TITLE = 'Stop Using One Chatbot: Why You Need an AI Army';
const GOLDEN_NUGGET =
  '"Peak productivity requires treating AI like human employees — giving each agent a soul, a specific role, and even dedicated hardware."';

const CORE_CONCEPTS = [
  { num: 1, title: 'The Managerial Mindset', desc: 'Manage AI agents like human employees' },
  { num: 2, title: 'Context Overload', desc: 'Fragment into specialized agents' },
];

const CHAPTERS = [
  { time: '0:00', title: 'From Skeptic to AI Power User', summary: 'Claire reveals how she went from dismissing AI to building her entire workflow around agents' },
  { time: '12:10', title: 'Use Cases for Home and Work', summary: 'Practical examples of AI handling scheduling, research, and decision frameworks' },
  { time: '17:18', title: 'Hardware Strategy: Mac Mini Stack', summary: 'Why running local AI on dedicated hardware beats cloud-only approaches' },
  { time: '28:45', title: 'The "AI Army" Framework', summary: 'Specialized agents outperform one general-purpose chatbot for complex workflows' },
  { time: '42:30', title: 'Automating Product Research', summary: 'Using AI to synthesize competitor analysis, user feedback, and market trends' },
  { time: '55:12', title: 'Building Trust with AI Tools', summary: 'Verification patterns that let you delegate confidently without losing quality' },
];

const ACTION_ITEMS = [
  'Set up 3 specialized AI agents for your most common tasks',
  'Audit your current workflow for automation opportunities',
  'Try the "AI sprint": 30 min, one problem, three agents',
];

const KEY_TAKEAWAYS = [
  'Treat AI like employees — specific roles, clear context, dedicated resources',
  'Context overload is the #1 reason AI gives bad answers',
  'Start with your highest-volume, lowest-creativity tasks',
];

/**
 * Scene 3: Podcast summary in action — with auto-scroll.
 *
 * Left:  Lenny's Podcast episode card.
 * Right: AI summary panel — progress bar fills, content appears,
 *        then smoothly scrolls to reveal ALL chapters, action items, takeaways.
 *
 * Timeline (relative to scene start, 12s total):
 * 0–0.8s   — cards slide in
 * 0.8–3.0s — progress bar fills
 * 3.0–5.5s — title, golden nugget, core concepts appear
 * 6.0–10.5s — smooth scroll reveals chapters, actions, takeaways
 * 10.5–12s  — "Read in 2 minutes" label
 */
export const SummaryDemo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Scroll animation — after top content appears, scroll to reveal the rest
  const SCROLL_START = Math.round(6.0 * fps);
  const SCROLL_END = Math.round(10.5 * fps);
  const SCROLL_MAX = 700;
  const scrollY = interpolate(frame, [SCROLL_START, SCROLL_END], [0, SCROLL_MAX], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.quad),
  });

  // "Read in 2 min" label
  const labelDelay = Math.round(10.5 * fps);
  const labelProgress = spring({ frame: frame - labelDelay, fps, config: { damping: 200 } });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: LIGHT.bgAlt,
        fontFamily,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {/* Subtle ambient */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: 1200,
          height: 800,
          borderRadius: '50%',
          background: 'radial-gradient(ellipse, rgba(33, 150, 184, 0.04) 0%, transparent 65%)',
          pointerEvents: 'none',
        }}
      />

      <div style={{ display: 'flex', gap: 48, alignItems: 'flex-start', zIndex: 1 }}>
        {/* LEFT: Podcast episode card */}
        <LightCard delay={0} width={430} height={300}>
          <div style={{ padding: 30 }}>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 22 }}>
              <Img
                src={staticFile('podcast-lennys.jpg')}
                style={{
                  width: 58,
                  height: 58,
                  borderRadius: 13,
                  objectFit: 'cover',
                  flexShrink: 0,
                }}
              />
              <div>
                <div style={{ fontSize: 22, fontWeight: 700, color: LIGHT.textPrimary, marginBottom: 3 }}>
                  Lenny's Podcast
                </div>
                <div style={{ fontSize: 20, color: LIGHT.textTertiary }}>
                  Claire Vo — How OpenClaw Changed My Life
                </div>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '12px 16px',
                borderRadius: 12,
                background: LIGHT.redBg,
                border: `1px solid ${LIGHT.red}22`,
                marginBottom: 18,
              }}
            >
              <span style={{ fontSize: 20 }}>⏱️</span>
              <span style={{ fontSize: 22, fontWeight: 600, color: LIGHT.red }}>1 hour 46 minutes</span>
              <span style={{ fontSize: 20, color: LIGHT.textTertiary, marginLeft: 4 }}>· New episode</span>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              {['AI', 'Product', 'Productivity'].map((tag) => (
                <div
                  key={tag}
                  style={{
                    padding: '5px 12px',
                    borderRadius: 8,
                    background: LIGHT.surface1,
                    border: `1px solid ${LIGHT.border}`,
                    fontSize: 18,
                    fontWeight: 500,
                    color: LIGHT.textSecondary,
                  }}
                >
                  {tag}
                </div>
              ))}
            </div>
          </div>
        </LightCard>

        {/* RIGHT: AI Summary panel — scrolling viewport */}
        <LightCard delay={12} width={560} height={480}>
          <div style={{ padding: 30, transform: `translateY(-${scrollY}px)` }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: LIGHT.accent,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 16,
                }}
              >
                ✨
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: LIGHT.textPrimary }}>AI Summary</div>
            </div>

            {/* Progress bar */}
            <Sequence from={Math.round(0.8 * fps)} layout="none">
              <AnalyzingBar fps={fps} />
            </Sequence>

            {/* Summary headline */}
            <Sequence from={Math.round(3.0 * fps)} layout="none">
              <SummaryHeadline />
            </Sequence>

            {/* Golden Nugget */}
            <Sequence from={Math.round(4.0 * fps)} layout="none">
              <GoldenNugget />
            </Sequence>

            {/* Core concepts */}
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              {CORE_CONCEPTS.map((c, i) => (
                <Sequence key={i} from={Math.round((4.8 + i * 0.5) * fps)} layout="none">
                  <CoreConceptChip num={c.num} title={c.title} desc={c.desc} />
                </Sequence>
              ))}
            </div>

            {/* ─── Below fold: scrolls into view ─── */}

            {/* Episode Chapters */}
            <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${LIGHT.border}` }}>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: LIGHT.textTertiary,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  marginBottom: 10,
                }}
              >
                Episode Chapters
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {CHAPTERS.map((ch, i) => (
                  <div
                    key={i}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 9,
                      background: LIGHT.surface1,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 3 }}>
                      <span
                        style={{
                          fontSize: 18,
                          fontWeight: 700,
                          color: LIGHT.accent,
                          fontVariantNumeric: 'tabular-nums',
                          minWidth: 48,
                        }}
                      >
                        {ch.time}
                      </span>
                      <span style={{ width: 1, height: 14, background: LIGHT.border, flexShrink: 0 }} />
                      <span style={{ fontSize: 18, fontWeight: 600, color: LIGHT.textPrimary }}>
                        {ch.title}
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: 16,
                        color: LIGHT.textTertiary,
                        paddingLeft: 58,
                        lineHeight: 1.4,
                      }}
                    >
                      {ch.summary}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Action Items */}
            <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${LIGHT.border}` }}>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: LIGHT.textTertiary,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  marginBottom: 10,
                }}
              >
                Action Items
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {ACTION_ITEMS.map((item, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 10,
                      padding: '6px 10px',
                      borderRadius: 8,
                    }}
                  >
                    <span style={{ fontSize: 18, color: LIGHT.green, fontWeight: 700, flexShrink: 0 }}>
                      ✓
                    </span>
                    <span style={{ fontSize: 17, color: LIGHT.textSecondary, lineHeight: 1.4 }}>
                      {item}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Key Takeaways */}
            <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${LIGHT.border}` }}>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: LIGHT.textTertiary,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  marginBottom: 10,
                }}
              >
                Key Takeaways
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {KEY_TAKEAWAYS.map((item, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 10,
                      padding: '8px 12px',
                      borderRadius: 8,
                      background: LIGHT.accentBg,
                      border: `1px solid ${LIGHT.accentBorder}`,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 18,
                        color: LIGHT.accent,
                        fontWeight: 700,
                        flexShrink: 0,
                        marginTop: 1,
                      }}
                    >
                      →
                    </span>
                    <span style={{ fontSize: 17, color: LIGHT.textPrimary, fontWeight: 500, lineHeight: 1.4 }}>
                      {item}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom padding for scroll end */}
            <div style={{ height: 40 }} />
          </div>
        </LightCard>
      </div>

      {/* Bottom label: time savings */}
      <div
        style={{
          position: 'absolute',
          bottom: 80,
          left: '50%',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: '12px 28px',
          borderRadius: 100,
          background: LIGHT.bgCard,
          border: `1px solid ${LIGHT.border}`,
          boxShadow: LIGHT.shadow,
          opacity: interpolate(labelProgress, [0, 1], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          }),
          transform: `translateX(-50%) translateY(${interpolate(labelProgress, [0, 1], [12, 0], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          })}px)`,
        }}
      >
        <span style={{ fontSize: 22, fontWeight: 600, color: LIGHT.red }}>1h 46m</span>
        <span style={{ fontSize: 22, color: LIGHT.textTertiary }}>→</span>
        <span style={{ fontSize: 22, fontWeight: 700, color: LIGHT.green }}>Read in 2 minutes</span>
      </div>
    </AbsoluteFill>
  );
};

// ─── Sub-components ──────────────────────────────────────────────────────────

const AnalyzingBar: React.FC<{ fps: number }> = ({ fps }) => {
  const frame = useCurrentFrame();

  const percentDone = Math.min(
    100,
    Math.round(
      interpolate(frame, [0, Math.round(2.4 * fps)], [0, 100], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.out(Easing.quad),
      }),
    ),
  );

  const isDone = percentDone >= 100;

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 20, fontWeight: 500, color: LIGHT.textSecondary }}>
          {isDone ? '✓ Analysis complete' : 'Analyzing transcript...'}
        </span>
        <span
          style={{
            fontSize: 20,
            fontWeight: 600,
            color: isDone ? LIGHT.green : LIGHT.accent,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {percentDone}%
        </span>
      </div>
      <ProgressBar
        delay={0}
        durationFrames={Math.round(2.4 * fps)}
        color={isDone ? LIGHT.green : LIGHT.accent}
        height={5}
        width={500}
        trackColor={LIGHT.surface3}
      />
    </div>
  );
};

const SummaryHeadline: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = spring({ frame, fps, config: { damping: 200 } });

  return (
    <div
      style={{
        fontSize: 28,
        fontWeight: 700,
        color: LIGHT.textPrimary,
        lineHeight: 1.35,
        marginBottom: 6,
        opacity: interpolate(progress, [0, 1], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        }),
        transform: `translateY(${interpolate(progress, [0, 1], [12, 0], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        })}px)`,
      }}
    >
      {SUMMARY_TITLE}
    </div>
  );
};

const GoldenNugget: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = spring({ frame, fps, config: { damping: 22, stiffness: 220 } });

  return (
    <div
      style={{
        padding: '10px 14px',
        borderRadius: 12,
        background: 'rgba(217, 119, 6, 0.06)',
        borderLeft: '3px solid #d97706',
        marginBottom: 6,
        opacity: interpolate(progress, [0, 1], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        }),
        transform: `translateX(${interpolate(progress, [0, 1], [16, 0], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        })}px)`,
      }}
    >
      <div
        style={{
          fontSize: 20,
          fontWeight: 700,
          color: '#d97706',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          marginBottom: 5,
        }}
      >
        💡 Golden Nugget
      </div>
      <div style={{ fontSize: 22, color: LIGHT.textSecondary, lineHeight: 1.5, fontStyle: 'italic' }}>
        {GOLDEN_NUGGET}
      </div>
    </div>
  );
};

const CoreConceptChip: React.FC<{ num: number; title: string; desc: string }> = ({
  num,
  title,
  desc,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = spring({ frame, fps, config: { damping: 22, stiffness: 240 } });

  return (
    <div
      style={{
        flex: 1,
        padding: '8px 10px',
        borderRadius: 10,
        background: LIGHT.surface2,
        border: `1px solid ${LIGHT.border}`,
        opacity: interpolate(progress, [0, 1], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        }),
        transform: `translateY(${interpolate(progress, [0, 1], [14, 0], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        })}px)`,
      }}
    >
      <div style={{ fontSize: 18, fontWeight: 700, color: LIGHT.accent, marginBottom: 3 }}>
        {num}. {title}
      </div>
      <div style={{ fontSize: 18, color: LIGHT.textTertiary }}>{desc}</div>
    </div>
  );
};
