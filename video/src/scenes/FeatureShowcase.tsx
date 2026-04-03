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
import { YedapoLogoMark, LightCard, LightPill, ProgressBar } from '../components/UIElements';
import { FadeUpWords } from '../components/AnimatedText';

const { fontFamily } = loadFont('normal', {
  weights: ['400', '500', '600', '700', '800'],
  subsets: ['latin'],
});

// ============================================================================
// Scene 4: YouTube / freeCodeCamp — works here too (10s)
// Real freeCodeCamp logo, scrolling summary with chapters
// ============================================================================

const YT_CHAPTERS = [
  { time: '0:00', title: 'What is Machine Learning?', summary: 'Distinguishes between AI hype and actual ML capabilities' },
  { time: '15:30', title: 'Supervised vs Unsupervised Learning', summary: 'Breaking down the two fundamental approaches with visual examples' },
  { time: '32:00', title: 'Neural Networks Explained', summary: 'How layers of simple math operations create complex pattern recognition' },
  { time: '48:15', title: 'The Training Loop', summary: 'Data preparation → model training → evaluation → iteration cycle' },
  { time: '1:08:00', title: 'Bias in AI Systems', summary: 'Sources of bias and practical strategies for detection and mitigation' },
  { time: '1:45:00', title: 'Building Your First Model', summary: 'Step-by-step guide using Python and scikit-learn' },
];

const YT_KEY_POINTS = [
  'AI doesn\'t "think" — it optimizes mathematical functions',
  'Data quality matters more than model complexity',
  'Every AI system reflects the biases of its training data',
];

