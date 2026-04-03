'use client';

import { Headphones, BookOpen, PenTool } from 'lucide-react';
import {
  ScrollReveal,
  StaggerContainer,
  StaggerItem,
} from '@/components/landing/ScrollReveal';
import { cn } from '@/lib/utils';
import { LANDING_COPY } from '@/lib/content/landing-copy';

const ICON_MAP = {
  headphones: Headphones,
  'book-open': BookOpen,
  'pen-tool': PenTool,
};

const USE_CASES = LANDING_COPY.useCases;

const CARD_ACCENTS = [
  { border: 'from-[#3b82f6] to-primary', iconBg: 'bg-[#3b82f6]/10', iconColor: 'text-[#3b82f6]', glowColor: 'rgba(59, 130, 246, 0.15)' },
  { border: 'from-[#8b5cf6] to-primary', iconBg: 'bg-[#8b5cf6]/10', iconColor: 'text-[#8b5cf6]', glowColor: 'rgba(139, 92, 246, 0.15)' },
  { border: 'from-[#14b8a6] to-primary', iconBg: 'bg-[#14b8a6]/10', iconColor: 'text-[#14b8a6]', glowColor: 'rgba(20, 184, 166, 0.15)' },
];

export function UseCases() {
  return (
    <section className="py-16 lg:py-24">
      <div className="max-w-5xl mx-auto px-6">
        <ScrollReveal>
          <div className="text-center mb-14">
            <h2
              className={cn(
                'text-3xl lg:text-4xl font-bold text-foreground tracking-tight',
                'font-[family-name:var(--font-plus-jakarta)]'
              )}
            >
              Built for how you listen
            </h2>
            <p className="text-lg text-muted-foreground mt-3">
              Whether you follow 5 podcasts or 50, Yedapo adapts to your
              workflow.
            </p>
          </div>
        </ScrollReveal>

        <StaggerContainer
          className="grid grid-cols-1 md:grid-cols-3 gap-6"
          staggerDelay={0.12}
        >
          {USE_CASES.map((uc, i) => {
            const Icon = ICON_MAP[uc.icon as keyof typeof ICON_MAP];
            const accent = CARD_ACCENTS[i];
            return (
              <StaggerItem key={uc.persona}>
                <div
                  className="rounded-2xl border border-border bg-card p-6 h-full flex flex-col relative overflow-hidden landing-card-lift"
                  style={{
                    ['--hover-glow' as string]: accent.glowColor,
                  }}
                >
                  {/* Gradient top border */}
                  <div
                    className={cn(
                      'absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r',
                      accent.border
                    )}
                  />

                  <div
                    className={cn(
                      'w-10 h-10 rounded-xl flex items-center justify-center mb-4',
                      accent.iconBg, accent.iconColor
                    )}
                  >
                    <Icon className="w-5 h-5" strokeWidth={1.5} />
                  </div>
                  <h3
                    className={cn(
                      'text-base font-bold text-foreground mb-2',
                      'font-[family-name:var(--font-plus-jakarta)]'
                    )}
                  >
                    {uc.persona}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed flex-1">
                    {uc.description}
                  </p>
                  <div className="mt-4 pt-4 border-t border-border">
                    <span className="text-xs font-semibold text-primary">
                      {uc.metric}
                    </span>
                  </div>
                </div>
              </StaggerItem>
            );
          })}
        </StaggerContainer>
      </div>
    </section>
  );
}
