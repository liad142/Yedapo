import React from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Easing,
  Sequence,
} from 'remotion';
import { loadFont } from '@remotion/google-fonts/Inter';
import { COLORS } from '../design';
import { FadeUpWords } from '../components/AnimatedText';
import { FloatingCard, GlowOrb, FeatureIcon, Pill, SkeletonLine, ProgressBar } from '../components/UIElements';

const { fontFamily } = loadFont('normal', {
  weights: ['400', '500', '600', '700', '800'],
  subsets: ['latin'],
});

// ---------------------------------------------------------------------------
// Shared layout: left text + right mock UI
// ---------------------------------------------------------------------------
type FeatureLayoutProps = {
  overline: string;
  title: string;
  description: string;
  icon: string;
  accentColor?: string;
  children: React.ReactNode; // right side mock UI
};

const FeatureLayout: React.FC<FeatureLayoutProps> = ({
  overline,
  title,
  description,
  icon,
  accentColor = COLORS.primary,
  children,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

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
      <GlowOrb x={400} y={500} size={500} color={`${accentColor}20`} delay={0} />

      <div
        style={{
          display: 'flex',
          gap: 80,
          alignItems: 'center',
          padding: '0 120px',
          width: '100%',
        }}
      >
        {/* Left: text */}
        <div style={{ flex: 1, maxWidth: 560 }}>
          <Sequence from={0} layout="none" premountFor={Math.round(0.5 * fps)}>
            <FeatureIcon icon={icon} delay={0} size={64} />
          </Sequence>

          <div style={{ marginTop: 24 }}>
            <Pill label={overline} delay={8} color={accentColor} bgColor={`${accentColor}18`} />
          </div>

          <div style={{ marginTop: 20 }}>
            <FadeUpWords
              text={title}
              fontSize={44}
              fontWeight={700}
              color={COLORS.textPrimary}
              delay={12}
              stagger={4}
              textAlign="left"
              lineHeight={1.2}
            />
          </div>

          <Sequence from={25} layout="none" premountFor={Math.round(0.5 * fps)}>
            <div style={{ marginTop: 16 }}>
              <FadeUpWords
                text={description}
                fontSize={18}
                fontWeight={400}
                color={COLORS.textSecondary}
                delay={0}
                stagger={2}
                textAlign="left"
                lineHeight={1.6}
              />
            </div>
          </Sequence>
        </div>

        {/* Right: mock UI */}
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
          {children}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// Scene: Smart Player
// ---------------------------------------------------------------------------
export const FeatureSmartPlayer: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <FeatureLayout
      overline="Smart Player"
      title="Listen smarter, not longer"
      description="Speed controls, chapter navigation, and bookmarks — all powered by AI-generated timestamps."
      icon="🎧"
      accentColor={COLORS.primary}
    >
      <FloatingCard delay={15} width={480} height={320}>
        <div style={{ padding: 24 }}>
          {/* Mini player header */}
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 20 }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 10,
                background: 'linear-gradient(135deg, #3498db, #2980b9)',
              }}
            />
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: COLORS.textPrimary }}>
                Huberman Lab
              </div>
              <div style={{ fontSize: 12, color: COLORS.textTertiary }}>
                Ep. 204 — Focus & Productivity
              </div>
            </div>
            <div
              style={{
                marginLeft: 'auto',
                padding: '4px 12px',
                borderRadius: 8,
                background: COLORS.surface3,
                fontSize: 13,
                fontWeight: 600,
                color: COLORS.primaryLight,
              }}
            >
              1.5x
            </div>
          </div>

          {/* Waveform */}
          <div style={{ display: 'flex', gap: 2, alignItems: 'center', height: 50, marginBottom: 16 }}>
            {Array.from({ length: 70 }, (_, i) => {
              const barH = 10 + Math.sin(i * 0.4) * 20 + Math.cos(i * 0.7) * 10;
              const played = i < 35;
              return (
                <div
                  key={i}
                  style={{
                    width: 3,
                    height: Math.max(4, barH),
                    borderRadius: 2,
                    background: played ? COLORS.primary : COLORS.surface3,
                    opacity: played ? 1 : 0.5,
                  }}
                />
              );
            })}
          </div>

          {/* Chapter markers */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            {['Intro', 'Focus Protocols', 'Caffeine Timing', 'Q&A'].map((ch, i) => (
              <Sequence key={i} from={25 + i * 6} layout="none" premountFor={Math.round(0.3 * fps)}>
                <ChapterPill label={ch} active={i === 1} />
              </Sequence>
            ))}
          </div>

          {/* Time display */}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: COLORS.textTertiary }}>
            <span>32:14</span>
            <span>1:47:02</span>
          </div>
        </div>
      </FloatingCard>
    </FeatureLayout>
  );
};