export const FeatureAskAI: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Scroll the summary panel content
  const SCROLL_START = Math.round(5.0 * fps);
  const SCROLL_END = Math.round(8.5 * fps);
  const SCROLL_MAX = 580;
  const scrollY = interpolate(frame, [SCROLL_START, SCROLL_END], [0, SCROLL_MAX], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.quad),
  });

  const labelDelay = Math.round(8.5 * fps);
  const labelProgress = spring({ frame: frame - labelDelay, fps, config: { damping: 200 } });

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
      {/* YouTube red ambient */}
      <div
        style={{
          position: 'absolute',
          right: -100,
          top: -100,
          width: 700,
          height: 700,
          borderRadius: '50%',
          background: 'radial-gradient(ellipse, rgba(255,0,0,0.04) 0%, transparent 65%)',
          pointerEvents: 'none',
        }}
      />

      {/* Yedapo corner wordmark */}
      <div
        style={{
          position: 'absolute',
          top: 40,
          right: 72,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          opacity: 0.88,
        }}
      >
        <YedapoLogoMark size={36} />
        <span
          style={{
            fontSize: 22,
            fontWeight: 800,
            color: '#0f172a',
            letterSpacing: '-0.03em',
          }}
        >
          Yedapo
        </span>
      </div>

      {/* Overline badge */}
      <div
        style={{
          position: 'absolute',
          top: 80,
          left: '50%',
          transform: 'translateX(-50%)',
          opacity: interpolate(
            spring({ frame, fps, config: { damping: 200 } }),
            [0, 1],
            [0, 1],
            { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
          ),
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '8px 20px',
            borderRadius: 100,
            background: 'rgba(255, 0, 0, 0.06)',
            border: '1px solid rgba(255, 0, 0, 0.15)',
          }}
        >
          <Img
            src={staticFile('youtube-logo.svg')}
            style={{ width: 22, height: 16, objectFit: 'contain' }}
          />
          <span
            style={{
              fontSize: 20,
              fontWeight: 600,
              color: '#dc2626',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            YouTube. Same magic.
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 48, alignItems: 'flex-start', zIndex: 1, marginTop: 30 }}>
        {/* LEFT: freeCodeCamp video card */}
        <LightCard delay={8} width={430} height={300}>
          <div style={{ padding: 28 }}>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 20 }}>
              <Img
                src={staticFile('podcast-freecodecamp.jpg')}
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
                  freeCodeCamp.org
                </div>
                <div style={{ fontSize: 20, color: LIGHT.textTertiary }}>
                  AI Foundations for Beginners
                </div>
              </div>
            </div>

            {/* Duration — prominent red */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '12px 16px',
                borderRadius: 12,
                background: 'rgba(255, 0, 0, 0.05)',
                border: '1px solid rgba(255, 0, 0, 0.12)',
                marginBottom: 16,
              }}
            >
              <Img
                src={staticFile('youtube-logo.svg')}
                style={{ width: 20, height: 14, objectFit: 'contain' }}
              />
              <span style={{ fontSize: 22, fontWeight: 700, color: '#dc2626' }}>4h 22m</span>
              <span style={{ fontSize: 20, color: LIGHT.textTertiary, marginLeft: 2 }}>· YouTube</span>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              {['AI', 'Machine Learning', 'Education'].map((tag) => (
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
        <LightCard delay={18} width={560} height={480}>
          <div style={{ padding: 28, transform: `translateY(-${scrollY}px)` }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 7,
                  background: LIGHT.accent,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 18,
                }}
              >
                ✨
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: LIGHT.textPrimary }}>AI Summary</div>
            </div>

            {/* Progress bar */}
            <Sequence from={Math.round(0.5 * fps)} layout="none">
              <YouTubeAnalyzingBar fps={fps} />
            </Sequence>

            {/* Summary title */}
            <Sequence from={Math.round(2.5 * fps)} layout="none">
              <YTSummaryTitle />
            </Sequence>

            {/* Golden nugget */}
            <Sequence from={Math.round(3.5 * fps)} layout="none">
              <YTGoldenNugget />
            </Sequence>

            {/* ─── Below fold: scrolls into view ─── */}

            {/* Module Chapters */}
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${LIGHT.border}` }}>
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
                Module Chapters
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {YT_CHAPTERS.map((ch, i) => (
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
                          minWidth: 56,
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
                        paddingLeft: 66,
                        lineHeight: 1.4,
                      }}
                    >
                      {ch.summary}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Key Points */}
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${LIGHT.border}` }}>
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
                Key Points
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {YT_KEY_POINTS.map((item, i) => (
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
                    <span
                      style={{ fontSize: 17, color: LIGHT.textPrimary, fontWeight: 500, lineHeight: 1.4 }}
                    >
                      {item}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ height: 40 }} />
          </div>
        </LightCard>
      </div>

      {/* Bottom label: time savings — bigger and bolder */}
      <div
        style={{
          position: 'absolute',
          bottom: 70,
          left: '50%',
          transform: `translateX(-50%) translateY(${interpolate(labelProgress, [0, 1], [12, 0], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          })}px)`,
          display: 'flex',
          alignItems: 'center',
          gap: 18,
          padding: '14px 32px',
          borderRadius: 100,
          background: LIGHT.bgCard,
          border: `1px solid ${LIGHT.border}`,
          boxShadow: LIGHT.shadowMd,
          opacity: interpolate(labelProgress, [0, 1], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          }),
        }}
      >
        <span style={{ fontSize: 26, fontWeight: 700, color: '#dc2626' }}>4h 22m</span>
        <span style={{ fontSize: 28, color: LIGHT.textTertiary }}>→</span>
        <span style={{ fontSize: 26, fontWeight: 800, color: LIGHT.green }}>Read in 3 minutes</span>
      </div>
    </AbsoluteFill>
  );
};

const YTSummaryTitle: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = spring({ frame, fps, config: { damping: 200 } });
  return (
    <div
      style={{
        fontSize: 26,
        fontWeight: 700,
        color: LIGHT.textPrimary,
        lineHeight: 1.35,
        marginBottom: 8,
        opacity: interpolate(progress, [0, 1], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        }),
        transform: `translateY(${interpolate(progress, [0, 1], [10, 0], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        })}px)`,
      }}
    >
      AI is Not Magic: The Human Math Behind the Machine
    </div>
  );
};

