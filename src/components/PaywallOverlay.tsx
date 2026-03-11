'use client';

import { useEffect, useRef } from 'react';
import { Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { trackEvent } from '@/lib/analytics';
import { useAuth } from '@/contexts/AuthContext';

// ---------------------------------------------------------------------------
// PaywallOverlay — shows free content clearly, then blurs the rest as a teaser
// ---------------------------------------------------------------------------

interface PaywallOverlayProps {
  isGated: boolean;
  module: string;
  /** Free content shown clearly to all users */
  children: React.ReactNode;
  /** Extra content rendered blurred as a teaser (optional) */
  teaser?: React.ReactNode;
  className?: string;
}

export function PaywallOverlay({
  isGated,
  module,
  children,
  teaser,
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

  // Legacy mode: no teaser — blur children entirely (backward compat for tab components)
  if (!teaser) {
    return (
      <div className={cn('relative', className)}>
        <div className="relative select-none">
          <div aria-hidden="true">{children}</div>
          <div
            className="pointer-events-none absolute inset-0 backdrop-blur-[5px]"
            aria-hidden="true"
          />
        </div>
        <div className="flex justify-center pt-3 pb-1">
          <UpgradeCta module={module} />
        </div>
      </div>
    );
  }

  // New mode: free content + blurred teaser
  return (
    <div className={cn('relative', className)}>
      {/* Free content — fully readable */}
      {children}

      {/* Blurred teaser — shows what they're missing */}
      <div className="relative select-none">
        <div aria-hidden="true">{teaser}</div>
        {/* Gradient mask: fades from transparent to white so blur has no hard edge */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: 'linear-gradient(to bottom, transparent 0%, hsl(var(--background) / 0.7) 40%, hsl(var(--background)) 100%)',
          }}
          aria-hidden="true"
        />
      </div>

      {/* CTA */}
      <div className="flex justify-center pt-3 pb-1">
        <UpgradeCta module={module} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PaywallList — show first N items clearly, then blur the next few as teaser
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
      {/* Fully-readable free items */}
      {visible.map((item, i) => renderItem(item, i))}

      {hasHidden && (
        <>
          {/* Blurred teaser: next 2-3 items visible through frosted glass */}
          <div className="relative select-none" aria-hidden="true">
            {items.slice(visibleCount, visibleCount + 3).map((item, i) =>
              renderItem(item, visibleCount + i),
            )}
            <div
              className="pointer-events-none absolute inset-0 backdrop-blur-[5px]"
              aria-hidden="true"
            />
          </div>

          {/* CTA */}
          <div className="flex justify-center pt-3 pb-1">
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
  const { setShowAuthModal } = useAuth();

  return (
    <button
      onClick={() => {
        trackEvent('paywall_cta_click', { module });
        setShowAuthModal(true, `Sign up to unlock the full ${module}.`);
      }}
      className={cn(
        'relative z-10 group cursor-pointer',
        'inline-flex items-center gap-2 px-5 py-2.5',
        'rounded-full',
        'bg-primary text-primary-foreground',
        'shadow-lg shadow-primary/25',
        'text-sm font-medium',
        'transition-all duration-200',
        'hover:shadow-primary/40 hover:scale-[1.02]',
        'active:scale-[0.98]',
      )}
    >
      <Lock className="h-3.5 w-3.5" />
      <span>Sign up to unlock full {module}</span>
    </button>
  );
}
