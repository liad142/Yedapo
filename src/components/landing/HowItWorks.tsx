'use client';

import { Search, Sparkles, Lightbulb } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  ScrollReveal,
  StaggerContainer,
  StaggerItem,
} from '@/components/landing/ScrollReveal';
import { cn } from '@/lib/utils';
import { LANDING_COPY } from '@/lib/content/landing-copy';

const ICON_MAP = { search: Search, sparkles: Sparkles, lightbulb: Lightbulb };
const STEPS = LANDING_COPY.howItWorks;

const STEP_GRADIENTS = [
  'from-[#3b82f6] to-primary',    // Step 1 - Blue
  'from-primary to-[#8b5cf6]',    // Step 2 - Purple
  'from-[#8b5cf6] to-[#14b8a6]', // Step 3 - Teal
];

export function HowItWorks() {
  const prefersReduced = useReducedMotion();

  return (
    <section id="how-it-works" className="py-16 lg:py-24 bg-muted/30">
      <div className="max-w-5xl mx-auto px-6">
        <ScrollReveal>
          <div className="text-center mb-14">
            <h2
              className={cn(
                'text-3xl lg:text-4xl font-bold text-foreground tracking-tight',
                'font-[family-name:var(--font-plus-jakarta)]'
              )}
            >
              How it works
            </h2>
            <p className="text-lg text-muted-foreground mt-3">
              Three steps to smarter listening
            </p>
          </div>
        </ScrollReveal>

        <StaggerContainer
          className="grid grid-cols-1 md:grid-cols-3 gap-8"
          staggerDelay={0.15}
        >
          {STEPS.map((item, index) => {
            const Icon = ICON_MAP[item.icon as keyof typeof ICON_MAP];
            return (
              <StaggerItem key={item.step}>
                <div className="relative text-center p-6 group">
                  {/* Icon with gradient background */}
                  <div
                    className={cn(
                      'w-14 h-14 rounded-2xl bg-gradient-to-br text-white flex items-center justify-center mx-auto mb-5',
                      'shadow-lg transition-transform duration-300 group-hover:scale-110',
                      STEP_GRADIENTS[index]
                    )}
                  >
                    <Icon className="w-6 h-6" strokeWidth={1.5} />
                  </div>

                  {/* Step label with gradient number */}
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <span
                      className={cn(
                        'w-5 h-5 rounded-full bg-gradient-to-br text-white text-[10px] font-bold flex items-center justify-center',
                        STEP_GRADIENTS[index]
                      )}
                    >
                      {item.step}
                    </span>
                    <span className="text-xs font-bold text-muted-foreground/60 uppercase tracking-widest">
                      Step
                    </span>
                  </div>
                  <h3
                    className={cn(
                      'text-xl font-bold text-foreground mb-2',
                      'font-[family-name:var(--font-plus-jakarta)]'
                    )}
                  >
                    {item.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {item.description}
                  </p>

                  {/* Animated connector line (desktop, not on last) */}
                  {index < STEPS.length - 1 && (
                    <div className="hidden md:flex absolute top-10 -right-[20px] w-[40px] items-center">
                      {prefersReduced ? (
                        <div className="h-[2px] w-full bg-gradient-to-r from-primary/40 to-[#8b5cf6]/30 rounded-full" />
                      ) : (
                        <motion.div
                          className="h-[2px] w-full bg-gradient-to-r from-primary/50 to-[#8b5cf6]/30 rounded-full"
                          initial={{ scaleX: 0, opacity: 0 }}
                          whileInView={{ scaleX: 1, opacity: 1 }}
                          viewport={{ once: true }}
                          transition={{
                            duration: 0.6,
                            delay: 0.5 + index * 0.3,
                            ease: [0.25, 0.1, 0.25, 1],
                          }}
                          style={{ transformOrigin: 'left' }}
                        />
                      )}
                    </div>
                  )}
                </div>
              </StaggerItem>
            );
          })}
        </StaggerContainer>
      </div>
    </section>
  );
}
