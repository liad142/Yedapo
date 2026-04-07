'use client';

import Link from 'next/link';
import { Sparkles, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PRICING } from '@/lib/plans';

interface UpgradeOverlayProps {
  title?: string;
  description?: string;
  children: React.ReactNode;
}

/**
 * Wraps child content with a frosted-glass upgrade CTA overlay.
 * The underlying UI renders fully (creating desire) but is non-interactive.
 * Used on the Notifications tab for free-plan users.
 */
export function UpgradeOverlay({
  title = 'Upgrade to Explorer',
  description = 'Get summaries delivered to your inbox, Telegram, or WhatsApp.',
  children,
}: UpgradeOverlayProps) {
  return (
    <div className="relative">
      {/* Underlying content — visible but non-interactive */}
      <div className="pointer-events-none opacity-60 select-none" aria-hidden>
        {children}
      </div>

      {/* Frosted overlay */}
      <div className="absolute inset-0 z-10 backdrop-blur-[6px] bg-background/60 rounded-2xl flex flex-col items-center justify-center text-center p-6">
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
          <Sparkles className="h-6 w-6 text-primary" />
        </div>
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-[280px]">{description}</p>
        <Button size="sm" className="mt-4 gap-2" asChild>
          <Link href="/pricing">
            <Zap className="h-3.5 w-3.5" />
            Upgrade — ${PRICING.pro.monthly}/mo
          </Link>
        </Button>
      </div>
    </div>
  );
}
