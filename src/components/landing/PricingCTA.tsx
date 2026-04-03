'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollReveal } from '@/components/landing/ScrollReveal';
import { cn } from '@/lib/utils';
import { LANDING_COPY } from '@/lib/content/landing-copy';

const CONTENT = LANDING_COPY.pricingCta;

export function PricingCTA() {
  return (
    <section className="py-16 lg:py-20 landing-cta-gradient">
      <div className="max-w-3xl mx-auto px-6 text-center">
        <ScrollReveal>
          <h2
            className={cn(
              'text-3xl lg:text-4xl font-bold text-foreground tracking-tight',
              'font-[family-name:var(--font-plus-jakarta)]'
            )}
          >
            {CONTENT.headline}
          </h2>
          <p className="text-lg text-muted-foreground mt-3">
            {CONTENT.description}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center mt-8">
            <Button size="lg" className="rounded-full px-8 landing-shimmer-btn" asChild>
              <Link href="/discover">Start Free</Link>
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="rounded-full px-8"
              asChild
            >
              <Link href="/pricing">
                Compare Plans
                <ArrowRight className="ml-2 w-4 h-4" />
              </Link>
            </Button>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
