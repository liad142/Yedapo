import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'My List — Yedapo',
  description: 'Your followed podcasts and YouTube channels.',
};

export default function MyListLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
