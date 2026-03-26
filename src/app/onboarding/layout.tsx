import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Get Started — Yedapo',
  description: 'Set up your Yedapo profile and discover podcasts you love.',
};

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