const ChapterPill: React.FC<{ label: string; active: boolean }> = ({ label, active }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = spring({ frame, fps, config: { damping: 200 } });

  return (
    <div
      style={{
        padding: '5px 14px',
        borderRadius: 8,
        fontSize: 12,
        fontWeight: 500,
        background: active ? `${COLORS.primary}22` : COLORS.surface2,
        color: active ? COLORS.primaryLight : COLORS.textTertiary,
        border: active ? `1px solid ${COLORS.primary}44` : `1px solid ${COLORS.surface3}`,
        opacity: interpolate(progress, [0, 1], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
        transform: `scale(${interpolate(progress, [0, 1], [0.8, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })})`,
      }}
    >
      {label}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Scene: Ask AI
// ---------------------------------------------------------------------------
export const FeatureAskAI: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const answerDelay = Math.round(1.5 * fps);
  const answerFrame = Math.max(0, frame - answerDelay);
  const answerText =
    'Andrew Huberman recommends consuming caffeine 90-120 minutes after waking to avoid an afternoon energy crash. This aligns with the natural cortisol peak cycle.';
  const answerChars = Math.min(
    answerText.length,
    Math.floor(answerFrame / 1.2),
  );

  return (
    <FeatureLayout
      overline="Ask AI"
      title="Ask anything. Get cited answers."
      description="Have a question about any episode? Ask it. Get precise answers drawn directly from the transcript, with timestamps."
      icon="💬"
      accentColor={COLORS.purple}
    >
      <FloatingCard delay={15} width={500} height={360}>
        <div style={{ padding: 24 }}>
          {/* Chat messages */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* User question */}
            <Sequence from={10} layout="none" premountFor={Math.round(0.3 * fps)}>
              <ChatBubble
                text="When should I drink coffee for best focus?"
                isUser
              />
            </Sequence>

            {/* AI answer */}
            <Sequence from={answerDelay} layout="none" premountFor={Math.round(0.5 * fps)}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <div
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 6,
                      background: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.purple})`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 12,
                    }}
                  >
                    ✨
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.primaryLight }}>
                    Yedapo AI
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 14,
                    color: COLORS.textSecondary,
                    lineHeight: 1.6,
                    padding: '12px 16px',
                    borderRadius: 12,
                    background: COLORS.surface2,
                    border: `1px solid ${COLORS.surface3}`,
                  }}
                >
                  {answerText.slice(0, answerChars)}
                  {answerChars < answerText.length && (
                    <span style={{ color: COLORS.primary, opacity: frame % 16 < 8 ? 1 : 0 }}>|</span>
                  )}
                </div>
                {/* Citation */}
                {answerChars > 80 && (
                  <div
                    style={{
                      display: 'flex',
                      gap: 6,
                      marginTop: 8,
                      alignItems: 'center',
                    }}
                  >
                    <span style={{ fontSize: 11, color: COLORS.textTertiary }}>📍</span>
                    <span
                      style={{
                        fontSize: 11,
                        color: COLORS.primaryLight,
                        fontWeight: 500,
                        padding: '2px 8px',
                        borderRadius: 4,
                        background: `${COLORS.primary}15`,
                      }}
                    >
                      @ 34:22 — Caffeine Timing Protocol
                    </span>
                  </div>
                )}
              </div>
            </Sequence>
          </div>
        </div>
      </FloatingCard>
    </FeatureLayout>
  );
};

const ChatBubble: React.FC<{ text: string; isUser: boolean }> = ({ text, isUser }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = spring({ frame, fps, config: { damping: 200 } });

  return (
    <div
      style={{
        alignSelf: isUser ? 'flex-end' : 'flex-start',
        maxWidth: '85%',
        padding: '10px 16px',
        borderRadius: 12,
        background: isUser
          ? `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.primaryDark})`
          : COLORS.surface2,
        color: isUser ? '#fff' : COLORS.textSecondary,
        fontSize: 14,
        fontWeight: isUser ? 500 : 400,
        opacity: interpolate(progress, [0, 1], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
        transform: `translateY(${interpolate(progress, [0, 1], [15, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}px)`,
      }}
    >
      {text}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Scene: Deep Summaries
// ---------------------------------------------------------------------------
export const FeatureDeepSummaries: React.FC = () => {
  return (
    <FeatureLayout
      overline="Deep Summaries"
      title="Two-minute read. Two-hour episode."
      description="Every episode gets a quick brief and a deep analysis — key takeaways, chapter breakdowns, and actionable insights."
      icon="📋"
      accentColor={COLORS.primary}
    >
      <FloatingCard delay={15} width={480} height={380}>
        <div style={{ padding: 24 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            <SummaryTab label="Quick Brief" active />
            <SummaryTab label="Deep Analysis" active={false} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <SummaryBlock
              title="Key Takeaway"
              text="Deliberate cold exposure for 11+ minutes/week improves dopamine baseline by 200-300%."
              delay={20}
              icon="🎯"
            />
            <SummaryBlock
              title="Action Item"
              text="Start with 2-minute cold showers, 3x per week. Build up gradually."
              delay={35}
              icon="✅"
            />
            <SummaryBlock
              title="Notable Quote"
              text='"The best tool for focus is the one you actually use consistently."'
              delay={50}
              icon="💡"
            />
          </div>
        </div>
      </FloatingCard>
    </FeatureLayout>
  );
};

const SummaryTab: React.FC<{ label: string; active: boolean }> = ({ label, active }) => (
  <div
    style={{
      padding: '6px 16px',
      borderRadius: 8,
      fontSize: 13,
      fontWeight: 600,
      background: active ? `${COLORS.primary}22` : 'transparent',
      color: active ? COLORS.primaryLight : COLORS.textTertiary,
      border: active ? `1px solid ${COLORS.primary}33` : '1px solid transparent',
    }}
  >
    {label}
  </div>
);

const SummaryBlock: React.FC<{
  title: string;
  text: string;
  delay: number;
  icon: string;
}> = ({ title, text, delay, icon }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = spring({ frame: frame - delay, fps, config: { damping: 200 } });

  return (
    <div
      style={{
        padding: '12px 16px',
        borderRadius: 10,
        background: COLORS.surface2,
        border: `1px solid ${COLORS.surface3}`,
        opacity: interpolate(progress, [0, 1], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
        transform: `translateY(${interpolate(progress, [0, 1], [20, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}px)`,
      }}
    >
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 14 }}>{icon}</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.textPrimary }}>{title}</span>
      </div>
      <div style={{ fontSize: 13, color: COLORS.textSecondary, lineHeight: 1.5 }}>{text}</div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Scene: Action Items
// ---------------------------------------------------------------------------
export const FeatureActionItems: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const items = [
    { text: 'Try 2-min cold exposure protocol', checked: true, delay: 20 },
    { text: 'Set caffeine timer — 90 min after waking', checked: true, delay: 30 },
    { text: 'Research NSDR (non-sleep deep rest) apps', checked: false, delay: 40 },
    { text: 'Schedule weekly reflection review', checked: false, delay: 50 },
  ];

  return (
    <FeatureLayout
      overline="Action Items"
      title="Turn insights into action"
      description="AI extracts specific, actionable steps from every episode so you can apply what you learn immediately."
      icon="✅"
      accentColor={COLORS.green}
    >
      <FloatingCard delay={15} width={460} height={320}>
        <div style={{ padding: 24 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: COLORS.textPrimary, marginBottom: 16 }}>
            Action Items (4)
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {items.map((item, i) => (
              <ActionItem key={i} {...item} />
            ))}
          </div>
        </div>
      </FloatingCard>
    </FeatureLayout>
  );
};

const ActionItem: React.FC<{ text: string; checked: boolean; delay: number }> = ({
  text,
  checked,
  delay,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = spring({ frame: frame - delay, fps, config: { damping: 200 } });

  // Checkbox fill animation
  const checkDelay = delay + 15;
  const checkProgress = spring({
    frame: frame - checkDelay,
    fps,
    config: { damping: 20, stiffness: 200 },
  });

  return (
    <div
      style={{
        display: 'flex',
        gap: 12,
        alignItems: 'center',
        padding: '10px 14px',
        borderRadius: 10,
        background: COLORS.surface2,
        border: `1px solid ${COLORS.surface3}`,
        opacity: interpolate(progress, [0, 1], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
        transform: `translateX(${interpolate(progress, [0, 1], [30, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}px)`,
      }}
    >
      <div
        style={{
          width: 22,
          height: 22,
          borderRadius: 6,
          border: `2px solid ${checked ? COLORS.green : COLORS.surface3}`,
          background: checked
            ? `rgba(34, 197, 94, ${interpolate(checkProgress, [0, 1], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })})`
            : 'transparent',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 12,
          color: '#fff',
          flexShrink: 0,
        }}
      >
        {checked && checkProgress > 0.5 ? '✓' : ''}
      </div>
      <span
        style={{
          fontSize: 13,
          color: checked ? COLORS.textTertiary : COLORS.textSecondary,
          textDecoration: checked && checkProgress > 0.5 ? 'line-through' : 'none',
        }}
      >
        {text}
      </span>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Scene: Chapters & Highlights
// ---------------------------------------------------------------------------
export const FeatureChapters: React.FC = () => {
  const chapters = [
    { time: '00:00', title: 'Introduction & Overview', highlight: false },
    { time: '12:34', title: 'The Science of Cold Exposure', highlight: true },
    { time: '28:15', title: 'Caffeine Timing Protocol', highlight: true },
    { time: '45:02', title: 'NSDR & Recovery Tools', highlight: false },
    { time: '1:03:11', title: 'Listener Q&A', highlight: false },
  ];

  return (
    <FeatureLayout
      overline="Chapters & Highlights"
      title="Navigate any episode like a book"
      description="AI-generated chapters, key highlights, and cited moments — jump directly to what matters most."
      icon="📑"
      accentColor={COLORS.amber}
    >
      <FloatingCard delay={15} width={460} height={340}>
        <div style={{ padding: 24 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <Pill label="Chapters" delay={18} color={COLORS.amber} bgColor={`${COLORS.amber}18`} />
            <Pill label="5 highlights" delay={24} color={COLORS.primaryLight} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {chapters.map((ch, i) => (
              <ChapterRow key={i} {...ch} delay={20 + i * 8} />
            ))}
          </div>
        </div>
      </FloatingCard>
    </FeatureLayout>
  );
};

const ChapterRow: React.FC<{
  time: string;
  title: string;
  highlight: boolean;
  delay: number;
}> = ({ time, title, highlight, delay }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = spring({ frame: frame - delay, fps, config: { damping: 200 } });

  return (
    <div
      style={{
        display: 'flex',
        gap: 14,
        alignItems: 'center',
        padding: '10px 14px',
        borderRadius: 10,
        background: highlight ? `${COLORS.amber}0a` : COLORS.surface2,
        border: `1px solid ${highlight ? `${COLORS.amber}22` : COLORS.surface3}`,
        opacity: interpolate(progress, [0, 1], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
        transform: `translateX(${interpolate(progress, [0, 1], [25, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}px)`,
      }}
    >
      <span
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: highlight ? COLORS.amber : COLORS.textTertiary,
          fontVariantNumeric: 'tabular-nums',
          minWidth: 52,
        }}
      >
        {time}
      </span>
      <span style={{ fontSize: 13, color: COLORS.textSecondary, flex: 1 }}>{title}</span>
      {highlight && (
        <span style={{ fontSize: 11, color: COLORS.amber }}>⭐</span>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Scene: Unified Experience
// ---------------------------------------------------------------------------
export const FeatureUnified: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <FeatureLayout
      overline="Podcasts + YouTube"
      title="One app for everything you follow"
      description="Podcasts and YouTube channels live side by side. Follow, summarize, and explore across both — no switching apps."
      icon="🌐"
      accentColor="#e74c3c"
    >
      <div style={{ display: 'flex', gap: 20, flexDirection: 'column', alignItems: 'center' }}>
        {/* Two cards side by side showing podcast + YouTube */}
        <div style={{ display: 'flex', gap: 16 }}>
          <FloatingCard delay={15} width={230} height={200}>
            <div style={{ padding: 20 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: 'linear-gradient(135deg, #9b59b6, #8e44ad)',
                  marginBottom: 12,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 18,
                }}
              >
                🎙️
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.textPrimary, marginBottom: 4 }}>
                Lex Fridman
              </div>
              <div style={{ fontSize: 12, color: COLORS.textTertiary, marginBottom: 12 }}>
                Podcast · 420 episodes
              </div>
              <Pill label="Summarized" delay={30} color={COLORS.green} bgColor={`${COLORS.green}18`} />
            </div>
          </FloatingCard>

          <FloatingCard delay={22} width={230} height={200}>
            <div style={{ padding: 20 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: 'linear-gradient(135deg, #e74c3c, #c0392b)',
                  marginBottom: 12,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 18,
                }}
              >
                ▶️
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.textPrimary, marginBottom: 4 }}>
                Fireship
              </div>
              <div style={{ fontSize: 12, color: COLORS.textTertiary, marginBottom: 12 }}>
                YouTube · 312 videos
              </div>
              <Pill label="Following" delay={36} color={COLORS.primaryLight} />
            </div>
          </FloatingCard>
        </div>

        {/* Unifying bar */}
        <Sequence from={Math.round(1.5 * fps)} layout="none" premountFor={Math.round(0.3 * fps)}>
          <UnifyBar />
        </Sequence>
      </div>
    </FeatureLayout>
  );
};

const UnifyBar: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 30 });

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 28px',
        borderRadius: 14,
        background: COLORS.bgCard,
        border: `1px solid ${COLORS.surface3}`,
        boxShadow: `0 8px 30px rgba(0,0,0,0.3)`,
        opacity: interpolate(progress, [0, 1], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
        transform: `translateY(${interpolate(progress, [0, 1], [20, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}px)`,
      }}
    >
      <span style={{ fontSize: 14, color: COLORS.textTertiary }}>🔍</span>
      <span style={{ fontSize: 14, color: COLORS.textSecondary }}>
        Search across all your podcasts & channels...
      </span>
    </div>
  );
};
