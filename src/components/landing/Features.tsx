'use client';

import { ScrollReveal } from '@/components/landing/ScrollReveal';
import { cn } from '@/lib/utils';
import { LANDING_COPY } from '@/lib/content/landing-copy';
import {
  SummaryVisual,
  DiscoveryVisual,
  AskAIVisual,
  UnifiedVisual,
} from './FeatureVisuals';

const VISUALS = [SummaryVisual, DiscoveryVisual, AskAIVisual, UnifiedVisual];
const FEATURES = LANDING_COPY.features;

const FEATURE_ACCENT = [
  { dot: 'bg-[#3b82f6]', glow: 'bg-[#3b82f6]' },   // Blue - AI Summaries
  { dot: 'bg-[#8b5cf6]', glow: 'bg-[#8b5cf6]' },   // Purple - Smart Discovery
  { dot: 'bg-[#14b8a6]', glow: 'bg-[#14b8a6]' },   // Teal - Ask AI
  { dot: 'bg-[#f59e0b]', glow: 'bg-[#f59e0b]' },   // Amber - Unified
];

export function Features() {
  return (
    <section id="features" className="py-16 lg:py-24">
      <div className="max-w-6xl mx-auto px-6">
        {/* Section header */}
        <ScrollReveal>
          <div className="text-center mb-16">
            <h2
              className={cn(
                'text-3xl lg:text-4xl font-bold text-foreground tracking-tight',
                'font-[family-name:var(--font-plus-jakarta)]'
              )}
            >
              Everything you need to listen smarter
            </h2>
            <p className="text-lg text-muted-foreground mt-3 max-w-xl mx-auto">
              Powerful AI tools that turn hours of audio into minutes of insight.
            </p>
          </div>
        </ScrollReveal>

        {/* Feature rows */}
        {FEATURES.map((feature, index) => {
          const Visual = VISUALS[index];
          const isEven = index % 2 === 1;
          const accent = FEATURE_ACCENT[index];

          return (
            <div key={feature.overline} className="py-10 lg:py-16">
              <ScrollReveal>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
                  {/* Text column */}
                  <div className={cn(isEven && 'lg:order-2')}>
                    <span className="text-xs font-bold uppercase tracking-widest text-primary inline-flex items-center gap-2">
                      <span className={cn('w-2 h-2 rounded-full', accent.dot)} />
                      {feature.overline}
                    </span>
                    <h3
                      className={cn(
                        'text-2xl lg:text-3xl font-bold text-foreground tracking-tight mt-3',
                        'font-[family-name:var(--font-plus-jakarta)]'
                      )}
                    >
                      {feature.title}
                    </h3>
                    <p className="text-muted-foreground text-base lg:text-lg leading-relaxed mt-3">
                      {feature.description}
                    </p>
                  </div>

                  {/* Visual column */}
                  <div className={cn(isEven && 'lg:order-1', 'relative group')}>
                    {/* Colored accent glow behind the card */}
                    <div
                      className={cn(
                        'absolute -inset-4 rounded-3xl opacity-[0.15] landing-feature-glow',
                        accent.glow
                      )}
                      style={{ filter: 'blur(40px)' }}
                    />
                    <div className="relative landing-card-lift">
                      <Visual />
                    </div>
                  </div>
                </div>
              </ScrollReveal>
            </div>
          );
        })}
      </div>
    </section>
  );
}
