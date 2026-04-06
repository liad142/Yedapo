'use client';

import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { Button } from '@/components/ui/button';

/**
 * YouTube video ID for the Yedapo promo/explainer video.
 * Upload to YouTube, then paste the video ID here (the part after v= in the URL).
 * Example: for https://www.youtube.com/watch?v=abc123 → use 'abc123'
 */
const PROMO_VIDEO_ID = process.env.NEXT_PUBLIC_PROMO_VIDEO_ID || '';

export function HeroVideoShowcase() {
  const prefersReduced = useReducedMotion();

  if (!PROMO_VIDEO_ID) return null; // Don't render section until video ID is set

  return (
    <section className="relative py-20 lg:py-28 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-background via-primary/[0.03] to-background pointer-events-none" />
      <div className="relative max-w-6xl mx-auto px-6">
        {/* Text header — centered */}
        <motion.div
          initial={prefersReduced ? undefined : { opacity: 0, y: 24 }}
          whileInView={prefersReduced ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
          className="text-center max-w-3xl mx-auto mb-12"
        >
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight leading-tight font-[family-name:var(--font-plus-jakarta)] text-balance">
            See how Yedapo turns hours of podcasts and YouTube into minutes of clarity.
          </h2>

          <p className="mt-5 text-lg text-muted-foreground leading-relaxed text-pretty">
            From deep summaries and chapter breakdowns to Ask AI and the smart player — the fastest way to understand what matters before you commit your time.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row justify-center gap-3">
            <Button size="lg" className="rounded-full px-8 shadow-lg shadow-primary/20" asChild>
              <Link href="/discover">Start free</Link>
            </Button>
            <Button variant="outline" size="lg" className="rounded-full px-8" asChild>
              <a href="#features">Explore features</a>
            </Button>
          </div>
        </motion.div>

        {/* Full-width YouTube embed */}
        <motion.div
          initial={prefersReduced ? undefined : { opacity: 0, scale: 0.98 }}
          whileInView={prefersReduced ? undefined : { opacity: 1, scale: 1 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.7, ease: [0.25, 0.1, 0.25, 1], delay: 0.1 }}
        >
          <div className="relative rounded-[28px] border border-border/60 bg-white/70 backdrop-blur shadow-[0_30px_120px_rgba(15,23,42,0.14)] p-3 sm:p-4">
            <div className="absolute inset-x-32 -top-8 h-20 rounded-full bg-primary/20 blur-3xl pointer-events-none" />

            <div className="relative overflow-hidden rounded-[22px] border border-border/60 bg-black">
              <div className="aspect-video">
                <iframe
                  src={`https://www.youtube.com/embed/${PROMO_VIDEO_ID}?autoplay=1&mute=1&loop=1&playlist=${PROMO_VIDEO_ID}&rel=0&modestbranding=1&showinfo=0&controls=0`}
                  title="Yedapo — AI Podcast & YouTube Insights"
                  className="h-full w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  loading="lazy"
                />
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
