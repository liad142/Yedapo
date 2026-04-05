import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { LandingPage } from '@/components/landing/LandingPage';
import { getAuthUser } from '@/lib/auth-helpers';

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

export default async function Home() {
  // Authed users skip the marketing page and go straight to the app.
  // silent:true because unauthenticated visitors are the expected case here.
  const user = await getAuthUser({ silent: true });
  if (user) {
    redirect('/discover');
  }

  return <LandingPage />;
}
