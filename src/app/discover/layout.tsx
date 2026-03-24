import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Discover Podcasts & Videos — Yedapo',
  description:
    'Explore AI-powered summaries of trending podcasts and YouTube videos. Find new content, get instant insights, and never miss what matters.',
  openGraph: {
    title: 'Discover — Yedapo',
    description:
      'Explore AI-powered summaries of trending podcasts and YouTube videos.',
    type: 'website',
    siteName: 'Yedapo',
  },
  twitter: {
    card: 'summary',
    title: 'Discover — Yedapo',
    description:
      'Explore AI-powered summaries of trending podcasts and YouTube videos.',
  },
};

export default function DiscoverLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