const YTGoldenNugget: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = spring({ frame, fps, config: { damping: 22, stiffness: 220 } });
  return (
    <div
      style={{
        padding: '9px 12px',
        borderRadius: 10,
        background: 'rgba(217, 119, 6, 0.06)',
        borderLeft: '3px solid #d97706',
        opacity: interpolate(progress, [0, 1], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        }),
        transform: `translateX(${interpolate(progress, [0, 1], [14, 0], {
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
          marginBottom: 4,
        }}
      >
        💡 Golden Nugget
      </div>
      <div style={{ fontSize: 20, color: LIGHT.textSecondary, lineHeight: 1.5, fontStyle: 'italic' }}>
        "AI 'learning' is a series of calculated predictions where features are turned into numbers — a
        process so intensive that AI data centers consume as much electricity as entire small cities."
      </div>
    </div>
  );
};

const YouTubeAnalyzingBar: React.FC<{ fps: number }> = ({ fps }) => {
  const frame = useCurrentFrame();
  const percentDone = Math.min(
    100,
    Math.round(
      interpolate(frame, [0, Math.round(2.3 * fps)], [0, 100], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.out(Easing.quad),
      }),
    ),
  );
  const isDone = percentDone >= 100;

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
        <span style={{ fontSize: 20, fontWeight: 500, color: LIGHT.textSecondary }}>
          {isDone ? '✓ Done' : 'Analyzing video...'}
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
        durationFrames={Math.round(2.3 * fps)}
        color={isDone ? LIGHT.green : LIGHT.accent}
        height={5}
        width={504}
        trackColor={LIGHT.surface3}
      />
    </div>
  );
};

// ============================================================================
// Scene 5: Ask AI — multi-exchange chat + scrolling chapters (8.5s)
// ============================================================================

const ASK_AI_CHAPTERS = [
  { time: '0:00', title: 'Introduction', active: false },
  { time: '05:30', title: 'AI is Not Magic', active: true },
  { time: '18:20', title: 'The ML Loop', active: false },
  { time: '32:15', title: 'Features & Bias', active: false },
  { time: '45:00', title: 'Supervised Learning', active: false },
  { time: '58:30', title: 'Neural Networks', active: false },
  { time: '1:12:00', title: 'Building Models', active: false },
  { time: '1:28:00', title: 'Next Steps', active: false },
];

const AI_ANSWER_1 =
  'Based on the transcript, here are the three core takeaways:\n\n1. AI doesn\'t "think" — it optimizes math functions through massive computation\n2. Data quality matters more than model complexity — garbage in, garbage out\n3. Every AI system inherits biases from its training data and its creators';

const AI_ANSWER_2 =
  'The training loop follows four steps: (1) prepare and clean data, (2) feed it through the model, (3) measure prediction error, (4) adjust weights and repeat. Each cycle makes the model slightly better at the task.';

export const FeatureDeepSummaries: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Chat panel scroll — after both exchanges, scroll to see the second one
  const CHAT_SCROLL_START = Math.round(5.0 * fps);
  const CHAT_SCROLL_END = Math.round(7.5 * fps);
  const chatScrollY = interpolate(frame, [CHAT_SCROLL_START, CHAT_SCROLL_END], [0, 280], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.quad),
  });

  // AI answer 1 typing
  const answer1Delay = Math.round(1.6 * fps);
  const answer1Frame = Math.max(0, frame - answer1Delay);
  const answer1Chars = Math.min(AI_ANSWER_1.length, Math.floor(answer1Frame / 0.9));

  // Second exchange appears at 3.5s
  const q2Delay = Math.round(3.5 * fps);

  // AI answer 2 typing
  const answer2Delay = Math.round(4.5 * fps);
  const answer2Frame = Math.max(0, frame - answer2Delay);
  const answer2Chars = Math.min(AI_ANSWER_2.length, Math.floor(answer2Frame / 0.9));

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
      <div
        style={{
          display: 'flex',
          gap: 80,
          alignItems: 'center',
          padding: '0 100px',
          width: '100%',
        }}
      >
        {/* Left: text + Smart Player */}
        <div style={{ flex: 1, maxWidth: 520 }}>
          <Sequence from={0} layout="none">
            <LightPill label="Ask AI" delay={0} />
          </Sequence>

          <div style={{ marginTop: 22 }}>
            <FadeUpWords
              text="Ask anything."
              fontSize={52}
              fontWeight={700}
              color={LIGHT.textPrimary}
              delay={10}
              stagger={4}
              textAlign="left"
              lineHeight={1.15}
            />
            <FadeUpWords
              text="Get cited answers."
              fontSize={52}
              fontWeight={700}
              color={LIGHT.accent}
              delay={22}
              stagger={4}
              textAlign="left"
              lineHeight={1.15}
            />
          </div>

          <Sequence from={30} layout="none">
            <div style={{ marginTop: 18 }}>
              <FadeUpWords
                text="Every answer references the exact moment in the episode."
                fontSize={24}
                fontWeight={400}
                color={LIGHT.textSecondary}
                delay={0}
                stagger={2}
                textAlign="left"
                lineHeight={1.6}
              />
            </div>
          </Sequence>

          {/* Smart Player with scrolling chapters */}
          <Sequence from={Math.round(1.8 * fps)} layout="none">
            <SmartPlayerMini />
          </Sequence>
        </div>

        {/* Right: chat panel — scrolling */}
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
          <LightCard delay={14} width={520} height={420}>
            <div
              style={{
                padding: 28,
                transform: `translateY(-${chatScrollY}px)`,
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Exchange 1 */}
                <Sequence from={16} layout="none">
                  <UserBubble text="What are the key takeaways?" />
                </Sequence>

                <Sequence from={answer1Delay} layout="none">
                  <AIResponseBlock
                    text={AI_ANSWER_1}
                    visibleChars={answer1Chars}
                    citation="@ 05:30 — AI is Not Magic"
                    showCitation={answer1Chars > 80}
                  />
                </Sequence>

                {/* Exchange 2 */}
                <Sequence from={q2Delay} layout="none">
                  <UserBubble text="How does the training loop work?" />
                </Sequence>

                <Sequence from={answer2Delay} layout="none">
                  <AIResponseBlock
                    text={AI_ANSWER_2}
                    visibleChars={answer2Chars}
                    citation="@ 48:15 — The Training Loop"
                    showCitation={answer2Chars > 60}
                  />
                </Sequence>
              </div>
            </div>
          </LightCard>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// AI response block with typing effect and citation
const AIResponseBlock: React.FC<{
  text: string;
  visibleChars: number;
  citation: string;
  showCitation: boolean;
}> = ({ text, visibleChars, citation, showCitation }) => {
  const frame = useCurrentFrame();

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div
          style={{
            width: 26,
            height: 26,
            borderRadius: 7,
            background: LIGHT.accent,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 16,
            color: '#fff',
          }}
        >
          ✨
        </div>
        <span style={{ fontSize: 20, fontWeight: 600, color: LIGHT.accent }}>Yedapo AI</span>
      </div>
      <div
        style={{
          fontSize: 20,
          color: LIGHT.textSecondary,
          lineHeight: 1.65,
          padding: '14px 16px',
          borderRadius: 13,
          background: LIGHT.surface2,
          border: `1px solid ${LIGHT.border}`,
          whiteSpace: 'pre-wrap',
        }}
      >
        {text.slice(0, visibleChars)}
        {visibleChars < text.length && (
          <span style={{ color: LIGHT.accent, opacity: frame % 16 < 8 ? 1 : 0 }}>|</span>
        )}
      </div>
      {showCitation && (
        <div style={{ display: 'flex', gap: 6, marginTop: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 18, color: LIGHT.textTertiary }}>📍</span>
          <span
            style={{
              fontSize: 18,
              color: LIGHT.accent,
              fontWeight: 600,
              padding: '3px 10px',
              borderRadius: 6,
              background: LIGHT.accentBg,
              border: `1px solid ${LIGHT.accentBorder}`,
            }}
          >
            {citation}
          </span>
        </div>
      )}
    </div>
  );
};

// Smart Player mini with scrolling chapter list
const SmartPlayerMini: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = spring({ frame, fps, config: { damping: 22, stiffness: 200 } });

  // Scroll chapter list within the player
  const CHAPTER_SCROLL_START = Math.round(3.0 * fps);
  const CHAPTER_SCROLL_END = Math.round(6.0 * fps);
  const chapterScrollY = interpolate(
    frame,
    [CHAPTER_SCROLL_START, CHAPTER_SCROLL_END],
    [0, 120],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.inOut(Easing.quad),
    },
  );

  return (
    <div
      style={{
        marginTop: 22,
        padding: '14px 16px',
        borderRadius: 14,
        background: LIGHT.bgCard,
        border: `1px solid ${LIGHT.border}`,
        boxShadow: LIGHT.shadow,
        maxWidth: 340,
        opacity: interpolate(progress, [0, 1], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        }),
        transform: `translateY(${interpolate(progress, [0, 1], [18, 0], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        })}px)`,
      }}
    >
      {/* Player bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            background: LIGHT.accent,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 16,
            color: '#fff',
          }}
        >
          ▶
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 20, fontWeight: 600, color: LIGHT.textPrimary }}>
            AI Foundations for Beginners
          </div>
          <div style={{ fontSize: 18, color: LIGHT.textTertiary }}>freeCodeCamp.org</div>
        </div>
        <div style={{ fontSize: 18, color: LIGHT.textTertiary, fontVariantNumeric: 'tabular-nums' }}>
          05:30
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ height: 3, borderRadius: 2, background: LIGHT.surface3, marginBottom: 10 }}>
        <div style={{ width: '12%', height: '100%', borderRadius: 2, background: LIGHT.accent }} />
      </div>

      {/* Ask AI button */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 12px',
          borderRadius: 8,
          background: LIGHT.accentBg,
          border: `1px solid ${LIGHT.accentBorder}`,
          marginBottom: 10,
          width: 'fit-content',
        }}
      >
        <span style={{ fontSize: 14 }}>✨</span>
        <span style={{ fontSize: 16, fontWeight: 600, color: LIGHT.accent }}>Ask AI</span>
      </div>

      {/* Chapter list header */}
      <div
        style={{
          fontSize: 18,
          fontWeight: 700,
          color: LIGHT.textTertiary,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          marginBottom: 6,
        }}
      >
        Episode Chapters
      </div>

      {/* Scrolling chapter list */}
      <div style={{ maxHeight: 130, overflow: 'hidden' }}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 3,
            transform: `translateY(-${chapterScrollY}px)`,
          }}
        >
          {ASK_AI_CHAPTERS.map((ch, i) => (
            <Sequence key={i} from={Math.round(i * 0.3 * fps)} layout="none">
              <SmartChapterRow time={ch.time} title={ch.title} active={ch.active} />
            </Sequence>
          ))}
        </div>
      </div>
    </div>
  );
};

const SmartChapterRow: React.FC<{ time: string; title: string; active: boolean }> = ({
  time,
  title,
  active,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = spring({ frame, fps, config: { damping: 22, stiffness: 240 } });

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '5px 8px',
        borderRadius: 7,
        background: active ? LIGHT.accentBg : 'transparent',
        border: active ? `1px solid ${LIGHT.accentBorder}` : '1px solid transparent',
        opacity: interpolate(progress, [0, 1], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        }),
        transform: `translateX(${interpolate(progress, [0, 1], [10, 0], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        })}px)`,
      }}
    >
      <span
        style={{
          fontSize: 18,
          fontWeight: 700,
          color: active ? LIGHT.accent : LIGHT.textTertiary,
          fontVariantNumeric: 'tabular-nums',
          minWidth: 40,
        }}
      >
        {time}
      </span>
      {active && (
        <span
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: LIGHT.accent,
            padding: '2px 8px',
            borderRadius: 4,
            background: 'rgba(33,150,184,0.12)',
          }}
        >
          NOW
        </span>
      )}
      <span
        style={{
          fontSize: 18,
          color: active ? LIGHT.textPrimary : LIGHT.textSecondary,
          fontWeight: active ? 600 : 400,
        }}
      >
        {title}
      </span>
    </div>
  );
};

const UserBubble: React.FC<{ text: string }> = ({ text }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = spring({ frame, fps, config: { damping: 200 } });

  return (
    <div
      style={{
        alignSelf: 'flex-end',
        maxWidth: '88%',
        padding: '11px 18px',
        borderRadius: 14,
        background: LIGHT.accent,
        color: '#ffffff',
        fontSize: 22,
        fontWeight: 500,
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
      {text}
    </div>
  );
};

// ============================================================================
// Scene 6: Feature grid — One app for all your creators (6s)
// ============================================================================
export const FeatureUnified: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const features = [
    {
      icon: '⚡',
      title: 'AI Summaries',
      desc: '3 hours → 3 minutes',
      color: LIGHT.accent,
      bg: LIGHT.accentBg,
      delay: 10,
    },
    {
      icon: '💬',
      title: 'Ask Anything',
      desc: 'Cited answers from any episode',
      color: LIGHT.purple,
      bg: LIGHT.purpleBg,
      delay: 22,
    },
    {
      icon: '📑',
      title: 'Smart Chapters',
      desc: 'Jump to key moments',
      color: LIGHT.green,
      bg: LIGHT.greenBg,
      delay: 34,
    },
  ];

  return (
    <AbsoluteFill
      style={{
        backgroundColor: LIGHT.bg,
        fontFamily,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {/* Yedapo corner wordmark */}
      <div
        style={{
          position: 'absolute',
          top: 40,
          right: 72,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          opacity: 0.88,
        }}
      >
        <YedapoLogoMark size={36} />
        <span
          style={{
            fontSize: 22,
            fontWeight: 800,
            color: '#0f172a',
            letterSpacing: '-0.03em',
          }}
        >
          Yedapo
        </span>
      </div>

      {/* Headline */}
      <Sequence from={0} layout="none">
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'center' }}>
          <LightPill label="Podcasts & YouTube" delay={0} />
        </div>
      </Sequence>

      <div style={{ marginBottom: 56, marginTop: 10 }}>
        <FadeUpWords
          text="One app for every creator you follow."
          fontSize={50}
          fontWeight={700}
          color={LIGHT.textPrimary}
          delay={10}
          stagger={3}
          textAlign="center"
        />
      </div>

      {/* Feature cards */}
      <div style={{ display: 'flex', gap: 28 }}>
        {features.map((f) => (
          <FeatureCard key={f.title} {...f} fps={fps} />
        ))}
      </div>

      {/* Platform logos row */}
      <Sequence from={Math.round(2.5 * fps)} layout="none">
        <PlatformRow fps={fps} />
      </Sequence>
    </AbsoluteFill>
  );
};

type FeatureCardProps = {
  icon: string;
  title: string;
  desc: string;
  color: string;
  bg: string;
  delay: number;
  fps: number;
};

const FeatureCard: React.FC<FeatureCardProps> = ({ icon, title, desc, color, bg, delay, fps }) => {
  const frame = useCurrentFrame();
  const progress = spring({ frame: frame - delay, fps, config: { damping: 22, stiffness: 200 } });

  return (
    <div
      style={{
        width: 290,
        padding: '28px 26px',
        borderRadius: 20,
        background: LIGHT.bgCard,
        border: `1px solid ${LIGHT.border}`,
        boxShadow: LIGHT.shadowMd,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        opacity: interpolate(progress, [0, 1], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        }),
        transform: `translateY(${interpolate(progress, [0, 1], [32, 0], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        })}px)`,
      }}
    >
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: 14,
          background: bg,
          border: `1px solid ${color}22`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 26,
        }}
      >
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 24, fontWeight: 700, color: LIGHT.textPrimary, marginBottom: 5 }}>
          {title}
        </div>
        <div style={{ fontSize: 20, color, fontWeight: 600 }}>{desc}</div>
      </div>
    </div>
  );
};

const PLATFORM_SHOWS = [
  { artwork: 'podcast-huberman.jpg' },
  { artwork: 'podcast-ferriss.jpg' },
  { artwork: 'podcast-lex.jpg' },
  { artwork: 'podcast-allin.jpg' },
  { artwork: 'podcast-rogan.jpg' },
  { artwork: 'youtube-logo.svg' },
];

const PlatformRow: React.FC<{ fps: number }> = ({ fps }) => {
  const frame = useCurrentFrame();
  const progress = spring({ frame, fps, config: { damping: 200 } });

  return (
    <div
      style={{
        marginTop: 40,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
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
      <span style={{ fontSize: 20, color: LIGHT.textTertiary, marginRight: 6, fontWeight: 500 }}>
        Works with your favorites:
      </span>
      {PLATFORM_SHOWS.map((s, i) => (
        <div
          key={i}
          style={{
            width: 36,
            height: 36,
            borderRadius: 9,
            border: `2px solid ${LIGHT.bg}`,
            boxShadow: LIGHT.shadow,
            overflow: 'hidden',
            flexShrink: 0,
          }}
        >
          <Img src={staticFile(s.artwork)} style={{ width: 36, height: 36, objectFit: 'cover' }} />
        </div>
      ))}
      <span style={{ fontSize: 20, color: LIGHT.textTertiary, marginLeft: 4, fontWeight: 500 }}>
        & more
      </span>
    </div>
  );
};

// Legacy exports for individual scene compositions in Remotion Studio
export { FeatureAskAI as FeatureSmartPlayer };
export { FeatureDeepSummaries as FeatureActionItems };
export { FeatureUnified as FeatureChapters };
