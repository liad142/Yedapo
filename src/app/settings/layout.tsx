import type { Metadata } from 'next';
import { TabNav } from '@/components/settings/TabNav';

export const metadata: Metadata = {
  title: 'Settings — Yedapo',
  description: 'Manage your Yedapo account, preferences, and notifications.',
};

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="max-w-2xl mx-auto px-4 py-8 sm:py-12">
      <div className="mb-6">
        <h1 className="text-h2 text-foreground">Settings</h1>
        <p className="text-body-sm text-muted-foreground mt-1">
          Manage your account and preferences
        </p>
      </div>
      <TabNav />
      {children}
    </div>
  );
}
