'use client';

import { Headphones, Play, Sparkles, Heart } from 'lucide-react';
import { ScrollReveal } from '@/components/landing/ScrollReveal';
import { cn } from '@/lib/utils';
import { LANDING_COPY } from '@/lib/content/landing-copy';

const ICONS = [Headphones, Play, Sparkles, Heart];
const SIGNALS = LANDING_COPY.trustSignals;

const ICON_STYLES = [
  { bg: 'bg-foreground/5 dark:bg-white/5', color: 'text-foreground/70 dark:text-white/70' },
  { bg: 'bg-red-500/10', color: 'text-red-500' },
  { bg: 'bg-[#8b5cf6]/10', color: 'text-[#8b5cf6]' },
  { bg: 'bg-[#14b8a6]/10', color: 'text-[#14b8a6]' },
];

export function SocialProof() {
  return (
    <section className="py-10 border-y border-border/50">
      <div className="max-w-5xl mx-auto px-6">
        <ScrollReveal>
          <div className="flex flex-wrap justify-center gap-x-2 gap-y-4">
            {SIGNALS.map((signal, i) => {
              const Icon = ICONS[i];
              return (
                <div key={signal.label} className="flex items-center gap-3 relative">
                  {/* Gradient separator */}
                  {i > 0 && (
                    <div className="hidden sm:block absolute -left-1 top-1/2 -translate-y-1/2 w-px h-5 bg-gradient-to-b from-transparent via-primary/25 to-transparent" />
                  )}
                  <div
                    className={cn(
                      'flex items-center gap-2.5 px-4 py-2.5 rounded-xl transition-all duration-300',
                      'hover:bg-muted/40 dark:hover:bg-white/[0.04] group cursor-default'
                    )}
                  >
                    <div
                      className={cn(
                        'w-8 h-8 rounded-lg flex items-center justify-center transition-transform duration-300 group-hover:scale-110',
                        ICON_STYLES[i].bg
                      )}
                    >
                      <Icon
                        className={cn('w-4 h-4', ICON_STYLES[i].color)}
                        strokeWidth={1.5}
                      />
                    </div>
                    <div>
                      <span className="text-sm font-medium text-foreground">
                        {signal.label}
                      </span>
                      <span className="text-xs text-muted-foreground ml-1.5">
                        {signal.sublabel}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
