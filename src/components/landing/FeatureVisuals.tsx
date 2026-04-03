'use client';

/* ─── Feature section visual components ─────────────────────────── */
/* Each illustrates a specific feature using styled UI patterns.      */

export function SummaryVisual() {
  return (
    <div className="rounded-2xl border border-border/50 bg-card/50 p-5 shadow-lg">
      {/* Tab bar */}
      <div className="flex gap-1 mb-4">
        <span className="text-xs font-medium px-3 py-1.5 rounded-full bg-primary/10 text-primary">
          Quick Summary
        </span>
        <span className="text-xs font-medium px-3 py-1.5 rounded-full text-muted-foreground">
          Deep Analysis
        </span>
        <span className="text-xs font-medium px-3 py-1.5 rounded-full text-muted-foreground">
          Chapters
        </span>
      </div>

      {/* Key takeaways */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-1 h-4 rounded-full bg-primary" />
          <span className="text-xs font-semibold text-foreground">Key Takeaways</span>
        </div>
        {[
          'AI regulation needs international coordination — no single country can go alone',
          'The economic impact will be uneven across industries and geographies',
          'Open source is accelerating innovation but raising new safety questions',
        ].map((point, i) => (
          <div key={i} className="flex items-start gap-2 ml-3">
            <div className="w-1.5 h-1.5 rounded-full bg-primary/40 mt-1.5 shrink-0" />
            <p className="text-xs text-muted-foreground leading-relaxed">{point}</p>
          </div>
        ))}
      </div>

      {/* Chapter timeline */}
      <div className="mt-4 pt-4 border-t border-border/50">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-1 h-4 rounded-full bg-amber-500/60" />
          <span className="text-xs font-semibold text-foreground">4 Chapters</span>
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div className="flex h-full">
            <div className="w-[15%] bg-primary/40" />
            <div className="w-px bg-background" />
            <div className="w-[30%] bg-primary/30" />
            <div className="w-px bg-background" />
            <div className="w-[35%] bg-primary/20" />
            <div className="w-px bg-background" />
            <div className="w-[20%] bg-primary/10" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function DiscoveryVisual() {
  const episodes = [
    { title: 'Why Sleep Matters More Than Diet', podcast: 'Huberman Lab', match: 98, genre: 'Science' },
    { title: 'The Creator Economy in 2026', podcast: 'My First Million', match: 94, genre: 'Business' },
    { title: 'Building AGI Responsibly', podcast: 'Lex Fridman', match: 91, genre: 'AI' },
  ];

  return (
    <div className="rounded-2xl border border-border/50 bg-card/50 p-5 shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-semibold text-foreground">Your Daily Mix</span>
        <span className="text-[10px] text-primary font-medium">Personalized</span>
      </div>
      <div className="space-y-3">
        {episodes.map((ep) => (
          <div
            key={ep.title}
            className="flex items-center gap-3 p-2.5 rounded-xl bg-muted/30"
          >
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 shrink-0 flex items-center justify-center">
              <span className="text-xs">🎙</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-foreground truncate">{ep.title}</p>
              <p className="text-[10px] text-muted-foreground">{ep.podcast}</p>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <span className="text-[9px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">
                {ep.match}%
              </span>
              <span className="text-[9px] text-muted-foreground">{ep.genre}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AskAIVisual() {
  return (
    <div className="rounded-2xl border border-border/50 bg-card/50 p-5 shadow-lg">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-6 h-6 rounded-lg bg-primary/15 flex items-center justify-center">
          <span className="text-xs text-primary">✦</span>
        </div>
        <span className="text-xs font-semibold text-foreground">Ask AI</span>
      </div>

      {/* User question */}
      <div className="flex justify-end mb-3">
        <div className="bg-primary/10 rounded-xl rounded-tr-sm px-3.5 py-2 max-w-[80%]">
          <p className="text-xs text-foreground">What did the guest say about regulation?</p>
        </div>
      </div>

      {/* AI answer */}
      <div className="flex justify-start">
        <div className="bg-muted/50 rounded-xl rounded-tl-sm px-3.5 py-2.5 max-w-[90%]">
          <p className="text-xs text-muted-foreground leading-relaxed">
            The guest argued that{' '}
            <span className="text-foreground font-medium">
              regulation should focus on outcomes, not methods
            </span>
            , comparing it to how aviation safety works...
          </p>
          <div className="flex items-center gap-1.5 mt-2">
            <span className="text-[9px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
              📍 32:15
            </span>
            <span className="text-[9px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
              📍 48:02
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function UnifiedVisual() {
  return (
    <div className="rounded-2xl border border-border/50 bg-card/50 p-5 shadow-lg">
      {/* Platform badges */}
      <div className="flex items-center justify-center gap-4 mb-5">
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-muted/50">
          <div className="w-6 h-6 rounded bg-purple-500/20 flex items-center justify-center">
            <span className="text-xs">🎧</span>
          </div>
          <span className="text-xs font-medium text-muted-foreground">Podcasts</span>
        </div>
        <span className="text-muted-foreground/30 text-lg font-light">+</span>
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-muted/50">
          <div className="w-6 h-6 rounded bg-red-500/20 flex items-center justify-center">
            <span className="text-xs">▶</span>
          </div>
          <span className="text-xs font-medium text-muted-foreground">YouTube</span>
        </div>
      </div>

      {/* Unified feed */}
      <div className="border-t border-border/50 pt-4">
        <span className="text-[10px] text-muted-foreground font-medium mb-2.5 block">
          Unified Feed
        </span>
        <div className="space-y-2">
          {[
            { title: 'How to Build Wealth', source: '🎧 Naval Podcast', type: 'podcast' as const },
            { title: 'Tesla Factory Tour', source: '▶ Marques Brownlee', type: 'youtube' as const },
            { title: 'Deep Work Principles', source: '🎧 Tim Ferriss Show', type: 'podcast' as const },
          ].map((item) => (
            <div key={item.title} className="flex items-center gap-2.5 p-2 rounded-lg bg-muted/20">
              <div
                className={`w-8 h-8 rounded-lg shrink-0 flex items-center justify-center ${
                  item.type === 'podcast' ? 'bg-purple-500/10' : 'bg-red-500/10'
                }`}
              >
                <span className="text-[10px]">{item.type === 'podcast' ? '🎧' : '▶'}</span>
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-foreground truncate">{item.title}</p>
                <p className="text-[9px] text-muted-foreground">{item.source}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
