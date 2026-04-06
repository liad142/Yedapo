import type { Metadata } from 'next';
import { PricingClient } from './PricingClient';
import { LandingNav, LandingFooter } from '@/components/landing';

export const metadata: Metadata = {
  title: 'Pricing — Yedapo',
  description:
    'Choose the right plan for how you listen. Free forever for casual listeners, Pro for power users.',
  openGraph: {
    title: 'Pricing — Yedapo',
    description:
      'AI-powered podcast summaries. Free forever for casual listeners, Pro for power users.',
    type: 'website',
    siteName: 'Yedapo',
  },
};

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <LandingNav />
      <PricingClient />
      <LandingFooter />
    </div>
  );
}
