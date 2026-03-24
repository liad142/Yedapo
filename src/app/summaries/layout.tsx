import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AI Summaries — Yedapo',
  description:
    'Browse AI-generated summaries of podcast episodes and YouTube videos. Key insights, highlights, and action items — all in one place.',
  openGraph: {
    title: 'AI Summaries — Yedapo',
    description:
      'Browse AI-generated summaries of podcast episodes and YouTube videos.',
    type: 'website',
    siteName: 'Yedapo',
  },
  twitter: {
    card: 'summary',
    title: 'AI Summaries — Yedapo',
    description:
      'Browse AI-generated summaries of podcast episodes and YouTube videos.',
  },
};

export default function SummariesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
