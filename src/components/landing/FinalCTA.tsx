'use client';

import Link from 'next/link';
import { useReducedMotion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ScrollReveal } from '@/components/landing/ScrollReveal';
import { cn } from '@/lib/utils';
import { LANDING_COPY } from '@/lib/content/landing-copy';

const CONTENT = LANDING_COPY.finalCta;

const PARTICLES = [
  { left: '8%', bottom: '15%', y: '-120px', x: '25px', dur: '7s', delay: '0s', opacity: 0.3, size: 3 },
  { left: '18%', bottom: '30%', y: '-180px', x: '-15px', dur: '8s', delay: '1s', opacity: 0.25, size: 2 },
  { left: '32%', bottom: '10%', y: '-150px', x: '30px', dur: '6s', delay: '2s', opacity: 0.35, size: 2.5 },
  { left: '50%', bottom: '25%', y: '-200px', x: '-20px', dur: '9s', delay: '0.5s', opacity: 0.2, size: 3 },
  { left: '65%', bottom: '18%', y: '-160px', x: '35px', dur: '7.5s', delay: '1.5s', opacity: 0.3, size: 2 },
  { left: '78%', bottom: '35%', y: '-140px', x: '-25px', dur: '8.5s', delay: '3s', opacity: 0.25, size: 2.5 },
  { left: '88%', bottom: '12%', y: '-170px', x: '15px', dur: '6.5s', delay: '2.5s', opacity: 0.3, size: 3 },
  { left: '42%', bottom: '40%', y: '-190px', x: '-10px', dur: '10s', delay: '4s', opacity: 0.2, size: 2 },
];

export function FinalCTA() {
  const prefersReduced = useReducedMotion();

  return (
    <section className="py-20 lg:py-28 landing-dark-section relative overflow-hidden">
      {/* Animated dramatic gradient glow */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] rounded-full"
        style={{
          background: 'radial-gradient(ellipse, #8b5cf6 0%, hsl(200 75% 45%) 35%, #14b8a6 60%, transparent 75%)',
          filter: 'blur(120px)',
          animation: prefersReduced ? 'none' : 'landing-pulse-glow 4s ease-in-out infinite',
        }}
      />

      {/* Floating particles (skip for reduced-motion) */}
      {!prefersReduced && PARTICLES.map((p, i) => (
        <div
          key={i}
          className="absolute rounded-full bg-white/30"
          style={{
            left: p.left,
            bottom: p.bottom,
            width: p.size,
            height: p.size,
            ['--particle-y' as string]: p.y,
            ['--particle-x' as string]: p.x,
            ['--particle-opacity' as string]: p.opacity,
            animation: `landing-particle-rise ${p.dur} ease-in-out infinite`,
            animationDelay: p.delay,
          }}
        />
      ))}

      <div className="relative z-10 max-w-3xl mx-auto px-6 text-center">
        <ScrollReveal>
          <h2
            className={cn(
              'text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight whitespace-pre-line leading-[1.15]',
              'font-[family-name:var(--font-plus-jakarta)]'
            )}
          >
            {CONTENT.headline}
          </h2>
          <p className="text-base lg:text-lg text-white/50 mt-4">
            {CONTENT.subheadline}
          </p>
          <div className="mt-8">
            <Button
              size="lg"
              className="rounded-full px-10 bg-white text-[#0a0a0f] hover:bg-white/90 shadow-lg shadow-white/10 font-semibold landing-shimmer-btn landing-glow-btn"
              asChild
            >
              <Link href="/discover">{CONTENT.buttonText}</Link>
            </Button>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
