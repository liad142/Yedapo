'use client';

import { motion, useReducedMotion } from 'framer-motion';

/**
 * A CSS-built product mockup for the Hero section.
 * Dark-themed "app window" showing the core value: episode summary + Ask AI.
 */
export function HeroProductMockup() {
  const prefersReduced = useReducedMotion();

  const appear = (delay: number) =>
    prefersReduced
      ? {}
      : {
          initial: { opacity: 0, y: 24 },
          animate: { opacity: 1, y: 0 },
          transition: {
            duration: 0.7,
            delay,
            ease: [0.25, 0.1, 0.25, 1] as [number, number, number, number],
          },
        };

  return (
    <div className="relative mx-auto max-w-4xl">
      {/* Background glow */}
      <div className="absolute -inset-x-20 -inset-y-10 bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 blur-3xl rounded-full -z-10" />

      {/* ── Main app window ────────────────────────────────────── */}
      <motion.div
        {...appear(0.4)}
        className="rounded-2xl border border-white/[0.08] bg-[#0c0c14] shadow-2xl shadow-black/50 overflow-hidden"
      >
        {/* Window chrome */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06]">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
            <div className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
            <div className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
          </div>
          <div className="flex-1 flex justify-center">
            <div className="bg-white/[0.04] rounded-md px-16 py-1">
              <span className="text-[11px] text-white/25 font-medium">yedapo.com</span>
            </div>
          </div>
        </div>

        {/* App content */}
        <div className="flex min-h-[300px] sm:min-h-[360px]">
          {/* ── Sidebar ─────────────────────────────────────────── */}
          <div className="hidden sm:flex flex-col w-44 border-r border-white/[0.06] py-4 px-3 gap-1">
            <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg bg-white/[0.06]">
              <div className="w-4 h-4 rounded bg-primary/50" />
              <span className="text-[11px] text-white/70 font-medium">Discover</span>
            </div>
            {['My Feed', 'Saved', 'History'].map((item) => (
              <div key={item} className="flex items-center gap-2.5 px-2.5 py-2">
                <div className="w-4 h-4 rounded bg-white/[0.06]" />
                <span className="text-[11px] text-white/30">{item}</span>
              </div>
            ))}

            <div className="mt-auto pt-3 border-t border-white/[0.06]">
              <span className="text-[9px] text-white/20 uppercase tracking-widest font-semibold px-2.5">
                Following
              </span>
              {['Lex Fridman', 'Huberman Lab', 'All-In Pod'].map((name) => (
                <div key={name} className="flex items-center gap-2 px-2.5 py-1.5 mt-0.5">
                  <div className="w-5 h-5 rounded-full bg-white/[0.06] shrink-0" />
                  <span className="text-[11px] text-white/25 truncate">{name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Main content ────────────────────────────────────── */}
          <div className="flex-1 p-5 sm:p-6">
            {/* Episode header */}
            <div className="flex items-start gap-3.5 mb-5">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary/30 to-primary/5 shrink-0 flex items-center justify-center">
                <span className="text-lg">🎙</span>
              </div>
              <div className="min-w-0">
                <h3 className="text-[13px] font-semibold text-white/90 leading-tight">
                  The Future of AI Agents
                </h3>
                <p className="text-[11px] text-white/35 mt-0.5">
                  Lex Fridman Podcast · #421 · 2h 45m
                </p>
                <div className="flex gap-1.5 mt-2">
                  <span className="text-[9px] px-2 py-0.5 rounded-full bg-primary/15 text-primary/70 font-medium">
                    AI
                  </span>
                  <span className="text-[9px] px-2 py-0.5 rounded-full bg-white/[0.05] text-white/30 font-medium">
                    Technology
                  </span>
                </div>
              </div>
            </div>

            {/* Key Takeaways */}
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2.5">
                <div className="w-0.5 h-3.5 rounded-full bg-primary/60" />
                <span className="text-[11px] font-semibold text-white/60 uppercase tracking-wider">
                  Key Takeaways
                </span>
              </div>
              <ul className="space-y-2 ml-3">
                {[
                  'AI agents will fundamentally reshape how we interact with software',
                  'The biggest challenge is trust and alignment, not raw capability',
                  'Open-source models are closing the gap faster than expected',
                ].map((point, i) => (
                  <li
                    key={i}
                    className="text-[12px] text-white/45 flex items-start gap-2 leading-relaxed"
                  >
                    <span className="text-primary/50 mt-0.5 shrink-0">•</span>
                    {point}
                  </li>
                ))}
              </ul>
            </div>

            {/* Chapters */}
            <div>
              <div className="flex items-center gap-2 mb-2.5">
                <div className="w-0.5 h-3.5 rounded-full bg-amber-400/50" />
                <span className="text-[11px] font-semibold text-white/60 uppercase tracking-wider">
                  Chapters
                </span>
              </div>
              <div className="space-y-1.5 ml-3">
                {[
                  ['00:00', 'Introduction & Background'],
                  ['12:45', 'What AI Agents Can Do Today'],
                  ['45:20', 'The Alignment Problem'],
                ].map(([time, title]) => (
                  <div key={time} className="flex items-center gap-3 text-[11px]">
                    <span className="text-white/20 font-mono w-8 shrink-0">{time}</span>
                    <span className="text-white/40">{title}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── Floating Ask AI card ───────────────────────────────── */}
      <motion.div
        {...appear(0.85)}
        className="absolute -bottom-8 right-2 sm:right-6 w-64 sm:w-72 rounded-xl border border-white/[0.08] bg-[#13131d]/95 backdrop-blur-xl shadow-2xl shadow-black/40 p-4"
        style={!prefersReduced ? { animation: 'landing-float-slow 4s ease-in-out infinite' } : undefined}
      >
        <div className="flex items-center gap-2 mb-2.5">
          <div className="w-5 h-5 rounded-md bg-primary/20 flex items-center justify-center">
            <span className="text-[10px] text-primary">✦</span>
          </div>
          <span className="text-[11px] font-semibold text-white/70">Ask AI</span>
        </div>
        <div className="rounded-lg bg-white/[0.04] p-2.5 mb-2">
          <p className="text-[11px] text-white/35 italic">
            &ldquo;What was the main argument about AI alignment?&rdquo;
          </p>
        </div>
        <div className="rounded-lg bg-primary/[0.08] p-2.5">
          <p className="text-[11px] text-white/55 leading-relaxed">
            The guest argues that alignment is fundamentally a{' '}
            <span className="text-primary/80 font-medium">
              values problem, not a technical one
            </span>
            ...
          </p>
          <span className="text-[9px] text-primary/40 mt-1.5 inline-block">
            📍 Cited from 47:15
          </span>
        </div>
      </motion.div>
    </div>
  );
}
