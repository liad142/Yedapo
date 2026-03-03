'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { Crown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { trackEvent } from '@/lib/analytics';

// ---------------------------------------------------------------------------
// PaywallOverlay — wraps block content with a gradient fade + CTA
// ---------------------------------------------------------------------------

interface PaywallOverlayProps {
  isGated: boolean;
  module: string;
  children: React.ReactNode;
  className?: string;
}

export function PaywallOverlay({
  isGated,
  module,
  children,
  className,
}: PaywallOverlayProps) {
  const sentRef = useRef(false);

  useEffect(() => {
    if (isGated && !sentRef.current) {
      sentRef.current = true;
      trackEvent('paywall_impression', { module });
    }
  }, [isGated, module]);

  // Paid users — zero wrapper overhead
  if (!isGated) return <>{children}</>;

  return (
    <div className={cn('relative', className)}>
      {/* Visible preview content (rendered by the consumer) */}
      <div className="overflow-hidden">{children}</div>

      {/* Gradient fade + CTA overlay */}
      <div
        className="absolute inset-x-0 bottom-0 flex flex-col items-center justify-end"
        style={{ height: '160px' }}
      >
        {/* Gradient: transparent -> background */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'linear-gradient(to bottom, transparent 0%, rgba(9,9,11,0.6) 40%, rgb(9,9,11) 100%)',
          }}
        />

        {/* Subtle blur on the lowest content lines */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-12 backdrop-blur-[2px]"
          aria-hidden="true"
        />

        {/* CTA card */}
        <UpgradeCta module={module} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PaywallList — show first N items, then gradient fade over the rest
// ---------------------------------------------------------------------------

interface PaywallListProps<T> {
  items: T[];
  visibleCount: number;
  isGated: boolean;
  module: string;
  renderItem: (item: T, index: number) => React.ReactNode;
  className?: string;
}

export function PaywallList<T>({
  items,
  visibleCount,
  isGated,
  module,
  renderItem,
  className,
}: PaywallListProps<T>) {
  const sentRef = useRef(false);

  useEffect(() => {
    if (isGated && items.length > visibleCount && !sentRef.current) {
      sentRef.current = true;
      trackEvent('paywall_impression', {
        module,
        totalItems: items.length,
        visibleItems: visibleCount,
      });
    }
  }, [isGated, module, items.length, visibleCount]);

  // No gating — render everything
  if (!isGated) {
    return (
      <div className={className}>
        {items.map((item, i) => renderItem(item, i))}
      </div>
    );
  }

  const visible = items.slice(0, visibleCount);
  const hasHidden = items.length > visibleCount;

  return (
    <div className={cn('relative', className)}>
      {/* Fully-rendered preview items */}
      {visible.map((item, i) => renderItem(item, i))}

      {hasHidden && (
        <>
          {/* Peek: render the next 1-2 items to create the "there's more" feeling */}
          <div className="relative overflow-hidden" style={{ maxHeight: '80px' }}>
            {items.slice(visibleCount, visibleCount + 2).map((item, i) =>
              renderItem(item, visibleCount + i),
            )}

            {/* Gradient fade over the peek items */}
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  'linear-gradient(to bottom, transparent 0%, rgba(9,9,11,0.6) 40%, rgb(9,9,11) 100%)',
              }}
            />

            {/* Subtle blur */}
            <div
              className="pointer-events-none absolute inset-x-0 bottom-0 h-8 backdrop-blur-[2px]"
              aria-hidden="true"
            />
          </div>

          {/* CTA */}
          <div className="flex justify-center pt-2">
            <UpgradeCta module={module} />
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared CTA card — glass-morphism upgrade nudge
// ---------------------------------------------------------------------------

function UpgradeCta({ module }: { module: string }) {
  return (
    <Link
      href="/pricing"
      onClick={() => trackEvent('paywall_cta_click', { module })}
      className={cn(
        'relative z-10 group',
        'inline-flex items-center gap-2 px-5 py-2.5',
        'rounded-full',
        // Glass-morphism: translucent bg + border + backdrop blur
        'bg-white/[0.06] border border-white/[0.1]',
        'backdrop-blur-md shadow-lg shadow-black/20',
        // Typography
        'text-sm font-medium text-zinc-200',
        // Hover state
        'transition-all duration-200',
        'hover:bg-white/[0.1] hover:border-white/[0.18] hover:shadow-primary/10',
        'hover:text-white hover:scale-[1.02]',
        'active:scale-[0.98]',
      )}
    >
      <Crown className="h-4 w-4 text-amber-400 transition-transform duration-200 group-hover:scale-110" />
      <span>
        Unlock full {module} with Pro
      </span>
      <span
        className="text-zinc-500 transition-transform duration-200 group-hover:translate-x-0.5"
        aria-hidden="true"
      >
        &rarr;
      </span>
    </Link>
  );
}
