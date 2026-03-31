'use client';

import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { LANDING_COPY } from '@/lib/content/landing-copy';
import { HeroProductMockup } from './ProductMockup';

const HERO = LANDING_COPY.hero;

function FadeIn({
  children,
  delay,
  className,
}: {
  children: React.ReactNode;
  delay: number;
  className?: string;
}) {
  const prefersReduced = useReducedMotion();
  if (prefersReduced) return <div className={className}>{children}</div>;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.25, 0.1, 0.25, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function Hero() {
  const headlineParts = HERO.headline.split('\n');

  return (
    <section className="relative pt-28 pb-8 lg:pt-36 lg:pb-12 landing-hero-gradient overflow-hidden">
      {/* Animated gradient orbs */}
      <div
        className="landing-orb -top-32 left-[15%] w-[500px] h-[500px] bg-primary/[0.12] dark:bg-primary/[0.06]"
        style={{ filter: 'blur(120px)', animation: 'landing-float 8s ease-in-out infinite' }}
      />
      <div
        className="landing-orb top-20 right-[10%] w-[400px] h-[400px] bg-[#8b5cf6]/[0.10] dark:bg-[#8b5cf6]/[0.05]"
        style={{ filter: 'blur(120px)', animation: 'landing-float-reverse 10s ease-in-out infinite' }}
      />
      <div
        className="landing-orb top-40 left-[40%] w-[350px] h-[350px] bg-[#14b8a6]/[0.08] dark:bg-[#14b8a6]/[0.04]"
        style={{ filter: 'blur(100px)', animation: 'landing-float 12s ease-in-out infinite 2s' }}
      />

      <div className="relative z-10 max-w-5xl mx-auto px-6 text-center">
        {/* Badge */}
        <FadeIn delay={0}>
          <span
            className={cn(
              'inline-flex items-center rounded-full border border-primary/20 bg-primary/5',
              'text-sm font-medium px-4 py-1.5 text-primary'
            )}
          >
            <span className="mr-2 text-xs">✦</span>
            {HERO.badge}
          </span>
        </FadeIn>

        {/* Headline with gradient text */}
        <FadeIn delay={0.08}>
          <h1
            className={cn(
              'text-4xl sm:text-5xl lg:text-7xl font-bold tracking-tight leading-[1.08] mt-6',
              'font-[family-name:var(--font-plus-jakarta)]'
            )}
          >
            <span className="landing-gradient-text">{headlineParts[0]}</span>
            <br />
            <span className="text-foreground">{headlineParts[1]}</span>
          </h1>
        </FadeIn>

        {/* Subheadline */}
        <FadeIn delay={0.16}>
          <p className="text-lg lg:text-xl text-muted-foreground max-w-2xl mx-auto mt-5 leading-relaxed">
            {HERO.subheadline}
          </p>
        </FadeIn>

        {/* CTAs */}
        <FadeIn delay={0.24} className="flex flex-col sm:flex-row gap-3 justify-center mt-8">
          <Button
            size="lg"
            className="rounded-full px-8 shadow-lg shadow-primary/20 landing-shimmer-btn"
            asChild
          >
            <Link href="/discover">{HERO.primaryCta}</Link>
          </Button>
          <Button variant="outline" size="lg" className="rounded-full px-8" asChild>
            <a href="#how-it-works">{HERO.secondaryCta}</a>
          </Button>
        </FadeIn>

        <FadeIn delay={0.32}>
          <p className="text-xs text-muted-foreground mt-3">
            Free forever · No credit card needed
          </p>
        </FadeIn>
      </div>

      {/* Product Mockup */}
      <div className="relative z-10 max-w-5xl mx-auto px-6 mt-14 pb-8">
        <HeroProductMockup />
      </div>
    </section>
  );
}
