import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Settings — Yedapo',
  description: 'Manage your Yedapo account, preferences, and notifications.',
};

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
