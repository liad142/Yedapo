import type { Metadata } from 'next';
import { LandingPage } from '@/components/landing/LandingPage';

export const metadata: Metadata = {
  title: 'Yedapo — AI-Powered Podcast & YouTube Insights',
  description:
    'Get AI-powered summaries, key insights, and smart discovery for podcasts and YouTube. Know what matters in every episode — for free.',
  openGraph: {
    title: 'Yedapo — Know What Matters',
    description:
      'AI-powered summaries, key insights, and smart discovery for podcasts and YouTube.',
    type: 'website',
    siteName: 'Yedapo',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Yedapo — Know What Matters',
    description:
      'AI-powered summaries, key insights, and smart discovery for podcasts and YouTube.',
  },
};

export default function Home() {
  return <LandingPage />;
}
